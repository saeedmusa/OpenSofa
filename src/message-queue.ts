/**
 * OpenSofa - Message Queue
 *
 * Queues messages when agent is busy and delivers when ready.
 * Provides pending state tracking for UI feedback.
 */

import { createLogger } from './utils/logger.js';

const log = createLogger('message-queue');

export type QueuedMessageType = 'user_message' | 'file_upload' | 'approval_response';

export interface QueuedMessage {
  id: string;
  sessionName: string;
  type: QueuedMessageType;
  content: string;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
  metadata?: {
    fileName?: string;
    mimeType?: string;
    buffer?: Buffer;
    isApproval?: boolean;
    approved?: boolean;
  };
}

export interface MessageQueueOptions {
  maxQueueSize?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
}

type MessageSender = (msg: QueuedMessage) => Promise<void>;
type QueueChangeListener = (sessionName: string, queue: QueuedMessage[]) => void;

export class MessageQueue {
  private queues: Map<string, QueuedMessage[]> = new Map();
  private sender: MessageSender | null = null;
  private listeners: Set<QueueChangeListener> = new Set();
  private options: Required<MessageQueueOptions>;

  constructor(options: MessageQueueOptions = {}) {
    this.options = {
      maxQueueSize: options.maxQueueSize ?? 10,
      maxAttempts: options.maxAttempts ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
    };
  }

  setSender(sender: MessageSender): void {
    this.sender = sender;
  }

  enqueue(
    sessionName: string,
    type: QueuedMessageType,
    content: string,
    metadata?: QueuedMessage['metadata']
  ): QueuedMessage | null {
    const queue = this.getOrCreateQueue(sessionName);

    if (queue.length >= this.options.maxQueueSize) {
      const dropped = queue.shift();
      log.warn(`Queue full, dropping oldest message`, { 
        sessionName, 
        droppedId: dropped?.id 
      });
    }

    const message: QueuedMessage = {
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

  async flush(sessionName: string): Promise<{ delivered: number; failed: number }> {
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
    const toRemove: string[] = [];

    for (const msg of [...queue]) {
      try {
        await this.sender(msg);
        toRemove.push(msg.id);
        delivered++;
        log.debug(`Message delivered`, { messageId: msg.id, sessionName });
      } catch (err) {
        msg.attempts++;
        
        if (msg.attempts >= msg.maxAttempts) {
          toRemove.push(msg.id);
          failed++;
          log.error(`Message delivery failed after ${msg.attempts} attempts`, {
            messageId: msg.id,
            sessionName,
            error: String(err),
          });
        } else {
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
    } else {
      this.queues.set(sessionName, remaining);
    }

    this.notifyListeners(sessionName);

    return { delivered, failed };
  }

  peek(sessionName: string): QueuedMessage[] {
    return [...(this.queues.get(sessionName) || [])];
  }

  size(sessionName: string): number {
    return this.queues.get(sessionName)?.length ?? 0;
  }

  hasPending(sessionName: string): boolean {
    return this.size(sessionName) > 0;
  }

  clear(sessionName: string): void {
    this.queues.delete(sessionName);
    this.notifyListeners(sessionName);
  }

  subscribe(listener: QueueChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAllPending(): Map<string, QueuedMessage[]> {
    const result = new Map<string, QueuedMessage[]>();
    for (const [sessionName, queue] of this.queues) {
      result.set(sessionName, [...queue]);
    }
    return result;
  }

  private getOrCreateQueue(sessionName: string): QueuedMessage[] {
    let queue = this.queues.get(sessionName);
    if (!queue) {
      queue = [];
      this.queues.set(sessionName, queue);
    }
    return queue;
  }

  private notifyListeners(sessionName: string): void {
    const queue = this.peek(sessionName);
    for (const listener of this.listeners) {
      try {
        listener(sessionName, queue);
      } catch (err) {
        log.error('Queue listener error', { error: String(err) });
      }
    }
  }
}

export const globalMessageQueue = new MessageQueue();
