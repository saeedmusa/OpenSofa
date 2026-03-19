/**
 * OpenSofa Web - Agents API Routes
 *
 * REST endpoints for listing available coding agents.
 */
import { Hono } from 'hono';
import type { AgentRegistry } from '../../agent-registry.js';
export interface AgentsRoutesDeps {
    agentRegistry: AgentRegistry;
}
export declare const createAgentsRoutes: (deps: AgentsRoutesDeps) => Hono;
//# sourceMappingURL=agents.d.ts.map