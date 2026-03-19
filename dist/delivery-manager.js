/**
 * OpenSofa - Delivery Manager
 *
 * Queues FeedbackEvents and delivers them to WhatsApp.
 * One instance per active session.
 * Based on LOW_LEVEL_DESIGN.md §9
 */
import { createLogger } from './utils/logger.js';
import { sleep } from './utils/sleep.js';
import { randomUUID } from 'crypto';
const log = createLogger('delivery');
/**
 * Delivery Manager class
 * One instance per session - owns delivery queue
 */
export class DeliveryManager {
    session;
    whatsApp;
    config;
    queue = [];
    delivering = false;
    debounceTimer = null;
    heartbeatTimer = null;
    lastDeliveryAt = 0;
    lastHeartbeatAt = 0;
    lastFullContent = '';
    destroyed = false;
    constructor(session, whatsApp, config) {
        this.session = session;
        this.whatsApp = whatsApp;
        this.config = config;
        // Heartbeat timer is lazy — started only when agent is running
    }
    /**
     * Enqueue a FeedbackEvent for delivery
     */
    enqueue(event) {
        if (this.destroyed)
            return;
        // Agent became stable — stop heartbeat cadence immediately.
        if (event.type === 'completion') {
            this.lastHeartbeatAt = 0;
            this.stopHeartbeat();
        }
        // Agent started working — start heartbeat if not already running
        if (event.type === 'status' && !this.heartbeatTimer) {
            this.startHeartbeat();
        }
        this.queue.push(event);
        // Queue overflow protection: drop oldest p2 events if queue exceeds 100
        if (this.queue.length > 100) {
            const p2Indices = [];
            for (let i = 0; i < this.queue.length; i++) {
                if (this.queue[i].priority === 'p2')
                    p2Indices.push(i);
            }
            // Drop up to half of p2 events (oldest first)
            const toDrop = Math.min(p2Indices.length, Math.floor(p2Indices.length / 2) || 1);
            for (let i = toDrop - 1; i >= 0; i--) {
                this.queue.splice(p2Indices[i], 1);
            }
            if (toDrop > 0) {
                log.warn(`Queue overflow: dropped ${toDrop} low-priority events`);
            }
        }
        // p0 = immediate delivery (no debounce)
        if (event.priority === 'p0') {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            this.flush();
            return;
        }
        // p1/p2 = debounce
        if (!this.debounceTimer) {
            this.debounceTimer = setTimeout(() => {
                this.debounceTimer = null;
                this.flush();
            }, this.config.debounceMs);
        }
    }
    /**
     * Send a message immediately, bypassing the queue
     */
    async sendDirect(outbound) {
        await this.deliver(outbound);
    }
    maybeEmitHeartbeat() {
        if (this.destroyed)
            return;
        if (this.session.agentStatus !== 'running') {
            this.lastHeartbeatAt = 0;
            return;
        }
        const now = Date.now();
        const reference = Math.max(this.lastDeliveryAt, this.lastHeartbeatAt);
        if (reference > 0 && now - reference < 30000) {
            return;
        }
        this.lastHeartbeatAt = now;
        const elapsedSec = reference > 0 ? Math.round((now - reference) / 1000) : 30;
        this.enqueue({
            id: randomUUID(),
            sessionName: this.session.name,
            type: 'status',
            priority: 'p2',
            content: `Still working... (${elapsedSec}s elapsed)`,
            timestamp: now,
            sequenceNumber: now,
        });
    }
    /**
     * Flush all queued events to WhatsApp
     */
    async flush() {
        // Mutex - prevent concurrent deliveries to same group
        if (this.delivering)
            return;
        this.delivering = true;
        try {
            while (this.queue.length > 0 && !this.destroyed) {
                // Drain all queued events
                const events = [...this.queue];
                this.queue = [];
                // Compose messages from events
                const messages = this.compose(events);
                // Deliver each message sequentially
                for (const msg of messages) {
                    await this.deliver(msg);
                    await sleep(500); // rate limit between messages
                }
            }
        }
        finally {
            this.delivering = false;
        }
    }
    /**
     * Compose WhatsApp messages from FeedbackEvents
     */
    compose(events) {
        const badge = `[${this.session.name} | ${this.session.agentType} | ${this.session.branch}]`;
        const messages = [];
        // Separate by type
        const approvals = events.filter(e => e.type === 'approval');
        const completions = events.filter(e => e.type === 'completion');
        const textEvents = events.filter(e => e.type === 'text' || e.type === 'status');
        const screenshots = events.filter(e => e.screenshot);
        const errors = events.filter(e => e.type === 'error');
        // 1. Errors — always first (p0)
        for (const err of errors) {
            messages.push({
                type: 'text',
                text: `${badge}\n❌ ${err.content}`
            });
        }
        // 2. Approval requests — p0, with special formatting
        for (const approval of approvals) {
            messages.push({
                type: 'text',
                text: `${badge}\n⚠️ Agent wants approval:\n\n${approval.content}\n\nReply /approve or /reject`,
            });
        }
        // 3. Text updates — merge into single message (with [1/N] splitting if needed)
        if (textEvents.length > 0) {
            const merged = textEvents.map(e => e.content).join('\n');
            this.lastFullContent = merged;
            const chunks = this.splitIntoChunks(merged, this.config.truncateAt - badge.length - 20);
            if (chunks.length === 1) {
                messages.push({
                    type: 'text',
                    text: `${badge}\n${chunks[0]}`
                });
            }
            else {
                // Multiple chunks — send with [1/N] numbering
                for (let i = 0; i < chunks.length; i++) {
                    messages.push({
                        type: 'text',
                        text: `${badge} [${i + 1}/${chunks.length}]\n${chunks[i]}`,
                    });
                }
            }
        }
        // 4. Screenshots — as image with caption (P4-05: include recent agent output)
        for (const ss of screenshots) {
            if (ss.screenshot) {
                let caption = `${badge}\n${ss.content || 'Terminal screenshot'}`;
                if (this.lastFullContent) {
                    const snippet = this.lastFullContent.slice(0, 200).replace(/\s+/g, ' ').trim();
                    caption += `\n\n${snippet}${this.lastFullContent.length > 200 ? '...' : ''}`;
                }
                messages.push({
                    type: 'image',
                    buffer: ss.screenshot,
                    caption,
                });
            }
        }
        // 5. Completion — final summary
        for (const comp of completions) {
            const truncated = this.truncate(comp.content);
            this.lastFullContent = comp.content;
            messages.push({
                type: 'text',
                text: `${badge}\n✅ Done.\n\n${truncated.text}${truncated.wasTruncated ? '\n\n_(truncated — /full for complete output)_' : ''}`,
            });
        }
        return messages;
    }
    /**
     * Truncate text to max length
     */
    truncate(text) {
        if (text.length <= this.config.truncateAt) {
            return { text, wasTruncated: false };
        }
        return {
            text: text.slice(0, this.config.truncateAt),
            wasTruncated: true,
        };
    }
    /**
     * Split text into chunks at word boundaries
     */
    splitIntoChunks(text, maxLen) {
        if (text.length <= maxLen) {
            return [text];
        }
        const chunks = [];
        let remaining = text;
        while (remaining.length > 0) {
            if (remaining.length <= maxLen) {
                chunks.push(remaining);
                break;
            }
            // Find a good break point (space or newline) within maxLen
            let breakPoint = maxLen;
            const searchStart = Math.max(0, maxLen - 100); // Look back up to 100 chars for a break
            for (let i = maxLen; i >= searchStart; i--) {
                if (remaining[i] === ' ' || remaining[i] === '\n') {
                    breakPoint = i;
                    break;
                }
            }
            chunks.push(remaining.slice(0, breakPoint).trim());
            remaining = remaining.slice(breakPoint).trim();
        }
        return chunks;
    }
    /**
     * Deliver a WhatsApp message with retry
     */
    async deliver(outbound) {
        const maxRetries = 3;
        const groupJid = this.session.groupJid;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                switch (outbound.type) {
                    case 'text':
                        await this.whatsApp.sendText(groupJid, outbound.text);
                        break;
                    case 'image':
                        await this.whatsApp.sendImage(groupJid, outbound.buffer, outbound.caption);
                        break;
                    case 'document':
                        await this.whatsApp.sendDocument(groupJid, outbound.buffer, outbound.fileName, outbound.mimetype);
                        break;
                }
                this.lastDeliveryAt = Date.now();
                return; // success
            }
            catch (err) {
                if (attempt < maxRetries - 1) {
                    await sleep(2000 * (attempt + 1)); // exponential backoff
                }
                else {
                    // Only log on final attempt failure
                    log.error(`Failed to deliver message after ${maxRetries} attempts`, {
                        error: String(err)
                    });
                }
            }
        }
    }
    /**
     * Get last full content (for /full command)
     */
    getLastFullContent() {
        return this.lastFullContent;
    }
    /**
     * Get time of last delivery
     */
    getLastDeliveryAt() {
        return this.lastDeliveryAt;
    }
    /**
     * Start heartbeat timer (lazy — only when agent is running)
     */
    startHeartbeat() {
        if (this.heartbeatTimer || this.destroyed)
            return;
        this.heartbeatTimer = setInterval(() => {
            this.maybeEmitHeartbeat();
        }, 5000);
    }
    /**
     * Stop heartbeat timer
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    /**
     * Destroy the delivery manager
     */
    destroy() {
        this.destroyed = true;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.stopHeartbeat();
        this.queue = [];
        this.lastFullContent = '';
    }
}
/**
 * Split a long message into chunks
 */
export function splitMessage(text, maxLen) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLen) {
        chunks.push(text.slice(i, i + maxLen));
    }
    return chunks;
}
//# sourceMappingURL=delivery-manager.js.map