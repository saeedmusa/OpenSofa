/**
 * OpenSofa Web - Sessions API Routes
 *
 * REST endpoints for session management, messaging, and approvals.
 */
import { Hono } from 'hono';
import type { SessionManager } from '../../session-manager.js';
export interface SessionsRoutesDeps {
    sessionManager: SessionManager;
}
export declare const createSessionsRoutes: (deps: SessionsRoutesDeps) => Hono;
//# sourceMappingURL=sessions.d.ts.map