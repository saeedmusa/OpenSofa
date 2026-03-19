/**
 * OpenSofa - Resource Monitor
 *
 * Monitors system resources and session health.
 * Based on LOW_LEVEL_DESIGN.md §11
 */
import { EventEmitter } from 'events';
import type { OpenSofaConfig, Session, ResourceStats } from './types.js';
/**
 * Session health check result
 */
export interface HealthCheckResult {
    sessionName: string;
    healthy: boolean;
    reason?: string;
}
/**
 * Optional overrides for resource metrics (useful for tests)
 */
export interface ResourceMonitorOverrides {
    getCpuUsage?: () => number | Promise<number>;
    getFreeMemMB?: () => number;
    getTotalMemMB?: () => number;
}
/**
 * Resource Monitor class
 * Singleton - runs periodic checks
 */
export declare class ResourceMonitor extends EventEmitter {
    private config;
    private healthCheckTimer;
    private sessionsFn;
    private cpuUsage;
    private freeMemMB;
    private totalMemMB;
    private running;
    private overrides?;
    private prevCpuSnapshot;
    private lastCriticalAlertAt;
    private static readonly CRITICAL_ALERT_COOLDOWN_MS;
    constructor(config: OpenSofaConfig, sessionsFn: () => Map<string, Session>, overrides?: ResourceMonitorOverrides);
    /**
     * Check if monitor is running
     */
    isRunning(): boolean;
    /**
     * Start periodic health checks and resource monitoring
     */
    start(): void;
    /**
     * Stop all timers
     */
    stop(): void;
    /**
     * Check if system has capacity for another session
     */
    canCreateSession(activeCount: number): {
        ok: boolean;
        reason?: string;
    };
    /**
     * Get current resource stats
     */
    getStats(): ResourceStats;
    /**
     * Run all checks (CPU, RAM, health, idle)
     */
    private runChecks;
    /**
     * Auto-cleanup idle sessions when resources are critical.
     * Emits session:cleanup for each idle session to be stopped.
     */
    private cleanupIdleSessions;
    /**
     * Severe memory pressure: stop ALL active sessions to prevent system crash.
     * This is a last-resort measure when free RAM drops below 256MB.
     */
    private cleanupAllSessions;
    /**
     * Check health of a single session's AgentAPI
     */
    private checkSessionHealth;
    /**
     * Take a CPU snapshot for delta computation (no blocking sleep needed).
     */
    private takeCpuSnapshot;
    /**
     * Measure CPU usage by comparing current snapshot to previous (non-blocking).
     * Returns 0 on first call (no previous data).
     */
    private measureCpuDelta;
    private readCpuUsage;
    /**
     * Read available memory in MB.
     * On macOS, os.freemem() only reports truly unused pages — not cached/purgeable memory.
     * We use `vm_stat` to compute a more accurate "available" figure.
     * On Linux/other, os.freemem() is accurate.
     */
    private readAvailableMemMB;
    /**
     * Parse macOS `vm_stat` to compute available memory:
     * available ≈ (free + inactive + purgeable) × pageSize
     */
    private readMacOSAvailableMemMB;
    private parseVmStatPageSize;
    private parseVmStatValue;
    /**
     * Format stats for display
     */
    formatStats(): string;
}
//# sourceMappingURL=resource-monitor.d.ts.map