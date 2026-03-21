/**
 * OpenSofa Web - Templates API Routes
 *
 * REST endpoints for session template management.
 */

import { Hono } from 'hono';
import { createLogger } from '../../utils/logger.js';
import { loadTemplates, upsertTemplate, deleteTemplate, type SessionTemplate } from '../../template-manager.js';
import { success, error } from '../types.js';

const log = createLogger('web:routes:templates');

export const createTemplateRoutes = (): Hono => {
  const app = new Hono();

  // GET /api/templates — list all templates
  app.get('/', async (c) => {
    try {
      const config = await loadTemplates();
      const templates = Object.entries(config.templates).map(([id, tmpl]) => ({
        id,
        ...tmpl,
      }));
      return c.json(success({ templates }));
    } catch (err) {
      log.error('Failed to list templates', { error: String(err) });
      return c.json(success({ templates: [] }));
    }
  });

  // POST /api/templates — create or update a template
  app.post('/', async (c) => {
    let body: { id?: string; name?: string; agent?: string; model?: string; description?: string; mcpServers?: string[] };
    try {
      body = await c.req.json();
    } catch {
      return c.json(error('Invalid JSON body', 'INVALID_BODY'), 400);
    }

    if (!body.id || !body.name || !body.agent) {
      return c.json(error('id, name, and agent are required', 'INVALID_BODY'), 400);
    }

    const template: SessionTemplate = {
      name: body.name,
      agent: body.agent,
      model: body.model,
      description: body.description,
      mcpServers: body.mcpServers,
    };

    try {
      await upsertTemplate(body.id, template);
      log.info('Template saved', { id: body.id });
      return c.json(success({ ok: true, id: body.id }));
    } catch (err) {
      log.error('Failed to save template', { error: String(err) });
      return c.json(error('Failed to save template', 'SAVE_ERROR'), 500);
    }
  });

  // DELETE /api/templates/:id — delete a template
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');

    try {
      const deleted = await deleteTemplate(id);
      if (!deleted) {
        return c.json(error('Template not found', 'NOT_FOUND'), 404);
      }
      log.info('Template deleted', { id });
      return c.json(success({ ok: true }));
    } catch (err) {
      log.error('Failed to delete template', { error: String(err) });
      return c.json(error('Failed to delete template', 'DELETE_ERROR'), 500);
    }
  });

  return app;
};
