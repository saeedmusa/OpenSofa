/**
 * OpenSofa Web - Sessions API Routes
 *
 * REST endpoints for session management, messaging, and approvals.
 */

import { Hono } from 'hono';
import type { SessionManager } from '../../session-manager.js';
import { AgentAPIClient } from '../../agentapi-client.js';
import type { AgentType } from '../../types.js';
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
  getBroadcaster: () => import('../broadcaster.js').Broadcaster | null;
  createEvent: typeof import('../broadcaster.js').createEvent;
}

export const createSessionsRoutes = (deps: SessionsRoutesDeps): Hono => {
  const app = new Hono();
  const { sessionManager, getBroadcaster, createEvent } = deps;

  // GET /api/sessions - List all sessions (includes creating, active, error, etc.)
  app.get('/', (c) => {
    const sessions = sessionManager.getSessionsList();
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

    // Validate agent type
    const VALID_AGENTS: AgentType[] = ['claude', 'aider', 'goose', 'gemini', 'codex', 'amp', 'opencode', 'copilot', 'cursor', 'auggie', 'amazonq', 'custom'];
    if (!VALID_AGENTS.includes(agent as AgentType)) {
      return c.json(error(`Unknown agent type: ${agent}`, 'INVALID_AGENT'), 400);
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
      // We start the process and return immediately (fire-and-forget with error handling)
      // Synchronous errors (validation, worktree, port) are caught by this try/catch
      // Async errors (spawn, health check) are caught by .catch() and update session status
      sessionManager.createSession(name, dir, agent as AgentType, model || '').catch((err) => {
        const errMsg = err instanceof Error ? err.message : 'Session creation failed';
        log.error('Background session creation failed', { name, error: errMsg });
        // Session status is already updated to 'error' inside createSession()
        // The frontend will see the error on next poll
      });
      
      return c.json(success({
        ok: true,
        message: `Session '${name}' creation started. This may take 30-60 seconds.`,
        session: { name, dir, agent, model: model || '' }
      }), 202);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to create session';
      log.error('Failed to create session', { name, error: errMsg });
      return c.json(error(errMsg, 'CREATE_ERROR'), 500);
    }
  });

  // DELETE /api/sessions/stop-all - Terminate all active sessions
  app.delete('/stop-all', async (c) => {
    try {
      await sessionManager.stopAllSessions();
      log.info('All sessions terminated via web');
      return c.json(success({ ok: true, message: 'All sessions terminated' }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to terminate all sessions';
      log.error('Failed to terminate all sessions', { error: errMsg });
      return c.json(error(errMsg, 'TERMINATE_ERROR'), 500);
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
        // If port is the web port (3285), use the /api/status endpoint.
        // Otherwise, hit the AgentAPI directly.
        const isWebPort = session.port === 3285;
        const statusUrl = isWebPort 
          ? `http://localhost:${session.port}/api/status` 
          : `http://localhost:${session.port}/status`;

        const res = await fetch(statusUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return;

        const body = (await res.json()) as any;
        const status = isWebPort ? body.data?.sessions?.find((s: any) => s.name === session.name)?.status : body.status;
        
        if (!status) return;

        log.debug(`Status sync after reconnect: ${status}`, { session: session.name });

        // Emit a synthetic status_change so session-manager updates agentStatus
        if (status === 'stable') {
          session.agentStatus = 'stable';
        } else if (status === 'running') {
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
      // Intercept slash commands
      const slashResult = await sessionManager.handleSlashCommand(session, body.content);
      if (slashResult) {
        // Broadcast the result to all clients
        const broadcaster = getBroadcaster();
        if (broadcaster) {
          broadcaster.broadcast(createEvent('session_updated', { 
            agentMessage: slashResult 
          }, session.name));
        }
        log.info('Slash command handled via web', { session: name, content: body.content.trim() });
        return c.json(success({ ok: true, message: 'Slash command handled', handled: true }));
      }

      await sessionManager.sendToAgent(session, body.content);
      log.info('Message sent to agent via web', { session: name });
      return c.json(success({ ok: true, message: 'Message sent successfully' }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send message';
      log.error('Failed to send message to agent', { 
        session: name, 
        port: session.port,
        error: errMsg,
        stack: err instanceof Error ? err.stack : undefined 
      });
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

  // Per-agent rejection commands (agentType -> command string)
  const REJECT_COMMANDS: Record<string, string> = {
    claude: 'no\n',
    opencode: 'reject\n',
    aider: 'n\n',
    codex: 'no\n',
    gemini: 'no\n',
    goose: 'no\n',
    amp: 'no\n',
    cursor: 'no\n',
    auggie: 'no\n',
    amazonq: 'no\n',
    copilot: 'no\n',
  };

  function getRejectCommand(agentType: string): string {
    return REJECT_COMMANDS[agentType.toLowerCase()] || 'no\n';
  }

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
      // Send per-agent rejection keystroke
      const client = new AgentAPIClient(session.port);
      const rejectCmd = getRejectCommand(session.agentType);
      await client.sendRaw(rejectCmd);
      log.info('Rejection sent via web', { session: name, command: rejectCmd.trim() });
      return c.json(success({ ok: true, message: 'Rejected' }));
    } catch (err) {
      log.error('Failed to send rejection', { session: name, error: String(err) });
      return c.json(error('Failed to send rejection', 'REJECT_ERROR'), 500);
    }
  });

  // PATCH /api/sessions/:name - Update session settings
  app.patch('/:name', async (c) => {
    const name = c.req.param('name');
    const session = sessionManager.getByName(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    try {
      const body = await c.req.json() as Record<string, unknown>;
      const updatable = ['autoApprove'] as const;
      const updates: Record<string, unknown> = {};

      for (const key of updatable) {
        if (key in body) {
          updates[key] = body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return c.json(error('No valid fields to update', 'INVALID_REQUEST'), 400);
      }

      // Apply updates to session
      Object.assign(session, updates);
      log.info('Session settings updated', { session: name, updates });
      return c.json(success({ ok: true, updates }));
    } catch (err) {
      log.error('Failed to update session', { session: name, error: String(err) });
      return c.json(error('Failed to update session', 'UPDATE_ERROR'), 500);
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

  // POST /api/sessions/:name/model - Switch model mid-session
  app.post('/:name/model', async (c) => {
    const name = c.req.param('name');
    const session = sessionManager.getByName(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    let body: { model?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(error('Invalid JSON body', 'INVALID_BODY'), 400);
    }

    if (!body.model || typeof body.model !== 'string') {
      return c.json(error('model is required and must be a string', 'INVALID_BODY'), 400);
    }

    try {
      // switchSessionAgent expects "agent model" format, but this endpoint only switches model
      // Construct the value with the current agent type + new model
      const switchValue = `${session.agentType} ${body.model}`;
      await sessionManager.switchSessionAgent(session, switchValue);
      const updated = sessionManager.getByName(name);
      if (!updated) {
        return c.json(error('Session disappeared after model switch', 'INTERNAL'), 500);
      }
      log.info('Model switched via web', { session: name, model: body.model });
      return c.json(success({ ok: true, model: body.model, session: sessionToDetail(updated) }));
    } catch (err) {
      log.error('Failed to switch model', { session: name, error: String(err) });
      return c.json(error('Failed to switch model', 'SWITCH_ERROR'), 500);
    }
  });

  return app;
};
