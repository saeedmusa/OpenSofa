/**
 * Tests for Message Queue
 * 
 * Tests for the message queue functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageQueue, globalMessageQueue, type QueuedMessage } from '../src/message-queue.js';

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('MessageQueue', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue({ maxQueueSize: 5, maxAttempts: 3, retryDelayMs: 100 });
  });

  describe('constructor', () => {
    it('should create queue with default options', () => {
      const defaultQueue = new MessageQueue();
      expect(defaultQueue).toBeDefined();
    });

    it('should accept custom options', () => {
      const customQueue = new MessageQueue({ maxQueueSize: 10, maxAttempts: 5, retryDelayMs: 2000 });
      expect(customQueue).toBeDefined();
    });
  });

  describe('enqueue', () => {
    it('should add message to queue', () => {
      const msg = queue.enqueue('test-session', 'user_message', 'Hello world');
      expect(msg).toBeDefined();
      expect(msg?.sessionName).toBe('test-session');
      expect(msg?.content).toBe('Hello world');
      expect(queue.size('test-session')).toBe(1);
    });

    it('should generate unique IDs', () => {
      const msg1 = queue.enqueue('test', 'user_message', 'msg1');
      const msg2 = queue.enqueue('test', 'user_message', 'msg2');
      expect(msg1?.id).not.toBe(msg2?.id);
    });

    it('should enforce max queue size', () => {
      // Fill up the queue
      queue.enqueue('test', 'user_message', 'msg1');
      queue.enqueue('test', 'user_message', 'msg2');
      queue.enqueue('test', 'user_message', 'msg3');
      queue.enqueue('test', 'user_message', 'msg4');
      queue.enqueue('test', 'user_message', 'msg5');
      
      // This should drop the oldest
      queue.enqueue('test', 'user_message', 'msg6');
      
      expect(queue.size('test')).toBe(5);
    });

    it('should include metadata', () => {
      const msg = queue.enqueue('test', 'approval_response', 'yes', { isApproval: true, approved: true });
      expect(msg?.metadata?.isApproval).toBe(true);
      expect(msg?.metadata?.approved).toBe(true);
    });
  });

  describe('peek', () => {
    it('should return all messages in queue', () => {
      queue.enqueue('test', 'user_message', 'msg1');
      queue.enqueue('test', 'user_message', 'msg2');
      
      const messages = queue.peek('test');
      expect(messages).toHaveLength(2);
    });

    it('should return empty array for unknown session', () => {
      const messages = queue.peek('unknown');
      expect(messages).toHaveLength(0);
    });
  });

  describe('size', () => {
    it('should return queue size', () => {
      queue.enqueue('test', 'user_message', 'msg1');
      queue.enqueue('test', 'user_message', 'msg2');
      expect(queue.size('test')).toBe(2);
    });

    it('should return 0 for unknown session', () => {
      expect(queue.size('unknown')).toBe(0);
    });
  });

  describe('hasPending', () => {
    it('should return true when messages exist', () => {
      queue.enqueue('test', 'user_message', 'msg1');
      expect(queue.hasPending('test')).toBe(true);
    });

    it('should return false for empty queue', () => {
      expect(queue.hasPending('test')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all messages for session', () => {
      queue.enqueue('test', 'user_message', 'msg1');
      queue.clear('test');
      expect(queue.size('test')).toBe(0);
    });
  });

  describe('setSender', () => {
    it('should set the message sender', () => {
      const sender = vi.fn().mockResolvedValue(undefined);
      queue.setSender(sender);
      
      // Access internal state - this tests the API exists
      expect(queue).toBeDefined();
    });
  });

  describe('flush', () => {
    it('should deliver messages when sender is set', async () => {
      const sender = vi.fn().mockResolvedValue(undefined);
      queue.setSender(sender);
      
      queue.enqueue('test', 'user_message', 'msg1');
      
      const result = await queue.flush('test');
      
      expect(sender).toHaveBeenCalled();
      expect(result.delivered).toBe(1);
      expect(queue.size('test')).toBe(0);
    });

    it('should handle sender errors on first attempt (message not failed yet)', async () => {
      const sender = vi.fn().mockRejectedValue(new Error('Failed'));
      queue.setSender(sender);
      
      queue.enqueue('test', 'user_message', 'msg1');
      
      const result = await queue.flush('test');
      
      // On first attempt, message is not counted as failed yet (will retry)
      // It will be failed after maxAttempts (3) tries
      expect(result.failed).toBe(0);
      expect(result.delivered).toBe(0);
      // Message should still be in queue for retry
      expect(queue.size('test')).toBe(1);
    });

    it('should fail after max attempts', async () => {
      const sender = vi.fn().mockRejectedValue(new Error('Failed'));
      queue.setSender(sender);
      
      queue.enqueue('test', 'user_message', 'msg1');
      
      // First attempt
      await queue.flush('test');
      // Second attempt
      await queue.flush('test');
      // Third attempt (fails)
      const result = await queue.flush('test');
      
      // Should be removed after max attempts
      expect(queue.size('test')).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers on changes', () => {
      const listener = vi.fn();
      queue.subscribe(listener);
      
      queue.enqueue('test', 'user_message', 'msg1');
      
      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = queue.subscribe(listener);
      
      unsubscribe();
      
      queue.enqueue('test', 'user_message', 'msg1');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getAllPending', () => {
    it('should return all pending messages across sessions', () => {
      queue.enqueue('session1', 'user_message', 'msg1');
      queue.enqueue('session2', 'user_message', 'msg2');
      
      const all = queue.getAllPending();
      expect(all.size).toBe(2);
    });
  });
});

describe('globalMessageQueue', () => {
  it('should be exported', () => {
    expect(globalMessageQueue).toBeDefined();
    expect(globalMessageQueue).toBeInstanceOf(MessageQueue);
  });
});
