/**
 * OpenSofa Web - MCP API Routes
 *
 * REST endpoints for MCP server discovery (read-only).
 */

import { Hono } from 'hono';
import { createLogger } from '../../utils/logger.js';
import { discoverMCPServers, addMCPServer, removeMCPServer } from '../../discovery/mcp-discovery.js';
import { discoverTools } from '../../discovery/mcp-tool-discovery.js';
import { success, error } from '../types.js';

const log = createLogger('web:routes:mcp');

export const createMCPRoutes = (): Hono => {
  const app = new Hono();

  // GET /api/mcp/servers - List all discovered MCP servers
  app.get('/servers', async (c) => {
    try {
      const servers = await discoverMCPServers();
      return c.json(success({ servers }));
    } catch (err) {
      log.error('MCP discovery failed', { error: String(err) });
      return c.json(success({ servers: [] }));
    }
  });

  // POST /api/mcp/servers/:agent/:name/tools - Discover tools for a specific server (on-demand)
  app.post('/servers/:agent/:name/tools', async (c) => {
    const agent = c.req.param('agent');
    const name = c.req.param('name');

    try {
      const servers = await discoverMCPServers();
      const server = servers.find(s => s.agent === agent && s.name === name);

      if (!server) {
        return c.json(error('MCP server not found', 'NOT_FOUND'), 404);
      }

      const result = await discoverTools(server);
      return c.json(success(result));
    } catch (err) {
      log.error('Tool discovery failed', { agent, name, error: String(err) });
      return c.json(error('Tool discovery failed', 'DISCOVERY_ERROR'), 500);
    }
  });

  // POST /api/mcp/servers - Add a new MCP server
  app.post('/servers', async (c) => {
    let body: { agent?: string; name?: string; command?: string; args?: string[]; url?: string; env?: Record<string, string> };
    try {
      body = await c.req.json();
    } catch {
      return c.json(error('Invalid JSON body', 'INVALID_BODY'), 400);
    }

    if (!body.agent || !body.name) {
      return c.json(error('agent and name are required', 'INVALID_BODY'), 400);
    }

    if (!body.command && !body.url) {
      return c.json(error('command or url is required', 'INVALID_BODY'), 400);
    }

    try {
      await addMCPServer(body.agent, body.name, {
        command: body.command,
        args: body.args,
        url: body.url,
        env: body.env,
      });
      log.info('MCP server added via API', { agent: body.agent, name: body.name });
      return c.json(success({ ok: true }));
    } catch (err) {
      log.error('Failed to add MCP server', { error: String(err) });
      return c.json(error('Failed to add MCP server', 'ADD_ERROR'), 500);
    }
  });

  // DELETE /api/mcp/servers/:agent/:name - Remove an MCP server
  app.delete('/servers/:agent/:name', async (c) => {
    const agent = c.req.param('agent');
    const name = c.req.param('name');

    try {
      await removeMCPServer(agent, name);
      log.info('MCP server removed via API', { agent, name });
      return c.json(success({ ok: true }));
    } catch (err) {
      log.error('Failed to remove MCP server', { agent, name, error: String(err) });
      return c.json(error('Failed to remove MCP server', 'REMOVE_ERROR'), 500);
    }
  });

  return app;
};
