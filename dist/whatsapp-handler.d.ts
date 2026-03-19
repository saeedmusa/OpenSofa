/**
 * OpenSofa - WhatsApp Handler
 *
 * Manages Baileys connection to WhatsApp.
 * All WhatsApp I/O flows through this component.
 * Based on LOW_LEVEL_DESIGN.md §5
 */
import EventEmitter from 'events';
import { type WAMessage, type GroupMetadata } from '@whiskeysockets/baileys';
export type { WAMessage } from '@whiskeysockets/baileys';
import type { OpenSofaConfig } from './types.js';
/**
 * WhatsApp Handler class
 * Singleton - owns the Baileys socket
 */
export declare class WhatsAppHandler extends EventEmitter {
    private config;
    private authDir;
    private sock;
    private connected;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectBackoffMs;
    private messageQueue;
    private botJid;
    private botLid;
    private sendQueue;
    private sentMessageIds;
    constructor(config: OpenSofaConfig, authDir: string);
    /**
     * Connect to WhatsApp via Baileys
     * On first run: displays QR code in terminal
     * On subsequent runs: uses persisted auth state
     */
    connect(): Promise<void>;
    /**
     * Handle connection state changes
     */
    private handleConnectionUpdate;
    /**
     * Check if this is a first-time connection (new auth, no previous state)
     */
    private checkFirstConnection;
    /**
     * Get human-readable disconnect reason
     */
    private getDisconnectReason;
    /**
     * Handle incoming messages
     *
     * In standard mode: ignores fromMe, validates sender against allowedPhoneNumber.
     * In singleNumberMode: processes fromMe (user typing on phone), but skips
     * bot-sent messages (tracked via sentMessageIds) to avoid infinite loops.
     * Self-chat (message yourself) is the control plane.
     */
    private handleIncomingMessages;
    /**
     * Check if a JID is the self-chat (message yourself)
     * In singleNumberMode, this is the control plane
     */
    private isSelfChat;
    /**
     * Extract text from Baileys protobuf message
     */
    private extractText;
    /**
     * Send a text message
     */
    sendText(jid: string, text: string): Promise<void>;
    /**
     * Send an image with caption
     */
    sendImage(jid: string, buffer: Buffer, caption: string): Promise<void>;
    /**
     * Send a document
     */
    sendDocument(jid: string, buffer: Buffer, fileName: string, mimetype: string): Promise<void>;
    /**
     * Send with queue support during disconnect
     * Uses a Promise chain to ensure sequential delivery (no spin-lock)
     */
    private sendWithQueue;
    /**
     * Actually send the message and track its ID in singleNumberMode
     */
    private doSend;
    /**
     * Drain queued messages after reconnect
     */
    private drainMessageQueue;
    /**
     * Create a WhatsApp group
     * @returns Group JID
     */
    createGroup(name: string, participantJids: string[]): Promise<string>;
    /**
     * Leave a WhatsApp group
     */
    leaveGroup(groupJid: string): Promise<void>;
    /**
     * Download media from a message
     * Uses the standalone downloadMediaMessage from Baileys (not a socket method)
     */
    downloadMedia(msg: WAMessage): Promise<Buffer>;
    /**
     * Get group metadata
     */
    getGroupMetadata(groupJid: string): Promise<GroupMetadata>;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Get bot's JID
     */
    getBotJid(): string;
    /**
     * Disconnect from WhatsApp
     */
    disconnect(): Promise<void>;
}
//# sourceMappingURL=whatsapp-handler.d.ts.map