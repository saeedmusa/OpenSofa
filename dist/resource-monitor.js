/**
 * OpenSofa - Resource Monitor
 *
 * Monitors system resources and session health.
 * Based on LOW_LEVEL_DESIGN.md §11
 */
import { EventEmitter } from 'events';
import os from 'os';
import { execSync } from 'child_process';
import { createLogger } from './utils/logger.js';
const IS_MACOS = os.platform() === 'darwin';
const log = createLogger('resource-monitor');
/**
 * Resource Monitor class
 * Singleton - runs periodic checks
 */
export class ResourceMonitor extends EventEmitter {
    config;
    healthCheckTimer = null;
    sessionsFn;
    cpuUsage = 0;
    freeMemMB = 0;
    totalMemMB = 0;
    running = false;
    overrides;
    // Non-blocking CPU: store previous snapshot for delta computation
    prevCpuSnapshot = null;
    // Critical alert cooldown to prevent notification spam
    lastCriticalAlertAt = 0;
    static CRITICAL_ALERT_COOLDOWN_MS = 300_000; // 5 minutes
    constructor(config, sessionsFn, overrides) {
        super();
        this.config = config;
        this.sessionsFn = sessionsFn;
        this.overrides = overrides;
        // CRITICAL: Always add error handler to prevent process crashes
        // If 'error' event is emitted with no listener, Node.js crashes the process
        this.on('error', (err) => {
            log.error('ResourceMonitor internal error', { error: err.message, stack: err.stack });
        });
        this.totalMemMB = this.overrides?.getTotalMemMB
            ? this.overrides.getTotalMemMB()
            : os.totalmem() / (1024 * 1024);
        this.freeMemMB = this.overrides?.getFreeMemMB
            ? this.overrides.getFreeMemMB()
            : this.readAvailableMemMB();
        if (this.overrides?.getCpuUsage) {
            const initialCpu = this.overrides.getCpuUsage();
            if (typeof initialCpu === 'number') {
                this.cpuUsage = initialCpu;
            }
            else {
                initialCpu.then((value) => {
                    this.cpuUsage = value;
                }).catch(() => {
                    // Best-effort; ignore errors for initial CPU measurement
                });
            }
        }
        // Take initial CPU snapshot for delta computation
        this.prevCpuSnapshot = this.takeCpuSnapshot();
    }
    /**
     * Check if monitor is running
     */
    isRunning() {
        return this.running;
    }
    /**
     * Start periodic health checks and resource monitoring
     */
    start() {
        if (this.running) {
            // Already running - no-op
            return;
        }
        this.running = true;
        log.info('Starting resource monitor', {
            intervalMs: this.config.healthCheckIntervalMs,
            maxSessions: this.config.maxSessions,
            idleTimeoutMs: this.config.idleTimeoutMs,
        });
        // Run immediately
        this.runChecks().catch(err => {
            log.error('Error in initial resource check', { error: String(err) });
        });
        // Then run periodically
        this.healthCheckTimer = setInterval(() => {
            this.runChecks().catch(err => {
                log.error('Error in periodic resource check', { error: String(err) });
            });
        }, this.config.healthCheckIntervalMs);
    }
    /**
     * Stop all timers
     */
    stop() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        this.running = false;
        log.info('Resource monitor stopped');
    }
    /**
     * Check if system has capacity for another session
     */
    canCreateSession(activeCount) {
        // Check session count
        if (activeCount >= this.config.maxSessions) {
            return {
                ok: false,
                reason: `Max sessions (${this.config.maxSessions}) reached. Stop an idle session with /stop <name> to free resources.`,
            };
        }
        // Check CPU
        if (this.cpuUsage > 90) {
            return {
                ok: false,
                reason: `CPU usage too high (${this.cpuUsage}%). Please wait for current operations to complete.`,
            };
        }
        // Check RAM - 512MB minimum for a new session
        if (this.freeMemMB < 512) {
            return {
                ok: false,
                reason: `Low RAM (${Math.round(this.freeMemMB)}MB free, need 512MB+). Stop a session to free resources.`,
            };
        }
        return { ok: true };
    }
    /**
     * Get current resource stats
     */
    getStats() {
        const sessions = this.sessionsFn();
        return {
            cpu: this.cpuUsage,
            freeMemMB: this.freeMemMB,
            totalMemMB: this.totalMemMB,
            activeSessions: sessions.size,
        };
    }
    /**
     * Run all checks (CPU, RAM, health, idle)
     */
    async runChecks() {
        // 1. Update system metrics (non-blocking)
        this.cpuUsage = this.readCpuUsage();
        this.freeMemMB = this.overrides?.getFreeMemMB
            ? this.overrides.getFreeMemMB()
            : this.readAvailableMemMB();
        log.debug('Resource check', {
            cpu: `${this.cpuUsage}%`,
            freeMem: `${Math.round(this.freeMemMB)}MB`,
        });
        // 2. Check each active session
        const sessions = this.sessionsFn();
        for (const [name, session] of sessions) {
            if (session.status !== 'active')
                continue;
            // 2a. AgentAPI health check
            const healthResult = await this.checkSessionHealth(session);
            if (!healthResult.healthy) {
                this.emit('session:unhealthy', name, healthResult.reason);
            }
            // 2b. Idle detection
            const idleMs = Date.now() - session.lastActivityAt;
            if (idleMs > this.config.idleTimeoutMs) {
                this.emit('session:idle', name, idleMs);
            }
        }
        // 3. Resource threshold check (critical) — with cooldown to prevent notification spam
        const isCritical = this.cpuUsage > 95 || this.freeMemMB < 512;
        const isSevere = this.freeMemMB < 256;
        if (isCritical) {
            const now = Date.now();
            if (now - this.lastCriticalAlertAt >= ResourceMonitor.CRITICAL_ALERT_COOLDOWN_MS) {
                this.lastCriticalAlertAt = now;
                this.emit('resources:critical', this.getStats());
            }
            // Auto-cleanup idle sessions if enabled
            if (this.config.autoCleanupOnCritical) {
                this.cleanupIdleSessions(sessions);
            }
            // Severe memory pressure: stop ALL sessions to prevent system crash
            if (isSevere) {
                this.cleanupAllSessions(sessions);
            }
        }
    }
    /**
     * Auto-cleanup idle sessions when resources are critical.
     * Emits session:cleanup for each idle session to be stopped.
     */
    cleanupIdleSessions(sessions) {
        const now = Date.now();
        const idleThreshold = this.config.idleTimeoutMs;
        for (const [name, session] of sessions) {
            if (session.status !== 'active')
                continue;
            const idleMs = now - session.lastActivityAt;
            if (idleMs > idleThreshold) {
                log.warn('Auto-cleanup: stopping idle session due to critical resources', {
                    name,
                    idleMinutes: Math.round(idleMs / 60000),
                });
                this.emit('session:cleanup', name, 'critical resources');
            }
        }
    }
    /**
     * Severe memory pressure: stop ALL active sessions to prevent system crash.
     * This is a last-resort measure when free RAM drops below 256MB.
     */
    cleanupAllSessions(sessions) {
        log.error('SEVERE MEMORY PRESSURE: stopping all sessions to prevent system crash', {
            freeMemMB: Math.round(this.freeMemMB),
        });
        for (const [name, session] of sessions) {
            if (session.status === 'active') {
                log.warn('Emergency stop', { session: name });
                this.emit('session:cleanup', name, 'severe memory pressure (emergency)');
            }
        }
    }
    /**
     * Check health of a single session's AgentAPI
     */
    async checkSessionHealth(session) {
        try {
            const response = await fetch(`http://localhost:${session.port}/status`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                return {
                    sessionName: session.name,
                    healthy: false,
                    reason: `HTTP ${response.status}`,
                };
            }
            return { sessionName: session.name, healthy: true };
        }
        catch (err) {
            return {
                sessionName: session.name,
                healthy: false,
                reason: String(err),
            };
        }
    }
    /**
     * Take a CPU snapshot for delta computation (no blocking sleep needed).
     */
    takeCpuSnapshot() {
        return os.cpus().map(c => ({
            idle: c.times.idle,
            total: Object.values(c.times).reduce((a, b) => a + b, 0),
        }));
    }
    /**
     * Measure CPU usage by comparing current snapshot to previous (non-blocking).
     * Returns 0 on first call (no previous data).
     */
    measureCpuDelta() {
        const current = this.takeCpuSnapshot();
        const prev = this.prevCpuSnapshot;
        this.prevCpuSnapshot = current;
        if (!prev)
            return 0; // First call — no delta available
        let idleDelta = 0;
        let totalDelta = 0;
        const count = Math.min(prev.length, current.length);
        for (let i = 0; i < count; i++) {
            const p = prev[i];
            const c = current[i];
            if (!p || !c)
                continue;
            idleDelta += c.idle - p.idle;
            totalDelta += c.total - p.total;
        }
        if (totalDelta === 0)
            return 0;
        const usage = Math.round((1 - idleDelta / totalDelta) * 100);
        return Math.max(0, Math.min(100, usage));
    }
    readCpuUsage() {
        if (this.overrides?.getCpuUsage) {
            const value = this.overrides.getCpuUsage();
            // Overrides may return a Promise for testing; handle synchronously if possible
            if (typeof value === 'number')
                return value;
            // Fallback: store async result for next cycle
            value.then(v => { this.cpuUsage = v; }).catch(() => { });
            return this.cpuUsage; // Return last known value
        }
        return this.measureCpuDelta();
    }
    /**
     * Read available memory in MB.
     * On macOS, os.freemem() only reports truly unused pages — not cached/purgeable memory.
     * We use `vm_stat` to compute a more accurate "available" figure.
     * On Linux/other, os.freemem() is accurate.
     */
    readAvailableMemMB() {
        if (IS_MACOS) {
            return this.readMacOSAvailableMemMB();
        }
        return os.freemem() / (1024 * 1024);
    }
    /**
     * Parse macOS `vm_stat` to compute available memory:
     * available ≈ (free + inactive + purgeable) × pageSize
     */
    readMacOSAvailableMemMB() {
        try {
            const output = execSync('vm_stat', { encoding: 'utf-8', timeout: 2000 });
            const pageSize = this.parseVmStatPageSize(output);
            const free = this.parseVmStatValue(output, 'Pages free');
            const inactive = this.parseVmStatValue(output, 'Pages inactive');
            const purgeable = this.parseVmStatValue(output, 'Pages purgeable');
            const availablePages = free + inactive + purgeable;
            const availableMB = (availablePages * pageSize) / (1024 * 1024);
            return Math.round(availableMB);
        }
        catch {
            // Fallback to os.freemem() if vm_stat fails
            return os.freemem() / (1024 * 1024);
        }
    }
    parseVmStatPageSize(output) {
        // First line: "Mach Virtual Memory Statistics: (page size of 16384 bytes)"
        const match = output.match(/page size of (\d+) bytes/);
        return match ? parseInt(match[1], 10) : 16384; // default 16KB on Apple Silicon
    }
    parseVmStatValue(output, label) {
        // Lines like: "Pages free:                               12345."
        const regex = new RegExp(`${label}:\\s+(\\d+)`);
        const match = output.match(regex);
        return match ? parseInt(match[1], 10) : 0;
    }
    /**
     * Format stats for display
     */
    formatStats() {
        const stats = this.getStats();
        const totalMem = stats.totalMemMB || 1; // Avoid division by zero
        const freeMem = stats.freeMemMB || 0;
        const usedMemMB = Math.round(totalMem - freeMem);
        const usedMemPercent = Math.round((usedMemMB / totalMem) * 100);
        return (`*System Resources*\n` +
            `CPU: ${stats.cpu}%\n` +
            `Memory: ${usedMemPercent}% (${usedMemMB}MB / ${Math.round(totalMem)}MB)\n` +
            `Active Sessions: ${stats.activeSessions}/${this.config.maxSessions}`);
    }
}
//# sourceMappingURL=resource-monitor.js.map