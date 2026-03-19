/**
 * OpenSofa - Message Queue
 *
 * Queues messages when agent is busy and delivers when ready.
 * Provides pending state tracking for UI feedback.
 */
import { createLogger } from './utils/logger.js';
const log = createLogger('message-queue');
export class MessageQueue {
    queues = new Map();
    sender = null;
    listeners = new Set();
    options;
    constructor(options = {}) {
        this.options = {
            maxQueueSize: options.maxQueueSize ?? 10,
            maxAttempts: options.maxAttempts ?? 3,
            retryDelayMs: options.retryDelayMs ?? 1000,
        };
    }
    setSender(sender) {
        this.sender = sender;
    }
    enqueue(sessionName, type, content, metadata) {
        const queue = this.getOrCreateQueue(sessionName);
        if (queue.length >= this.options.maxQueueSize) {
            const dropped = queue.shift();
            log.warn(`Queue full, dropping oldest message`, {
                sessionName,
                droppedId: dropped?.id
            });
        }
        const message = {
            id: crypto.randomUUID(),
            sessionName,
            type,
            content,
            timestamp: Date.now(),
            attempts: 0,
            maxAttempts: this.options.maxAttempts,
            metadata,
        };
        queue.push(message);
        this.notifyListeners(sessionName);
        log.info(`Message queued`, {
            sessionName,
            messageId: message.id,
            type,
            queueSize: queue.length
        });
        return message;
    }
    async flush(sessionName) {
        const queue = this.queues.get(sessionName);
        if (!queue || queue.length === 0) {
            return { delivered: 0, failed: 0 };
        }
        if (!this.sender) {
            log.warn('No sender configured, cannot flush queue');
            return { delivered: 0, failed: queue.length };
        }
        let delivered = 0;
        let failed = 0;
        const toRemove = [];
        for (const msg of [...queue]) {
            try {
                await this.sender(msg);
                toRemove.push(msg.id);
                delivered++;
                log.debug(`Message delivered`, { messageId: msg.id, sessionName });
            }
            catch (err) {
                msg.attempts++;
                if (msg.attempts >= msg.maxAttempts) {
                    toRemove.push(msg.id);
                    failed++;
                    log.error(`Message delivery failed after ${msg.attempts} attempts`, {
                        messageId: msg.id,
                        sessionName,
                        error: String(err),
                    });
                }
                else {
                    log.warn(`Message delivery failed, will retry`, {
                        messageId: msg.id,
                        attempt: msg.attempts,
                        error: String(err),
                    });
                }
            }
        }
        const remaining = queue.filter(m => !toRemove.includes(m.id));
        if (remaining.length === 0) {
            this.queues.delete(sessionName);
        }
        else {
            this.queues.set(sessionName, remaining);
        }
        this.notifyListeners(sessionName);
        return { delivered, failed };
    }
    peek(sessionName) {
        return [...(this.queues.get(sessionName) || [])];
    }
    size(sessionName) {
        return this.queues.get(sessionName)?.length ?? 0;
    }
    hasPending(sessionName) {
        return this.size(sessionName) > 0;
    }
    clear(sessionName) {
        this.queues.delete(sessionName);
        this.notifyListeners(sessionName);
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    getAllPending() {
        const result = new Map();
        for (const [sessionName, queue] of this.queues) {
            result.set(sessionName, [...queue]);
        }
        return result;
    }
    getOrCreateQueue(sessionName) {
        let queue = this.queues.get(sessionName);
        if (!queue) {
            queue = [];
            this.queues.set(sessionName, queue);
        }
        return queue;
    }
    notifyListeners(sessionName) {
        const queue = this.peek(sessionName);
        for (const listener of this.listeners) {
            try {
                listener(sessionName, queue);
            }
            catch (err) {
                log.error('Queue listener error', { error: String(err) });
            }
        }
    }
}
export const globalMessageQueue = new MessageQueue();
//# sourceMappingURL=message-queue.js.map