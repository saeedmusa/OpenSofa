/**
 * OpenSofa Web - System API Routes
 *
 * REST endpoints for system status, configuration, and tunnel management.
 */

import { Hono } from 'hono';
import { success, error, type SystemStatusResponse, type TunnelStatus } from '../types.js';
import type { TunnelManager } from '../tunnel.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('web:routes:system');

// ──────────────────────────────────────
// Factory - creates routes with injected dependencies
// ──────────────────────────────────────

export interface SystemRoutesDeps {
  getTunnelManager: () => TunnelManager | null;
  getSessionsCount: () => number;
  getUptime: () => number;
  getSystemResources: () => { cpu: string; freeMem: string };
}

export const createSystemRoutes = (deps: SystemRoutesDeps): Hono => {
  const app = new Hono();
  const { getTunnelManager, getSessionsCount, getUptime, getSystemResources } = deps;

  // GET /api/status - Get system status
  app.get('/', (c) => {
    const tunnelManager = getTunnelManager();
    const response: SystemStatusResponse = {
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
    } catch (err) {
      log.error('Failed to restart tunnel', { error: String(err) });
      return c.json(error('Failed to restart tunnel', 'TUNNEL_ERROR'), 500);
    }
  });

  return app;
};
