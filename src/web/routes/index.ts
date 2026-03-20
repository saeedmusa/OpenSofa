/**
 * OpenSofa Web - Routes Index
 *
 * Aggregates all API routes into a single Hono app.
 */

import { Hono } from 'hono';
import { createSessionsRoutes, type SessionsRoutesDeps } from './sessions.js';
import { createFilesRoutes, type FilesRoutesDeps } from './files.js';
import { createAgentsRoutes, type AgentsRoutesDeps } from './agents.js';
import { createSystemRoutes, type SystemRoutesDeps } from './system.js';
import { createNotificationsRoutes } from './notifications.js';
import { createAdminRoutes } from './admin.js';
import { createBrowseRoutes } from './browse.js';
import { createOpenCodeModelsRoutes } from './opencode-models.js';
import { createModelDiscoveryRoutes } from './model-discovery.js';
import { createTOTPRoutes } from './totp.js';
import type { SessionManager } from '../../session-manager.js';
import type { AgentRegistry } from '../../agent-registry.js';
import type { TunnelManager } from '../tunnel.js';

// ──────────────────────────────────────
// Combined Dependencies
// ──────────────────────────────────────

export interface RoutesDeps {
  sessionManager: SessionManager;
  agentRegistry: AgentRegistry;
  notifier: import('../notifier.js').Notifier;
  getTunnelManager: () => TunnelManager | null;
  getUptime: () => number;
  getSystemResources: () => { cpu: string; freeMem: string };
  revokeToken: () => void;
  token: string;
}

// ──────────────────────────────────────
// Factory - creates all routes
// ──────────────────────────────────────

export const createApiRoutes = (deps: RoutesDeps): Hono => {
  const app = new Hono();

  // Mount sessions routes
  const sessionsDeps: SessionsRoutesDeps = {
    sessionManager: deps.sessionManager,
  };
  app.route('/sessions', createSessionsRoutes(sessionsDeps));

  // Mount files routes (note: files routes include session name in path)
  const filesDeps: FilesRoutesDeps = {
    getSession: (name) => deps.sessionManager.getByName(name) ?? null,
  };
  app.route('/sessions', createFilesRoutes(filesDeps));

  // Mount agents routes
  const agentsDeps: AgentsRoutesDeps = {
    agentRegistry: deps.agentRegistry,
  };
  app.route('/agents', createAgentsRoutes(agentsDeps));

  // Mount browse routes (for directory selection before session creation)
  app.route('/browse', createBrowseRoutes({}));

  // Mount opencode models routes (dynamic model discovery)
  app.route('/opencode', createOpenCodeModelsRoutes());

  // Mount unified model discovery routes
  app.route('/models', createModelDiscoveryRoutes());

  // Mount system routes
  const systemDeps: SystemRoutesDeps = {
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

  // Mount TOTP routes (step-up auth for destructive commands)
  app.route('/totp', createTOTPRoutes(deps.token));

  return app;
};
