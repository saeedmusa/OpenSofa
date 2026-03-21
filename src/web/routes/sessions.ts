/**
 * OpenSofa Web - Sessions API Routes
 *
 * REST endpoints for session management, messaging, and approvals.
 */

import { Hono } from 'hono';
import type { SessionManager } from '../../session-manager.js';
import { AgentAPIClient } from '../../agentapi-client.js';
import {
  success,
  error,
  sessionToSummary,
  sessionToDetail,
  type SessionListResponse,
  type SessionDetailResponse,
  type SendMessageRequest,
} from '../types.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('web:routes:sessions');

// ──────────────────────────────────────
// Factory - creates routes with injected dependencies
// ──────────────────────────────────────

export interface SessionsRoutesDeps {
  sessionManager: SessionManager;
}

export const createSessionsRoutes = (deps: SessionsRoutesDeps): Hono => {
  const app = new Hono();
  const { sessionManager } = deps;

  // GET /api/sessions - List all sessions
  app.get('/', (c) => {
    const sessions = sessionManager.getActiveSessions();
    const response: SessionListResponse = {
      sessions: sessions.map(sessionToSummary),
    };
    return c.json(success(response));
  });

  // POST /api/sessions - Create a new session
  app.post('/', async (c) => {
    let body: { name?: string; dir?: string; agent?: string; model?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(error('Invalid JSON body', 'BAD_REQUEST'), 400);
    }
    const { name, dir, agent, model } = body;

    if (!name || typeof name !== 'string') {
      return c.json(error('name is required and must be a string', 'INVALID_BODY'), 400);
    }
    if (!dir || typeof dir !== 'string') {
      return c.json(error('dir is required and must be a string', 'INVALID_BODY'), 400);
    }
    if (!agent || typeof agent !== 'string') {
      return c.json(error('agent is required and must be a string', 'INVALID_BODY'), 400);
    }

    // Validate session name
    if (!/^[a-zA-Z0-9-]{1,30}$/.test(name)) {
      return c.json(error('Session name must be 1-30 characters (letters, numbers, hyphens only)', 'INVALID_NAME'), 400);
    }

    // Check if session already exists
    if (sessionManager.getByName(name)) {
      return c.json(error(`Session '${name}' already exists`, 'SESSION_EXISTS'), 409);
    }

    try {
      // Create session asynchronously - this may take 30-60 seconds
      // We start the process and return immediately
      sessionManager.createSession(name, dir, agent as any, model || '');
      
      return c.json(success({
        ok: true,
        message: `Session '${name}' creation started. This may take 30-60 seconds.`,
        session: { name, dir, agent, model: model || '' }
      }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to create session';
      log.error('Failed to create session', { name, error: errMsg });
      return c.json(error(errMsg, 'CREATE_ERROR'), 500);
    }
  });

  // GET /api/sessions/:name - Get session details
  app.get('/:name', (c) => {
    const name = c.req.param('name');
    const session = sessionManager.getByName(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    return c.json(success(sessionToDetail(session)));
  });

  // POST /api/sessions/:name/message - Send message to agent
  app.post('/:name/message', async (c) => {
    const name = c.req.param('name');
    const session = sessionManager.getByName(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    let body: SendMessageRequest;
    try {
      body = await c.req.json<SendMessageRequest>();
    } catch {
      return c.json(error('Invalid JSON body', 'INVALID_BODY'), 400);
    }

    if (!body.content || typeof body.content !== 'string') {
      return c.json(error('content is required and must be a string', 'INVALID_BODY'), 400);
    }

    // Check if agent is busy - verify with live status first
    // Only block if live API check confirms running status
    if (session.agentStatus === 'running') {
      try {
        const client = new AgentAPIClient(session.port);
        const liveStatus = await client.getStatus(2000);
        if (liveStatus.status === 'stable') {
          session.agentStatus = 'stable';
        } else if (liveStatus.status === 'running') {
          // Agent is truly busy - let the message queue
          // Don't block - messages will be queued by agentapi
          log.debug('Agent is running, message will be queued', { session: name });
        }
      } catch {
        // Can't reach API quickly, allow message through
        // Better to allow than to block incorrectly
        log.debug('Could not verify agent status, allowing message', { session: name });
      }
    }

    // Block only if pending approval
    if (session.pendingApproval) {
      return c.json(error('There is a pending approval. Approve or reject first.', 'PENDING_APPROVAL'), 409);
    }

    try {
      await sessionManager.sendToAgent(session, body.content);
      log.info('Message sent to agent via web', { session: name });
      return c.json(success({ ok: true, message: 'Message sent successfully' }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send message';
      log.error('Failed to send message', { session: name, error: errMsg });
      return c.json(error(errMsg, 'SEND_ERROR'), 500);
    }
  });

  // POST /api/sessions/:name/approve - Approve pending action
  app.post('/:name/approve', async (c) => {
    const name = c.req.param('name');
    const session = sessionManager.getByName(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    if (!session.pendingApproval) {
      return c.json(error('No pending approval request', 'NO_PENDING'), 400);
    }

    try {
      // Send raw approval keystroke
      const client = new AgentAPIClient(session.port);
      await client.sendRaw('yes\n');
      log.info('Approval sent via web', { session: name });
      return c.json(success({ ok: true, message: 'Approved' }));
    } catch (err) {
      log.error('Failed to send approval', { session: name, error: String(err) });
      return c.json(error('Failed to send approval', 'APPROVE_ERROR'), 500);
    }
  });

  // POST /api/sessions/:name/reject - Reject pending action
  app.post('/:name/reject', async (c) => {
    const name = c.req.param('name');
    const session = sessionManager.getByName(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    if (!session.pendingApproval) {
      return c.json(error('No pending approval request', 'NO_PENDING'), 400);
    }

    try {
      // Send raw rejection keystroke
      const client = new AgentAPIClient(session.port);
      await client.sendRaw('no\n');
      log.info('Rejection sent via web', { session: name });
      return c.json(success({ ok: true, message: 'Rejected' }));
    } catch (err) {
      log.error('Failed to send rejection', { session: name, error: String(err) });
      return c.json(error('Failed to send rejection', 'REJECT_ERROR'), 500);
    }
  });

  // DELETE /api/sessions/:name - Stop session
  app.delete('/:name', async (c) => {
    const name = c.req.param('name');
    const session = sessionManager.getByName(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    try {
      await sessionManager.stopSession(name);
      log.info('Session stopped via web', { session: name });
      return c.json(success({ ok: true, message: 'Session stopped' }));
    } catch (err) {
      log.error('Failed to stop session', { session: name, error: String(err) });
      return c.json(error('Failed to stop session', 'STOP_ERROR'), 500);
    }
  });

  // GET /api/sessions/:name/messages - Get message history
  app.get('/:name/messages', async (c) => {
    const name = c.req.param('name');
    const session = sessionManager.getByName(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    try {
      const client = new AgentAPIClient(session.port);
      const { messages } = await client.getMessages();
      return c.json(success({ messages }));
    } catch (err) {
      log.warn('Failed to get messages from AgentAPI', { session: name, error: String(err) });
      return c.json(success({ messages: [] }));
    }
  });

  // POST /api/sessions/:name/restart - Restart a stopped or errored session
  app.post('/:name/restart', async (c) => {
    const name = c.req.param('name');
    const session = sessionManager.getByName(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    if (session.status === 'active' || session.status === 'creating') {
      return c.json(error('Session is already running', 'INVALID_STATE'), 400);
    }

    try {
      await sessionManager.restartSession(name);
      const updated = sessionManager.getByName(name);
      if (!updated) {
        return c.json(error('Session disappeared after restart', 'INTERNAL'), 500);
      }
      return c.json(success(sessionToDetail(updated)));
    } catch (err) {
      log.error('Failed to restart session', { session: name, error: String(err) });
      return c.json(error('Failed to restart session', 'RESTART_ERROR'), 500);
    }
  });

  return app;
};
