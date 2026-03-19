/**
 * OpenSofa Web - Event Broadcaster
 *
 * Manages WebSocket connections and broadcasts events to all connected clients.
 * Pure functions for message creation, class for connection management.
 */
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger.js';
import { db } from '../db.js';
const log = createLogger('web:broadcaster');
const MAX_HISTORY_PER_SESSION = 2000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
// Periodic pruning timer
let pruneTimer = null;
/**
 * Periodic pruning function that runs every 5 minutes.
 * Cleans up old events beyond MAX_HISTORY_PER_SESSION for each session.
 * Also cleans up old global events (those without session_name).
 */
function pruneOldEvents() {
    try {
        // Prune per-session events
        const sessionStmt = db.prepare(`
      SELECT session_name, COUNT(*) as cnt 
      FROM activity_events 
      WHERE session_name IS NOT NULL 
      GROUP BY session_name 
      HAVING cnt > ?
    `);
        const overLimitSessions = sessionStmt.all(MAX_HISTORY_PER_SESSION);
        for (const row of overLimitSessions) {
            // Delete oldest events beyond the limit
            const deleteStmt = db.prepare(`
        DELETE FROM activity_events 
        WHERE session_name = ?
        AND sequence < (
          SELECT MIN(sequence) FROM (
            SELECT sequence FROM activity_events 
            WHERE session_name = ?
            ORDER BY sequence DESC
            LIMIT 1 OFFSET ?
          )
        )
      `);
            deleteStmt.run(row.session_name, row.session_name, MAX_HISTORY_PER_SESSION);
        }
        // Also prune global events (keep last MAX_HISTORY_PER_SESSION)
        const globalCountStmt = db.prepare(`
      SELECT COUNT(*) as cnt FROM activity_events WHERE session_name IS NULL
    `);
        const globalCount = globalCountStmt.get().cnt;
        if (globalCount > MAX_HISTORY_PER_SESSION) {
            const deleteGlobalStmt = db.prepare(`
        DELETE FROM activity_events 
        WHERE session_name IS NULL
        AND sequence < (
          SELECT MIN(sequence) FROM (
            SELECT sequence FROM activity_events 
            WHERE session_name IS NULL
            ORDER BY sequence DESC
            LIMIT 1 OFFSET ?
          )
        )
      `);
            deleteGlobalStmt.run(MAX_HISTORY_PER_SESSION);
        }
        log.debug('Periodic pruning completed', { sessionsPruned: overLimitSessions.length });
    }
    catch (err) {
        log.error('Failed to prune old events', { error: String(err) });
    }
}
/**
 * Start periodic pruning. Call this when the server starts.
 */
export function startEventPruning() {
    if (pruneTimer)
        return;
    pruneTimer = setInterval(pruneOldEvents, PRUNE_INTERVAL_MS);
    log.info('Event pruning started', { intervalMs: PRUNE_INTERVAL_MS });
}
/**
 * Stop periodic pruning. Call this when the server stops.
 */
export function stopEventPruning() {
    if (pruneTimer) {
        clearInterval(pruneTimer);
        pruneTimer = null;
        log.info('Event pruning stopped');
    }
}
// Initialize sequence counter from DB on startup
let globalSequence = 0;
function initSequenceFromDB() {
    try {
        const row = db.prepare('SELECT MAX(sequence) as maxSeq FROM activity_events').get();
        globalSequence = row?.maxSeq || 0;
        log.info('Initialized global sequence from DB', { sequence: globalSequence });
    }
    catch {
        globalSequence = 0;
    }
}
// Call on module load
initSequenceFromDB();
function addToHistory(event) {
    try {
        const stmt = db.prepare('INSERT INTO activity_events (type, payload, session_name, sequence, timestamp, event_id) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run(event.type, JSON.stringify(event.payload), event.sessionName || null, event.sequence, event.timestamp, event.eventId);
    }
    catch (err) {
        log.error('Failed to persist event to SQLite', { error: String(err) });
    }
}
export function getEventsSince(sequence, sessionName) {
    try {
        let query = 'SELECT type, payload, session_name, sequence, timestamp, event_id FROM activity_events WHERE sequence > ?';
        const params = [sequence];
        if (sessionName) {
            query += ' AND session_name = ?';
            params.push(sessionName);
        }
        query += ' ORDER BY sequence ASC LIMIT 500';
        const stmt = db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map(row => ({
            type: row.type,
            payload: JSON.parse(row.payload),
            sessionName: row.session_name || undefined,
            sequence: row.sequence,
            timestamp: row.timestamp,
            eventId: row.event_id || `legacy-${row.sequence}`,
        }));
    }
    catch (err) {
        log.error('Failed to get events from SQLite', { error: String(err) });
        return [];
    }
}
/**
 * Get the oldest sequence number in the database.
 * Used for catch-up summary when client requests events that have been pruned.
 *
 * @param sessionName - Optional session filter. If provided, returns oldest sequence for that session.
 * @returns The oldest sequence number, or undefined if no events exist.
 */
export function getOldestSequence(sessionName) {
    try {
        let query = 'SELECT MIN(sequence) as minSeq FROM activity_events';
        const params = [];
        if (sessionName) {
            query += ' WHERE session_name = ?';
            params.push(sessionName);
        }
        const stmt = db.prepare(query);
        const row = params.length > 0
            ? stmt.get(...params)
            : stmt.get();
        return row?.minSeq ?? undefined;
    }
    catch (err) {
        log.error('Failed to get oldest sequence', { error: String(err), sessionName });
        return undefined;
    }
}
// ──────────────────────────────────────
// Per-Session Sequence Tracking
// ──────────────────────────────────────
const sessionSequences = new Map();
/**
 * Get the next sequence number for a session
 */
const getNextSequence = (sessionName) => {
    const current = sessionSequences.get(sessionName) || globalSequence;
    const next = current + 1;
    sessionSequences.set(sessionName, next);
    // Update global sequence
    globalSequence = next;
    return next;
};
// ──────────────────────────────────────
// Pure Functions (Message Creation)
// ──────────────────────────────────────
/**
 * Create a WebSocket event message with sequence number for session tracking
 */
export const createEvent = (type, payload, sessionName) => {
    // Use 'global' as the session key if no sessionName provided
    const seqKey = sessionName || 'global';
    const sequence = getNextSequence(seqKey);
    const eventId = randomUUID();
    const event = {
        type,
        sessionName,
        payload,
        timestamp: Date.now(),
        sequence,
        eventId,
    };
    // Store in history for sync
    addToHistory({
        type,
        payload,
        sessionName,
        sequence,
        timestamp: event.timestamp,
        eventId,
    });
    return event;
};
/**
 * Serialize event to JSON string
 */
export const serializeEvent = (event) => {
    return JSON.stringify(event);
};
/**
 * Parse incoming WebSocket message
 */
export const parseMessage = (data) => {
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
};
export const createBroadcaster = (deps) => {
    const clients = new Map();
    const addClient = (ws, id) => {
        clients.set(id, {
            ws,
            id,
            connectedAt: Date.now(),
            terminalSubscription: null,
        });
        ws.on('message', (data) => {
            const message = parseMessage(data.toString());
            if (message && deps?.onClientMessage) {
                deps.onClientMessage(id, message);
            }
        });
        ws.on('close', () => {
            removeClient(id);
        });
        log.debug('Client connected', { clientId: id, totalClients: clients.size });
    };
    const removeClient = (id) => {
        const client = clients.get(id);
        if (client) {
            clients.delete(id);
            log.debug('Client disconnected', { clientId: id, totalClients: clients.size });
            // A7: Push on last disconnect — notify via push when all clients gone
            if (clients.size === 0 && deps?.onLastClientDisconnect) {
                log.info('Last client disconnected, triggering push notification');
                deps.onLastClientDisconnect();
            }
        }
    };
    const broadcast = (event) => {
        const message = serializeEvent(event);
        let sent = 0;
        let failed = 0;
        for (const [id, client] of clients) {
            if (client.ws.readyState === WebSocket.OPEN) {
                try {
                    client.ws.send(message);
                    sent++;
                }
                catch (err) {
                    log.warn('Failed to send to client', { clientId: id, error: String(err) });
                    failed++;
                }
            }
            else {
                failed++;
            }
        }
        if (sent > 0 || failed > 0) {
            log.debug('Broadcast complete', { event: event.type, sent, failed });
        }
    };
    const broadcastToSession = (sessionName, event) => {
        const message = serializeEvent(event);
        let sent = 0;
        for (const [, client] of clients) {
            if (client.ws.readyState === WebSocket.OPEN &&
                client.terminalSubscription === sessionName) {
                try {
                    client.ws.send(message);
                    sent++;
                }
                catch (err) {
                    log.warn('Failed to send to client', { error: String(err) });
                }
            }
        }
        log.debug('Session broadcast complete', {
            session: sessionName,
            event: event.type,
            sent
        });
    };
    const getClientCount = () => clients.size;
    const setTerminalSubscription = (clientId, sessionName) => {
        const client = clients.get(clientId);
        if (client) {
            client.terminalSubscription = sessionName;
            log.debug('Terminal subscription updated', { clientId, sessionName });
        }
    };
    const getClientsWithTerminalSubscription = (sessionName) => {
        const result = [];
        for (const [, client] of clients) {
            if (client.terminalSubscription === sessionName) {
                result.push(client.ws);
            }
        }
        return result;
    };
    const isUserOffline = () => clients.size === 0;
    return {
        addClient,
        removeClient,
        broadcast,
        broadcastToSession,
        getClientCount,
        setTerminalSubscription,
        getClientsWithTerminalSubscription,
        getEventsSince,
        isUserOffline,
    };
};
//# sourceMappingURL=broadcaster.js.map