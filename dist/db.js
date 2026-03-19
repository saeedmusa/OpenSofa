import Database from 'better-sqlite3';
import { getDbPath } from './utils/expand-path.js';
import { createLogger } from './utils/logger.js';
const log = createLogger('db');
const dbPath = getDbPath();
export const db = new Database(dbPath);
// Enable WAL mode for concurrent read/writes
db.pragma('journal_mode = WAL');
// Initialize schema
try {
    db.exec(`
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
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ip_bans (
      ip_address TEXT PRIMARY KEY,
      banned_until INTEGER NOT NULL,
      strike_count INTEGER NOT NULL DEFAULT 0,
      last_strike INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_events_session ON activity_events(session_name);
    CREATE INDEX IF NOT EXISTS idx_activity_events_sequence ON activity_events(sequence);
  `);
    try {
        db.exec('ALTER TABLE activity_events ADD COLUMN event_id TEXT;');
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
//# sourceMappingURL=db.js.map