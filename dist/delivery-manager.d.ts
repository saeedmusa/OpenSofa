/**
 * OpenSofa - Delivery Manager
 *
 * Queues FeedbackEvents and delivers them to WhatsApp.
 * One instance per active session.
 * Based on LOW_LEVEL_DESIGN.md §9
 */
import type { OpenSofaConfig, Session, FeedbackEvent, WhatsAppOutbound } from './types.js';
import type { WhatsAppHandler } from './whatsapp-handler.js';
/**
 * Delivery Manager class
 * One instance per session - owns delivery queue
 */
export declare class DeliveryManager {
    private session;
    private whatsApp;
    private config;
    private queue;
    private delivering;
    private debounceTimer;
    private heartbeatTimer;
    private lastDeliveryAt;
    private lastHeartbeatAt;
    private lastFullContent;
    private destroyed;
    constructor(session: Session, whatsApp: WhatsAppHandler, config: OpenSofaConfig);
    /**
     * Enqueue a FeedbackEvent for delivery
     */
    enqueue(event: FeedbackEvent): void;
    /**
     * Send a message immediately, bypassing the queue
     */
    sendDirect(outbound: WhatsAppOutbound): Promise<void>;
    private maybeEmitHeartbeat;
    /**
     * Flush all queued events to WhatsApp
     */
    flush(): Promise<void>;
    /**
     * Compose WhatsApp messages from FeedbackEvents
     */
    private compose;
    /**
     * Truncate text to max length
     */
    private truncate;
    /**
     * Split text into chunks at word boundaries
     */
    private splitIntoChunks;
    /**
     * Deliver a WhatsApp message with retry
     */
    private deliver;
    /**
     * Get last full content (for /full command)
     */
    getLastFullContent(): string;
    /**
     * Get time of last delivery
     */
    getLastDeliveryAt(): number;
    /**
     * Start heartbeat timer (lazy — only when agent is running)
     */
    startHeartbeat(): void;
    /**
     * Stop heartbeat timer
     */
    stopHeartbeat(): void;
    /**
     * Destroy the delivery manager
     */
    destroy(): void;
}
/**
 * Split a long message into chunks
 */
export declare function splitMessage(text: string, maxLen: number): string[];
//# sourceMappingURL=delivery-manager.d.ts.map