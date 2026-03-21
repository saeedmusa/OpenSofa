/**
 * OpenSofa Web - System API Routes
 *
 * REST endpoints for system status, configuration, and tunnel management.
 */
import { Hono } from 'hono';
import { success, error } from '../types.js';
import { createLogger } from '../../utils/logger.js';
import { discoverAPIKeys } from '../../discovery/key-discovery.js';
const log = createLogger('web:routes:system');
export const createSystemRoutes = (deps) => {
    const app = new Hono();
    const { getTunnelManager, getSessionsCount, getUptime, getSystemResources } = deps;
    // GET /api/status - Get system status
    app.get('/', (c) => {
        const tunnelManager = getTunnelManager();
        const response = {
            tunnelUrl: tunnelManager?.getUrl() ?? null,
            tunnelStatus: tunnelManager?.getStatus() ?? 'stopped',
            sessionsCount: getSessionsCount(),
            uptime: getUptime(),
            systemResources: getSystemResources(),
        };
        return c.json(success(response));
    });
    // POST /api/tunnel/restart - Restart tunnel
    app.post('/tunnel/restart', async (c) => {
        const tunnelManager = getTunnelManager();
        if (!tunnelManager) {
            return c.json(error('Tunnel not configured', 'NO_TUNNEL'), 400);
        }
        try {
            tunnelManager.stop();
            const url = await tunnelManager.start();
            log.info('Tunnel restarted', { url });
            return c.json(success({ url }));
        }
        catch (err) {
            log.error('Failed to restart tunnel', { error: String(err) });
            return c.json(error('Failed to restart tunnel', 'TUNNEL_ERROR'), 500);
        }
    });
    // GET /api/status/keys - Get API key configuration status (never exposes values)
    app.get('/keys', (c) => {
        const keys = discoverAPIKeys();
        return c.json(success({ keys }));
    });
    return app;
};
//# sourceMappingURL=system.js.map