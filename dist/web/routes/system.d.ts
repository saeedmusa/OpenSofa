/**
 * OpenSofa Web - System API Routes
 *
 * REST endpoints for system status, configuration, and tunnel management.
 */
import { Hono } from 'hono';
import type { TunnelManager } from '../tunnel.js';
export interface SystemRoutesDeps {
    getTunnelManager: () => TunnelManager | null;
    getSessionsCount: () => number;
    getUptime: () => number;
    getSystemResources: () => {
        cpu: string;
        freeMem: string;
    };
}
export declare const createSystemRoutes: (deps: SystemRoutesDeps) => Hono;
//# sourceMappingURL=system.d.ts.map