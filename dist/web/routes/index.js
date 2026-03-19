/**
 * OpenSofa Web - Routes Index
 *
 * Aggregates all API routes into a single Hono app.
 */
import { Hono } from 'hono';
import { createSessionsRoutes } from './sessions.js';
import { createFilesRoutes } from './files.js';
import { createAgentsRoutes } from './agents.js';
import { createSystemRoutes } from './system.js';
import { createNotificationsRoutes } from './notifications.js';
import { createAdminRoutes } from './admin.js';
// ──────────────────────────────────────
// Factory - creates all routes
// ──────────────────────────────────────
export const createApiRoutes = (deps) => {
    const app = new Hono();
    // Mount sessions routes
    const sessionsDeps = {
        sessionManager: deps.sessionManager,
    };
    app.route('/sessions', createSessionsRoutes(sessionsDeps));
    // Mount files routes (note: files routes include session name in path)
    const filesDeps = {
        getSession: (name) => deps.sessionManager.getByName(name) ?? null,
    };
    app.route('/sessions', createFilesRoutes(filesDeps));
    // Mount agents routes
    const agentsDeps = {
        agentRegistry: deps.agentRegistry,
    };
    app.route('/agents', createAgentsRoutes(agentsDeps));
    // Mount system routes
    const systemDeps = {
        getTunnelManager: deps.getTunnelManager,
        getSessionsCount: () => deps.sessionManager.getActiveSessions().length,
        getUptime: deps.getUptime,
        getSystemResources: deps.getSystemResources,
    };
    app.route('/status', createSystemRoutes(systemDeps));
    // Mount notification routes
    app.route('/notifications', createNotificationsRoutes({ notifier: deps.notifier }));
    // Mount admin routes
    app.route('/admin', createAdminRoutes({ revokeToken: deps.revokeToken }));
    return app;
};
//# sourceMappingURL=index.js.map