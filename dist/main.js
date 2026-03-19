/**
 * OpenSofa - Main Entry Point
 *
 * Web-only bootstrap sequence and component wiring.
 * Based on LOW_LEVEL_DESIGN.md §3 and §14.1
 */
import { createLogger } from './utils/logger.js';
import { getConfigPath } from './utils/expand-path.js';
import { initConfig } from './config.js';
import { PermissionClassifier } from './permission-classifier.js';
import { SessionManager } from './session-manager.js';
import { AgentRegistry } from './agent-registry.js';
import { StatePersistence, serializeSessions } from './state-persistence.js';
import { ResourceMonitor } from './resource-monitor.js';
import { ScreenshotService } from './screenshot-service.js';
import { createWebServer, DEFAULT_WEB_CONFIG } from './web/server.js';
import { Notifier } from './web/notifier.js';
const log = createLogger('main');
// Global references for shutdown handlers
let config;
let sessionManager;
let statePersistence;
let resourceMonitor;
let webServer = null;
let isShuttingDown = false;
/**
 * Main entry point
 */
async function main() {
    // Check for CLI subcommands
    if (process.argv[2] === 'revoke') {
        return handleRevokeCommand();
    }
    log.info('OpenSofa starting...');
    // 1. Load config
    try {
        config = initConfig(getConfigPath());
    }
    catch (err) {
        const error = err;
        console.error(error.message);
        process.exit(1);
    }
    // 2. Initialize State Persistence (load)
    statePersistence = new StatePersistence(() => serializeSessions(sessionManager.getSessionsMap()));
    const persistedState = statePersistence.load();
    // 3. Initialize shared components
    const classifier = new PermissionClassifier();
    const agentRegistry = new AgentRegistry();
    // Log agent discovery at startup
    agentRegistry.logDiscovery();
    // 4. Initialize Session Manager (web-only architecture)
    sessionManager = new SessionManager(config.getAll(), classifier, agentRegistry);
    sessionManager.setStateChangeHook(async () => {
        await statePersistence.save();
    });
    const screenshotService = new ScreenshotService(config.getAll());
    sessionManager.setScreenshotService(screenshotService);
    // 5. Initialize Notifier
    const notifier = new Notifier({ ntfyTopic: config.get('ntfyTopic') || null });
    sessionManager.setNotifier(notifier);
    // 6. Initialize Resource Monitor
    resourceMonitor = new ResourceMonitor(config.getAll(), () => sessionManager.getSessionsMap());
    // Wire resource monitor to session manager
    sessionManager.setResourceMonitor(resourceMonitor);
    // Resource monitor events — log + push notifications
    resourceMonitor.on('session:unhealthy', async (name, reason) => {
        log.warn('Session unhealthy', { name, reason });
        await notifier.sendNotification('Session Unhealthy', `[${name}] ⚠️ Health check failed: ${reason}`, `/?session=${name}`);
    });
    resourceMonitor.on('session:idle', async (name, idleMs) => {
        const mins = Math.round(idleMs / 60000);
        log.info('Session idle detected', { name, idleMs });
        await notifier.sendNotification('Session Idle', `[${name}] 💤 Session idle for ${mins} minutes`, `/?session=${name}`);
    });
    resourceMonitor.on('resources:critical', async (stats) => {
        log.error('Resources critical', { ...stats });
        await notifier.sendNotification('⚠️ Critical Resources', `CPU: ${stats.cpu}% | Free RAM: ${Math.round(stats.freeMemMB)}MB`);
    });
    // Auto-cleanup idle sessions when resources are critical
    resourceMonitor.on('session:cleanup', async (name, reason) => {
        try {
            log.warn('Auto-cleanup triggered', { name, reason });
            await sessionManager.stopSession(name);
            await notifier.sendNotification('Session Auto-Stopped', `🧹 Auto-stopped idle session "${name}" due to ${reason}`);
        }
        catch (err) {
            log.error('Failed auto-cleanup', { name, error: String(err) });
        }
    });
    // 7. Recover sessions from persisted state
    if (persistedState.sessions.length > 0) {
        await sessionManager.recoverSessions(persistedState.sessions);
    }
    // 8. Start periodic state persistence (every 60s)
    statePersistence.startPeriodicSave(60000);
    // 8a. Start resource monitoring
    resourceMonitor.start();
    log.info('Resource monitor started');
    // 9. Start web server
    const webConfig = { ...DEFAULT_WEB_CONFIG, enabled: true };
    webServer = createWebServer({
        sessionManager,
        agentRegistry,
        notifier,
        webConfig,
        getUptime: () => process.uptime(),
        getSystemResources: () => {
            const stats = resourceMonitor.getStats();
            return {
                cpu: `${stats.cpu}%`,
                freeMem: `${stats.freeMemMB}MB`,
            };
        },
    });
    try {
        await webServer.start();
        log.info('Web server started');
        // Wire web URL provider
        sessionManager.setWebUrlProvider(() => webServer.getQRCodeUrl());
    }
    catch (err) {
        log.error('Failed to start web server', { error: String(err) });
        // Continue without web server - it's not critical
    }
    // 10. Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('uncaughtException', (err) => emergencyShutdown(err));
    process.on('unhandledRejection', (reason) => {
        log.error('Unhandled rejection', { reason: String(reason) });
        // Don't exit - most unhandled rejections are recoverable
    });
    log.info('OpenSofa started (web-only mode).');
    log.info('Open the web interface to create sessions and manage agents.');
}
/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    log.info(`Received ${signal}, shutting down gracefully...`);
    try {
        // Stop web server
        if (webServer) {
            await webServer.stop();
            log.info('Web server stopped');
        }
        // Stop resource monitor
        if (resourceMonitor) {
            resourceMonitor.stop();
            log.info('Resource monitor stopped');
        }
        // Stop periodic save
        statePersistence.stopPeriodicSave();
        // Disconnect per-session runtime pipelines (SSE connections)
        sessionManager.disconnectAllRuntime();
        // Save state (atomic write)
        await statePersistence.save();
        log.info('State saved');
        log.info('Shutdown complete');
        process.exit(0);
    }
    catch (err) {
        log.error('Error during shutdown', { error: String(err) });
        process.exit(1);
    }
}
/**
 * Emergency shutdown (uncaught exception)
 */
function emergencyShutdown(err) {
    console.error('FATAL: Uncaught exception', err);
    try {
        sessionManager?.disconnectAllRuntime();
    }
    catch {
        // Best effort only
    }
    statePersistence.saveSync();
    process.exit(1);
}
/**
 * Handle CLI token revocation
 */
async function handleRevokeCommand() {
    console.log('Revoking OpenSofa token...');
    try {
        config = initConfig(getConfigPath());
        const webConfig = { ...DEFAULT_WEB_CONFIG, enabled: true };
        // Load local token to authenticate the revoke request
        const { createDefaultTokenManager } = await import('./web/auth.js');
        const tokenManager = createDefaultTokenManager(webConfig);
        const currentToken = tokenManager.getOrGenerate();
        console.log('Contacting local server to terminate active sessions...');
        const res = await fetch(`http://localhost:${webConfig.port}/api/admin/revoke`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        if (res.ok) {
            console.log('✅ Token revoked successfully. All active sessions terminated.');
        }
        else {
            console.log(`⚠️ Server responded with ${res.status}. Regenerating token locally...`);
            tokenManager.regenerate();
            console.log('✅ Local token regenerated successfully.');
        }
    }
    catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.log('⚠️ Server not running. Regenerating local token...');
            try {
                const { createDefaultTokenManager } = await import('./web/auth.js');
                const webConfig = { ...DEFAULT_WEB_CONFIG, enabled: true };
                const tokenManager = createDefaultTokenManager(webConfig);
                tokenManager.regenerate();
                console.log('✅ Local token regenerated successfully.');
            }
            catch (innerErr) {
                console.error('❌ Failed to regenerate local token:', innerErr);
            }
        }
        else {
            console.error('❌ Failed to revoke token:', err);
        }
    }
    process.exit(0);
}
// Run main
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map