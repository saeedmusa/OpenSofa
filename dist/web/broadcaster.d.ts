/**
 * OpenSofa Web - Event Broadcaster
 *
 * Manages WebSocket connections and broadcasts events to all connected clients.
 * Pure functions for message creation, class for connection management.
 */
import { WebSocket } from 'ws';
import type { WebSocketEvent, WebSocketEventType } from './types.js';
export interface StoredEvent {
    type: string;
    payload: unknown;
    sessionName?: string;
    sequence: number;
    timestamp: number;
    eventId: string;
}
/**
 * Start periodic pruning. Call this when the server starts.
 */
export declare function startEventPruning(): void;
/**
 * Stop periodic pruning. Call this when the server stops.
 */
export declare function stopEventPruning(): void;
export declare function getEventsSince(sequence: number, sessionName?: string): StoredEvent[];
/**
 * Get the oldest sequence number in the database.
 * Used for catch-up summary when client requests events that have been pruned.
 *
 * @param sessionName - Optional session filter. If provided, returns oldest sequence for that session.
 * @returns The oldest sequence number, or undefined if no events exist.
 */
export declare function getOldestSequence(sessionName?: string): number | undefined;
/**
 * Create a WebSocket event message with sequence number for session tracking
 */
export declare const createEvent: (type: WebSocketEventType, payload: unknown, sessionName?: string) => WebSocketEvent;
/**
 * Serialize event to JSON string
 */
export declare const serializeEvent: (event: WebSocketEvent) => string;
/**
 * Parse incoming WebSocket message
 */
export declare const parseMessage: (data: string) => {
    type: string;
    sessionName?: string;
    payload?: unknown;
} | null;
export interface Broadcaster {
    addClient: (ws: WebSocket, id: string) => void;
    removeClient: (id: string) => void;
    broadcast: (event: WebSocketEvent) => void;
    broadcastToSession: (sessionName: string, event: WebSocketEvent) => void;
    getClientCount: () => number;
    setTerminalSubscription: (clientId: string, sessionName: string | null) => void;
    getClientsWithTerminalSubscription: (sessionName: string) => WebSocket[];
    getEventsSince: (sequence: number, sessionName?: string) => StoredEvent[];
    isUserOffline: () => boolean;
}
export interface BroadcasterDeps {
    onClientMessage?: (clientId: string, message: {
        type: string;
        sessionName?: string;
        payload?: unknown;
    }) => void;
    /** Called when the last WebSocket client disconnects — used to trigger push notification */
    onLastClientDisconnect?: () => void;
}
export declare const createBroadcaster: (deps?: BroadcasterDeps) => Broadcaster;
//# sourceMappingURL=broadcaster.d.ts.map