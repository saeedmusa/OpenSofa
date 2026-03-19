/**
 * OpenSofa - WhatsApp Handler
 *
 * Manages Baileys connection to WhatsApp.
 * All WhatsApp I/O flows through this component.
 * Based on LOW_LEVEL_DESIGN.md §5
 */
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadMediaMessage, } from '@whiskeysockets/baileys';
import { createLogger } from './utils/logger.js';
import { expandPath } from './utils/expand-path.js';
import { sleep } from './utils/sleep.js';
const log = createLogger('whatsapp');
/**
 * WhatsApp Handler class
 * Singleton - owns the Baileys socket
 */
export class WhatsAppHandler extends EventEmitter {
    config;
    authDir;
    sock = null;
    connected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    reconnectBackoffMs = 2000;
    messageQueue = [];
    botJid = '';
    botLid = '';
    sendQueue = Promise.resolve();
    sentMessageIds = new Set(); // track bot-sent msgs to avoid loops in singleNumberMode
    constructor(config, authDir) {
        super();
        this.config = config;
        this.authDir = expandPath(authDir);
    }
    /**
     * Connect to WhatsApp via Baileys
     * On first run: displays QR code in terminal
     * On subsequent runs: uses persisted auth state
     */
    async connect() {
        // Ensure auth directory exists
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
        // Get latest Baileys version
        const { version } = await fetchLatestBaileysVersion();
        // Create socket — memory-optimized settings
        this.sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, {
                    trace: () => { },
                    debug: () => { },
                    info: () => { },
                    warn: (msg) => log.warn(msg),
                    error: (msg) => log.error(msg),
                    fatal: (msg) => log.error(msg),
                    level: 'warn',
                    child: () => ({ trace: () => { }, debug: () => { }, info: () => { }, warn: () => { }, error: () => { }, fatal: () => { }, level: 'warn', child: () => ({}) }),
                }),
            },
            browser: ['OpenSofa', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 3,
            // ── Memory optimization (mitigates Baileys rc.9 memory leak) ──
            syncFullHistory: false, // Don't download entire chat history into RAM
            shouldSyncHistoryMessage: () => false, // Skip all history sync messages
            markOnlineOnConnect: false, // Reduce protocol overhead
            generateHighQualityLinkPreview: false, // Skip link preview generation
            fireInitQueries: false, // Skip initial queries we don't need
            shouldIgnoreJid: (jid) => // Ignore newsletters & broadcasts (memory savings)
             jid.includes('broadcast') || jid.includes('newsletter'),
        });
        // Save credentials on update
        this.sock.ev.on('creds.update', saveCreds);
        // Handle connection updates
        this.sock.ev.on('connection.update', async (update) => {
            await this.handleConnectionUpdate(update);
        });
        // Handle incoming messages
        this.sock.ev.on('messages.upsert', ({ messages, type }) => {
            if (type === 'notify') {
                this.handleIncomingMessages(messages);
            }
        });
        // Wait for connection
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout - QR not scanned'));
            }, 120000); // 2 minute timeout for QR scan
            this.once('connected', () => {
                clearTimeout(timeout);
                resolve();
            });
            this.once('disconnected', (reason) => {
                clearTimeout(timeout);
                reject(new Error(`Connection failed: ${reason}`));
            });
        });
    }
    /**
     * Handle connection state changes
     */
    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            log.info('QR code generated - scan with WhatsApp > Linked Devices > Link a Device');
            qrcode.generate(qr, { small: true });
            this.emit('qr', qr);
        }
        if (connection === 'close') {
            this.connected = false;
            const reason = lastDisconnect?.error?.output?.statusCode;
            const reasonStr = this.getDisconnectReason(reason);
            log.warn(`Connection closed: ${reasonStr}`);
            if (reason === DisconnectReason.restartRequired) {
                // Normal after QR scan - reconnect immediately
                log.info('Reconnecting after restart required...');
                this.reconnectAttempts = 0;
                await this.connect();
                return;
            }
            if (reason === DisconnectReason.loggedOut) {
                // Auth revoked - clear auth and require new QR scan
                log.error('Logged out - clearing auth state');
                fs.rmSync(this.authDir, { recursive: true, force: true });
                fs.mkdirSync(this.authDir, { recursive: true });
                this.emit('disconnected', 'logged_out');
                return;
            }
            if (reason === DisconnectReason.connectionReplaced) {
                // Another device took over
                log.error('Connection replaced by another device');
                this.emit('disconnected', 'connection_replaced');
                return;
            }
            // Transient errors - reconnect with backoff
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = Math.min(this.reconnectBackoffMs * Math.pow(2, this.reconnectAttempts), 60000);
                this.reconnectAttempts++;
                log.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
                await sleep(delay);
                await this.connect();
            }
            else {
                this.emit('disconnected', 'max_reconnect_attempts');
            }
        }
        if (connection === 'open') {
            this.connected = true;
            this.reconnectAttempts = 0;
            this.botJid = this.sock?.user?.id || '';
            this.botLid = this.sock?.user?.lid || '';
            log.info(`Connected to WhatsApp as ${this.botJid} (LID: ${this.botLid})`);
            if (this.config.singleNumberMode) {
                log.info('Single-number mode active — processing fromMe messages, self-chat is control plane');
            }
            // Check if this is a first-time connection (no previous sessions)
            const isFirstConnection = this.checkFirstConnection();
            this.emit('connected', { isFirstConnection });
            // Drain queued messages
            await this.drainMessageQueue();
        }
    }
    /**
     * Check if this is a first-time connection (new auth, no previous state)
     */
    checkFirstConnection() {
        // Check for a marker file that indicates we've connected before
        const markerPath = path.join(this.authDir, '.connected');
        if (fs.existsSync(markerPath)) {
            return false;
        }
        // Create marker file for future connections
        fs.writeFileSync(markerPath, new Date().toISOString());
        return true;
    }
    /**
     * Get human-readable disconnect reason
     */
    getDisconnectReason(reason) {
        switch (reason) {
            case DisconnectReason.connectionClosed:
                return 'connection_closed';
            case DisconnectReason.connectionLost:
                return 'connection_lost';
            case DisconnectReason.connectionReplaced:
                return 'connection_replaced';
            case DisconnectReason.loggedOut:
                return 'logged_out';
            case DisconnectReason.restartRequired:
                return 'restart_required';
            case DisconnectReason.timedOut:
                return 'timed_out';
            case DisconnectReason.badSession:
                return 'bad_session';
            case DisconnectReason.multideviceMismatch:
                return 'multidevice_mismatch';
            default:
                return `unknown (${reason})`;
        }
    }
    /**
     * Handle incoming messages
     *
     * In standard mode: ignores fromMe, validates sender against allowedPhoneNumber.
     * In singleNumberMode: processes fromMe (user typing on phone), but skips
     * bot-sent messages (tracked via sentMessageIds) to avoid infinite loops.
     * Self-chat (message yourself) is the control plane.
     */
    handleIncomingMessages(messages) {
        for (const msg of messages) {
            try {
                // Ignore messages without content
                if (!msg.message)
                    continue;
                const jid = msg.key.remoteJid;
                if (!jid)
                    continue;
                // Skip status broadcasts
                if (jid === 'status@broadcast')
                    continue;
                const msgId = msg.key.id;
                // DEBUG: Log every incoming message for troubleshooting
                log.info('MSG_IN', {
                    jid,
                    fromMe: msg.key.fromMe,
                    msgId: msgId?.slice(0, 12),
                    isSelf: this.isSelfChat(jid),
                    botJid: this.botJid,
                    hasText: !!(msg.message?.conversation || msg.message?.extendedTextMessage?.text),
                    msgType: Object.keys(msg.message || {}).join(','),
                });
                if (this.config.singleNumberMode) {
                    // ── Single-Number Mode ──
                    // Bot IS the user's WhatsApp. All messages from the phone arrive as fromMe=true.
                    // Bot-sent messages also have fromMe=true. We distinguish them by tracking sent IDs.
                    if (msgId && this.sentMessageIds.has(msgId)) {
                        // This is a message WE sent programmatically — skip to avoid loop
                        this.sentMessageIds.delete(msgId); // cleanup
                        continue;
                    }
                    // In singleNumberMode, only process fromMe messages (user typing on their phone)
                    // Non-fromMe messages in groups are from other people — ignore unless they're allowed
                    if (!msg.key.fromMe) {
                        // In groups, allow messages from others if they match allowedPhoneNumber
                        // (for future multi-user support). For now, skip non-fromMe in singleNumberMode.
                        log.debug(`Ignoring non-fromMe message in singleNumberMode`);
                        continue;
                    }
                }
                else {
                    // ── Standard Mode (separate bot number) ──
                    // Ignore bot's own messages
                    if (msg.key.fromMe)
                        continue;
                    // Security: only process messages from allowed number
                    const sender = jid.endsWith('@g.us')
                        ? msg.key.participant
                        : jid;
                    const allowedPrefix = `${this.config.allowedPhoneNumber}`;
                    const senderNumber = sender?.split('@')[0]?.split(':')[0];
                    if (senderNumber !== allowedPrefix) {
                        log.debug(`Ignoring message from unauthorized sender: ${sender}`);
                        continue;
                    }
                }
                // Extract text content from protobuf
                const text = this.extractText(msg);
                // Check for media
                const hasImage = !!msg.message?.imageMessage;
                const hasDocument = !!msg.message?.documentMessage;
                // Route by JID type
                if (this.config.singleNumberMode && this.isSelfChat(jid)) {
                    // Self-chat (message yourself) → control plane
                    log.debug(`Self-chat message: ${text?.slice(0, 50)}...`);
                    this.emit('message:direct', jid, text);
                }
                else if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')) {
                    // Direct chat or LID chat → control plane
                    log.debug(`Direct message: ${text?.slice(0, 50)}...`);
                    this.emit('message:direct', jid, text);
                }
                else if (jid.endsWith('@g.us')) {
                    if (hasImage || hasDocument) {
                        const caption = msg.message?.imageMessage?.caption ||
                            msg.message?.documentMessage?.caption || '';
                        log.debug(`Media message in group ${jid}`);
                        this.emit('media:group', jid, msg, caption);
                    }
                    else if (text) {
                        log.debug(`Group message in ${jid}: ${text?.slice(0, 50)}...`);
                        this.emit('message:group', jid, text, msg);
                    }
                }
            }
            catch (err) {
                log.error('Error processing message', { error: String(err) });
            }
        }
    }
    /**
     * Check if a JID is the self-chat (message yourself)
     * In singleNumberMode, this is the control plane
     */
    isSelfChat(jid) {
        if (!this.botJid)
            return false;
        // Bot JID can be "1234567890:5@s.whatsapp.net" — extract just the number
        const botNumber = this.botJid.split('@')[0]?.split(':')[0];
        const jidNumber = jid.split('@')[0]?.split(':')[0];
        if (botNumber === jidNumber)
            return true;
        // Also check LID — newer WhatsApp versions use LID for self-chat
        if (this.botLid) {
            const lidNumber = this.botLid.split('@')[0]?.split(':')[0];
            if (lidNumber === jidNumber)
                return true;
        }
        return false;
    }
    /**
     * Extract text from Baileys protobuf message
     */
    extractText(msg) {
        return msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            '';
    }
    /**
     * Send a text message
     */
    async sendText(jid, text) {
        await this.sendWithQueue({ type: 'text', text }, jid);
    }
    /**
     * Send an image with caption
     */
    async sendImage(jid, buffer, caption) {
        await this.sendWithQueue({ type: 'image', buffer, caption }, jid);
    }
    /**
     * Send a document
     */
    async sendDocument(jid, buffer, fileName, mimetype) {
        await this.sendWithQueue({ type: 'document', buffer, fileName, mimetype }, jid);
    }
    /**
     * Send with queue support during disconnect
     * Uses a Promise chain to ensure sequential delivery (no spin-lock)
     */
    async sendWithQueue(outbound, jid) {
        if (!this.connected || !this.sock) {
            log.debug('Queuing message (not connected)');
            this.messageQueue.push({ outbound, jid });
            return;
        }
        // Chain sends sequentially via Promise queue — no spin-lock needed
        this.sendQueue = this.sendQueue.then(async () => {
            try {
                await this.doSend(outbound, jid);
            }
            catch (err) {
                log.error('Send failed, queuing message', { error: String(err) });
                this.messageQueue.push({ outbound, jid });
            }
        });
        await this.sendQueue;
    }
    /**
     * Actually send the message and track its ID in singleNumberMode
     */
    async doSend(outbound, jid) {
        if (!this.sock)
            throw new Error('Not connected');
        // LID JIDs (@lid) cannot be used for sending — remap to phone JID for self-chat
        // Also strip device ID (:N) from botJid — self-chat needs main account JID
        let sendJid = jid;
        if (jid.endsWith('@lid') && this.botJid) {
            // Strip device ID from botJid: "447460436252:7@s.whatsapp.net" → "447460436252@s.whatsapp.net"
            const phonePart = this.botJid.split('@')[0]?.split(':')[0] || '';
            if (phonePart) {
                sendJid = `${phonePart}@s.whatsapp.net`;
            }
            log.debug(`Remapping LID JID ${jid} → ${sendJid} for self-chat send`);
        }
        log.info(`Sending ${outbound.type} to ${sendJid}...`);
        let sentMsg;
        try {
            switch (outbound.type) {
                case 'text':
                    sentMsg = await this.sock.sendMessage(sendJid, { text: outbound.text });
                    log.info(`✅ Sent text to ${sendJid}`, { sentId: sentMsg?.key?.id?.slice(0, 12) });
                    break;
                case 'image':
                    sentMsg = await this.sock.sendMessage(sendJid, {
                        image: outbound.buffer,
                        caption: outbound.caption,
                    });
                    log.info(`Sent image to ${sendJid}`);
                    break;
                case 'document':
                    sentMsg = await this.sock.sendMessage(sendJid, {
                        document: outbound.buffer,
                        fileName: outbound.fileName,
                        mimetype: outbound.mimetype,
                    });
                    log.info(`Sent document to ${sendJid}`);
                    break;
            }
        }
        catch (err) {
            log.error(`Send failed to ${sendJid}`, { error: String(err), stack: err.stack });
            throw err;
        }
        // In singleNumberMode, track sent message IDs so we don't re-process our own messages
        const sentId = sentMsg?.key?.id;
        if (this.config.singleNumberMode && sentId) {
            this.sentMessageIds.add(sentId);
            // Prevent memory leak — cap the set size
            if (this.sentMessageIds.size > 1000) {
                const first = this.sentMessageIds.values().next().value;
                if (first)
                    this.sentMessageIds.delete(first);
            }
        }
    }
    /**
     * Drain queued messages after reconnect
     */
    async drainMessageQueue() {
        log.info(`Draining ${this.messageQueue.length} queued messages`);
        while (this.messageQueue.length > 0 && this.connected) {
            const item = this.messageQueue.shift();
            if (!item)
                break;
            try {
                await this.doSend(item.outbound, item.jid);
                await sleep(500); // Rate limit
            }
            catch (err) {
                log.error('Failed to drain message', { error: String(err) });
                this.messageQueue.unshift(item); // Put back at front
                break;
            }
        }
    }
    /**
     * Create a WhatsApp group
     * @returns Group JID
     */
    async createGroup(name, participantJids) {
        if (!this.sock)
            throw new Error('Not connected');
        const result = await this.sock.groupCreate(name, participantJids);
        log.info(`Created group: ${name} (${result.id})`);
        return result.id;
    }
    /**
     * Leave a WhatsApp group
     */
    async leaveGroup(groupJid) {
        if (!this.sock)
            throw new Error('Not connected');
        try {
            await this.sock.groupLeave(groupJid);
            log.info(`Left group: ${groupJid}`);
        }
        catch (err) {
            log.warn(`Failed to leave group ${groupJid}`, { error: String(err) });
        }
    }
    /**
     * Download media from a message
     * Uses the standalone downloadMediaMessage from Baileys (not a socket method)
     */
    async downloadMedia(msg) {
        if (!this.sock)
            throw new Error('Not connected');
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
            logger: {
                info: (msg) => log.debug(msg),
                error: (msg) => log.error(msg),
                warn: (msg) => log.warn(msg),
                debug: (msg) => log.debug(msg),
                trace: (msg) => log.debug(msg),
                child: () => ({ info: () => { }, error: () => { }, warn: () => { }, debug: () => { }, trace: () => { }, child: () => ({}) }),
                level: 'debug',
            },
            reuploadRequest: this.sock.updateMediaMessage,
        });
        if (!buffer) {
            throw new Error('Failed to download media');
        }
        return buffer;
    }
    /**
     * Get group metadata
     */
    async getGroupMetadata(groupJid) {
        if (!this.sock)
            throw new Error('Not connected');
        return await this.sock.groupMetadata(groupJid);
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Get bot's JID
     */
    getBotJid() {
        return this.botJid;
    }
    /**
     * Disconnect from WhatsApp
     */
    async disconnect() {
        if (this.sock) {
            // Baileys end() requires an Error object
            this.sock.end(new Error('OpenSofa shutdown'));
            this.sock = null;
            this.connected = false;
            log.info('Disconnected from WhatsApp');
        }
    }
}
//# sourceMappingURL=whatsapp-handler.js.map