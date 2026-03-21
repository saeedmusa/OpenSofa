/**
 * OpenSofa Web - Conversations API Routes
 *
 * REST endpoints for persisted conversation history.
 */

import { Hono } from 'hono';
import { createLogger } from '../../utils/logger.js';
import { getDb } from '../../db.js';
import { success } from '../types.js';

const log = createLogger('web:routes:conversations');

export const createConversationRoutes = (): Hono => {
  const app = new Hono();

  // GET /api/conversations — list past conversations grouped by session
  app.get('/', (c) => {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT
          session_name,
          COUNT(*) as message_count,
          MAX(timestamp) as last_activity,
          MIN(timestamp) as first_activity
        FROM conversations
        GROUP BY session_name
        ORDER BY last_activity DESC
        LIMIT 20
      `).all() as Array<{
        session_name: string;
        message_count: number;
        last_activity: number;
        first_activity: number;
      }>;

      const conversations = rows.map(row => ({
        sessionName: row.session_name,
        messageCount: row.message_count,
        lastActivity: row.last_activity,
        firstActivity: row.first_activity,
      }));

      return c.json(success({ conversations }));
    } catch (err) {
      log.error('Failed to list conversations', { error: String(err) });
      return c.json(success({ conversations: [] }));
    }
  });

  // GET /api/conversations/:sessionName — get messages for a past session
  app.get('/:sessionName', (c) => {
    const sessionName = c.req.param('sessionName');

    try {
      const db = getDb();
      const messages = db.prepare(`
        SELECT id, session_name, agent_message_id, role, content, timestamp
        FROM conversations
        WHERE session_name = ?
        ORDER BY timestamp ASC
      `).all(sessionName) as Array<{
        id: number;
        session_name: string;
        agent_message_id: number | null;
        role: string;
        content: string;
        timestamp: number;
      }>;

      return c.json(success({
        sessionName,
        messages: messages.map(m => ({
          id: m.agent_message_id ?? m.id,
          content: m.content,
          role: m.role,
          time: new Date(m.timestamp * 1000).toISOString(),
        })),
      }));
    } catch (err) {
      log.error('Failed to get conversation', { sessionName, error: String(err) });
      return c.json(success({ sessionName, messages: [] }));
    }
  });

  return app;
};

/**
 * Persist a message to the conversations table.
 * Uses INSERT (not upsert) since message_update events stream deltas.
 */
export function persistMessage(
  sessionName: string,
  agentMessageId: number | null,
  role: 'user' | 'agent',
  content: string,
  timestamp?: number,
): void {
  try {
    const db = getDb();
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO conversations (session_name, agent_message_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionName, agentMessageId, role, content, ts);
  } catch (err) {
    log.warn('Failed to persist message', { sessionName, error: String(err) });
  }
}

/**
 * Prune conversations older than given days.
 */
export function pruneOldConversations(retentionDays: number = 30): number {
  try {
    const db = getDb();
    const cutoff = Math.floor(Date.now() / 1000) - (retentionDays * 86400);
    const result = db.prepare('DELETE FROM conversations WHERE timestamp < ?').run(cutoff);
    if (result.changes > 0) {
      log.info('Pruned old conversations', { deleted: result.changes, retentionDays });
    }
    return result.changes;
  } catch (err) {
    log.warn('Failed to prune conversations', { error: String(err) });
    return 0;
  }
}
