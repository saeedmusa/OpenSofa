import Database from 'better-sqlite3';
import { getDbPath } from './utils/expand-path.js';
import { createLogger } from './utils/logger.js';
const log = createLogger('db');
let _db = null;
function initSchema(database) {
    try {
        database.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vapid_keys (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        publicKey TEXT NOT NULL,
        privateKey TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        session_name TEXT,
        sequence INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        event_id TEXT
      );

      CREATE TABLE IF NOT EXISTS ip_bans (
        ip_address TEXT PRIMARY KEY,
        banned_until INTEGER NOT NULL,
        strike_count INTEGER NOT NULL DEFAULT 0,
        last_strike INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_activity_events_session ON activity_events(session_name);
      CREATE INDEX IF NOT EXISTS idx_activity_events_sequence ON activity_events(sequence);

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
        try {
            database.exec('ALTER TABLE activity_events ADD COLUMN event_id TEXT;');
            log.info('Database migration: added event_id column to activity_events');
        }
        catch (e) {
            const err = e;
            if (!err.message.includes('duplicate column name')) {
                log.error('Database migration failed for event_id', { error: err.message });
            }
        }
        log.info('Database initialized with WAL mode');
    }
    catch (error) {
        log.error('Failed to initialize database schema', { error: String(error) });
    }
}
export function getDb() {
    if (!_db) {
        const dbPath = getDbPath();
        _db = new Database(dbPath);
        _db.pragma('journal_mode = WAL');
        initSchema(_db);
    }
    return _db;
}
// Backward-compatible export: lazy getter via Proxy
export const db = new Proxy({}, {
    get(_target, prop, receiver) {
        return Reflect.get(getDb(), prop, receiver);
    },
});
export function closeDb() {
    if (_db) {
        _db.close();
        _db = null;
    }
}
//# sourceMappingURL=db.js.map