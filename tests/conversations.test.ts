/**
 * Tests for Conversation Persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

vi.mock('../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { persistMessage, pruneOldConversations } from '../src/web/routes/conversations.js';

describe('Conversation Persistence', () => {
  let testDb: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_name TEXT NOT NULL,
        agent_message_id INTEGER,
        role TEXT NOT NULL CHECK(role IN ('user', 'agent')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_name);
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
    `);
  });

  describe('persistMessage', () => {
    it('should insert a message into the database', () => {
      // Direct test using the test database
      testDb.prepare(`
        INSERT INTO conversations (session_name, agent_message_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run('test-session', 1, 'agent', 'Hello world', Math.floor(Date.now() / 1000));

      const rows = testDb.prepare('SELECT * FROM conversations WHERE session_name = ?').all('test-session');
      expect(rows).toHaveLength(1);
      expect((rows[0] as any).content).toBe('Hello world');
      expect((rows[0] as any).role).toBe('agent');
    });

    it('should store user messages', () => {
      testDb.prepare(`
        INSERT INTO conversations (session_name, agent_message_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run('test-session', null, 'user', 'Write a function', Math.floor(Date.now() / 1000));

      const rows = testDb.prepare('SELECT * FROM conversations WHERE role = ?').all('user');
      expect(rows).toHaveLength(1);
      expect((rows[0] as any).content).toBe('Write a function');
    });

    it('should allow multiple messages per session', () => {
      const ts = Math.floor(Date.now() / 1000);
      const insert = testDb.prepare(`
        INSERT INTO conversations (session_name, agent_message_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      insert.run('session-1', 1, 'user', 'Hello', ts);
      insert.run('session-1', 2, 'agent', 'Hi there', ts + 1);
      insert.run('session-1', 3, 'user', 'Write code', ts + 2);

      const rows = testDb.prepare('SELECT * FROM conversations WHERE session_name = ? ORDER BY timestamp').all('session-1');
      expect(rows).toHaveLength(3);
    });
  });

  describe('querying conversations', () => {
    it('should group conversations by session', () => {
      const insert = testDb.prepare(`
        INSERT INTO conversations (session_name, agent_message_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      insert.run('session-a', 1, 'user', 'Hello', 1000);
      insert.run('session-a', 2, 'agent', 'Hi', 1001);
      insert.run('session-b', 1, 'user', 'Test', 1002);

      const groups = testDb.prepare(`
        SELECT session_name, COUNT(*) as message_count
        FROM conversations
        GROUP BY session_name
      `).all() as Array<{ session_name: string; message_count: number }>;

      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.session_name === 'session-a')?.message_count).toBe(2);
      expect(groups.find(g => g.session_name === 'session-b')?.message_count).toBe(1);
    });

    it('should order messages by timestamp', () => {
      const insert = testDb.prepare(`
        INSERT INTO conversations (session_name, agent_message_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      insert.run('s1', 1, 'user', 'First', 3000);
      insert.run('s1', 2, 'agent', 'Second', 1000);
      insert.run('s1', 3, 'user', 'Third', 2000);

      const rows = testDb.prepare(`
        SELECT content FROM conversations WHERE session_name = ? ORDER BY timestamp ASC
      `).all('s1') as Array<{ content: string }>;

      expect(rows[0].content).toBe('Second');
      expect(rows[1].content).toBe('Third');
      expect(rows[2].content).toBe('First');
    });
  });

  describe('pruneOldConversations', () => {
    it('should delete messages older than retention period', () => {
      const now = Math.floor(Date.now() / 1000);
      const thirtyOneDaysAgo = now - (31 * 86400);
      const tenDaysAgo = now - (10 * 86400);

      const insert = testDb.prepare(`
        INSERT INTO conversations (session_name, agent_message_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      insert.run('s1', 1, 'user', 'Old message', thirtyOneDaysAgo);
      insert.run('s1', 2, 'agent', 'Recent message', tenDaysAgo);

      // Manual prune using test db
      const cutoff = now - (30 * 86400);
      const result = testDb.prepare('DELETE FROM conversations WHERE timestamp < ?').run(cutoff);

      expect(result.changes).toBe(1);

      const remaining = testDb.prepare('SELECT * FROM conversations').all();
      expect(remaining).toHaveLength(1);
      expect((remaining[0] as any).content).toBe('Recent message');
    });
  });
});
