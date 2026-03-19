/**
 * OpenSofa Web - Agents API Routes
 *
 * REST endpoints for listing available coding agents.
 */

import { Hono } from 'hono';
import { success, error, type AgentListResponse, type AgentSummary } from '../types.js';
import type { AgentRegistry } from '../../agent-registry.js';
import type { AgentType } from '../../types.js';

// ──────────────────────────────────────
// Factory - creates routes with injected dependencies
// ──────────────────────────────────────

export interface AgentsRoutesDeps {
  agentRegistry: AgentRegistry;
}

export const createAgentsRoutes = (deps: AgentsRoutesDeps): Hono => {
  const app = new Hono();
  const { agentRegistry } = deps;

  // GET /api/agents - List all available agents
  app.get('/', (c) => {
    const definitions = agentRegistry.getAllDefinitions();
    
    const agents: AgentSummary[] = definitions.map(def => ({
      type: def.type,
      displayName: def.displayName,
      installed: agentRegistry.isInstalled(def.type),
      description: def.description,
      knownModels: def.knownModels,
      defaultModel: def.defaultModel,
    }));

    const response: AgentListResponse = { agents };
    return c.json(success(response));
  });

  // GET /api/agents/:type - Get specific agent details
  app.get('/:type', (c) => {
    const type = c.req.param('type') as AgentType;
    
    if (!agentRegistry.isValidType(type)) {
      return c.json(error('Agent type not found', 'NOT_FOUND'), 404);
    }

    const def = agentRegistry.getDefinition(type);
    if (!def) {
      return c.json(error('Agent type not found', 'NOT_FOUND'), 404);
    }

    const agent: AgentSummary = {
      type: def.type,
      displayName: def.displayName,
      installed: agentRegistry.isInstalled(def.type),
      description: def.description,
      knownModels: def.knownModels,
      defaultModel: def.defaultModel,
    };

    return c.json(success(agent));
  });

  return app;
};
