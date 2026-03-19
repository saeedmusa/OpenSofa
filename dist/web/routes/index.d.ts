/**
 * OpenSofa Web - Routes Index
 *
 * Aggregates all API routes into a single Hono app.
 */
import { Hono } from 'hono';
import type { SessionManager } from '../../session-manager.js';
import type { AgentRegistry } from '../../agent-registry.js';
import type { TunnelManager } from '../tunnel.js';
export interface RoutesDeps {
    sessionManager: SessionManager;
    agentRegistry: AgentRegistry;
    notifier: import('../notifier.js').Notifier;
    getTunnelManager: () => TunnelManager | null;
    getUptime: () => number;
    getSystemResources: () => {
        cpu: string;
        freeMem: string;
    };
    revokeToken: () => void;
}
export declare const createApiRoutes: (deps: RoutesDeps) => Hono;
//# sourceMappingURL=index.d.ts.map