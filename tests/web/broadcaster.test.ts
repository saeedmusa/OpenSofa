/**
 * Tests for Broadcaster
 * Phase 0 US-0.2: Event broadcasting to WebSocket clients
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  createBroadcaster,
  createEvent,
  serializeEvent,
  parseMessage,
} from '../../src/web/broadcaster.js';
import type { WebSocketEvent } from '../../src/web/types.js';

describe('Broadcaster', () => {
  let broadcaster: ReturnType<typeof createBroadcaster>;

  beforeEach(() => {
    broadcaster = createBroadcaster();
  });

  describe('addClient / removeClient', () => {
    it('should add a client and track count', () => {
      const mockWs = { on: vi.fn(), readyState: 1 } as unknown as WebSocket;
      broadcaster.addClient(mockWs, 'client-1');
      expect(broadcaster.getClientCount()).toBe(1);
    });

    it('should remove a client', () => {
      const mockWs = { on: vi.fn(), readyState: 1 } as unknown as WebSocket;
      broadcaster.addClient(mockWs, 'client-1');
      broadcaster.removeClient('client-1');
      expect(broadcaster.getClientCount()).toBe(0);
    });

    it('should handle multiple clients', () => {
      const ws1 = { on: vi.fn(), readyState: 1 } as unknown as WebSocket;
      const ws2 = { on: vi.fn(), readyState: 1 } as unknown as WebSocket;
      const ws3 = { on: vi.fn(), readyState: 1 } as unknown as WebSocket;

      broadcaster.addClient(ws1, 'client-1');
      broadcaster.addClient(ws2, 'client-2');
      broadcaster.addClient(ws3, 'client-3');

      expect(broadcaster.getClientCount()).toBe(3);

      broadcaster.removeClient('client-2');
      expect(broadcaster.getClientCount()).toBe(2);
    });

    it('should ignore removal of non-existent client', () => {
      broadcaster.removeClient('non-existent');
      expect(broadcaster.getClientCount()).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('should send message to all connected clients', () => {
      const sendMock1 = vi.fn();
      const sendMock2 = vi.fn();

      const ws1 = {
        on: vi.fn(),
        readyState: WebSocket.OPEN,
        send: sendMock1,
      } as unknown as WebSocket;
      const ws2 = {
        on: vi.fn(),
        readyState: WebSocket.OPEN,
        send: sendMock2,
      } as unknown as WebSocket;

      broadcaster.addClient(ws1, 'client-1');
      broadcaster.addClient(ws2, 'client-2');

      const event = createEvent('session_created', { name: 'test-session' });
      broadcaster.broadcast(event);

      expect(sendMock1).toHaveBeenCalledTimes(1);
      expect(sendMock2).toHaveBeenCalledTimes(1);
    });

    it('should not send to clients with non-OPEN state', () => {
      const sendMock = vi.fn();
      const ws = {
        on: vi.fn(),
        readyState: WebSocket.CLOSING,
        send: sendMock,
      } as unknown as WebSocket;

      broadcaster.addClient(ws, 'client-1');

      const event = createEvent('session_created', { name: 'test' });
      broadcaster.broadcast(event);

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('should serialize events correctly', () => {
      const sendMock = vi.fn();
      const ws = {
        on: vi.fn(),
        readyState: WebSocket.OPEN,
        send: sendMock,
      } as unknown as WebSocket;

      broadcaster.addClient(ws, 'client-1');

      const event = createEvent('approval_needed', {
        sessionName: 'frontend',
        command: 'npm install',
      }, 'frontend');
      broadcaster.broadcast(event);

      const sentData = sendMock.mock.calls[0][0];
      const parsed = JSON.parse(sentData);

      expect(parsed.type).toBe('approval_needed');
      expect(parsed.sessionName).toBe('frontend');
      expect(parsed.payload).toEqual({
        sessionName: 'frontend',
        command: 'npm install',
      });
      expect(parsed.timestamp).toBeDefined();
    });

    it('should handle send errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const sendMock = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      const ws = {
        on: vi.fn(),
        readyState: WebSocket.OPEN,
        send: sendMock,
      } as unknown as WebSocket;

      broadcaster.addClient(ws, 'client-1');

      const event = createEvent('session_stopped', { name: 'test' });
      expect(() => broadcaster.broadcast(event)).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('broadcastToSession', () => {
    it('should only send to clients subscribed to specific session', () => {
      const sendMock1 = vi.fn();
      const sendMock2 = vi.fn();

      const ws1 = {
        on: vi.fn(),
        readyState: WebSocket.OPEN,
        send: sendMock1,
      } as unknown as WebSocket;
      const ws2 = {
        on: vi.fn(),
        readyState: WebSocket.OPEN,
        send: sendMock2,
      } as unknown as WebSocket;

      broadcaster.addClient(ws1, 'client-1');
      broadcaster.addClient(ws2, 'client-2');

      broadcaster.setTerminalSubscription('client-1', 'frontend');

      const event = createEvent('terminal_output', { data: 'base64...' }, 'frontend');
      broadcaster.broadcastToSession('frontend', event);

      expect(sendMock1).toHaveBeenCalledTimes(1);
      expect(sendMock2).not.toHaveBeenCalled();
    });

    it('should not send to clients subscribed to different session', () => {
      const sendMock = vi.fn();
      const ws = {
        on: vi.fn(),
        readyState: WebSocket.OPEN,
        send: sendMock,
      } as unknown as WebSocket;

      broadcaster.addClient(ws, 'client-1');
      broadcaster.setTerminalSubscription('client-1', 'backend');

      const event = createEvent('terminal_output', { data: 'base64...' }, 'frontend');
      broadcaster.broadcastToSession('frontend', event);

      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe('terminal subscriptions', () => {
    it('should track terminal subscriptions per client', () => {
      const ws = { on: vi.fn(), readyState: 1 } as unknown as WebSocket;
      broadcaster.addClient(ws, 'client-1');

      broadcaster.setTerminalSubscription('client-1', 'frontend');
      const clients = broadcaster.getClientsWithTerminalSubscription('frontend');

      expect(clients).toHaveLength(1);
      expect(clients[0]).toBe(ws);
    });

    it('should allow changing subscription', () => {
      const ws = { on: vi.fn(), readyState: 1 } as unknown as WebSocket;
      broadcaster.addClient(ws, 'client-1');

      broadcaster.setTerminalSubscription('client-1', 'frontend');
      broadcaster.setTerminalSubscription('client-1', 'backend');

      expect(broadcaster.getClientsWithTerminalSubscription('frontend')).toHaveLength(0);
      expect(broadcaster.getClientsWithTerminalSubscription('backend')).toHaveLength(1);
    });

    it('should allow clearing subscription', () => {
      const ws = { on: vi.fn(), readyState: 1 } as unknown as WebSocket;
      broadcaster.addClient(ws, 'client-1');

      broadcaster.setTerminalSubscription('client-1', 'frontend');
      broadcaster.setTerminalSubscription('client-1', null);

      expect(broadcaster.getClientsWithTerminalSubscription('frontend')).toHaveLength(0);
    });
  });

  describe('onClientMessage callback', () => {
    it('should invoke callback when client sends message', () => {
      const callback = vi.fn();
      const broadcasterWithCallback = createBroadcaster({
        onClientMessage: callback,
      });

      let messageHandler: (data: Buffer) => void = () => {};
      const ws = {
        on: vi.fn().mockImplementation((event, handler) => {
          if (event === 'message') messageHandler = handler;
        }),
        readyState: 1,
      } as unknown as WebSocket;

      broadcasterWithCallback.addClient(ws, 'client-1');

      messageHandler(Buffer.from(JSON.stringify({
        type: 'subscribe_terminal',
        sessionName: 'frontend',
      })));

      expect(callback).toHaveBeenCalledWith('client-1', {
        type: 'subscribe_terminal',
        sessionName: 'frontend',
      });
    });
  });
});

describe('Pure Functions', () => {
  describe('createEvent', () => {
    it('should create event with required fields', () => {
      const event = createEvent('session_created', { name: 'test' });

      expect(event.type).toBe('session_created');
      expect(event.payload).toEqual({ name: 'test' });
      expect(event.timestamp).toBeDefined();
      expect(event.sessionName).toBeUndefined();
    });

    it('should create event with session name', () => {
      const event = createEvent('terminal_output', { data: 'x' }, 'frontend');

      expect(event.sessionName).toBe('frontend');
    });
  });

  describe('serializeEvent', () => {
    it('should serialize event to JSON string', () => {
      const event: WebSocketEvent = {
        type: 'session_stopped',
        payload: { name: 'test' },
        timestamp: 12345,
      };

      const serialized = serializeEvent(event);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual(event);
    });
  });

  describe('parseMessage', () => {
    it('should parse valid JSON message', () => {
      const result = parseMessage('{"type":"subscribe_terminal","sessionName":"frontend"}');

      expect(result).toEqual({
        type: 'subscribe_terminal',
        sessionName: 'frontend',
      });
    });

    it('should return null for invalid JSON', () => {
      expect(parseMessage('not json')).toBeNull();
      expect(parseMessage('')).toBeNull();
      expect(parseMessage('{invalid}')).toBeNull();
    });

    it('should handle messages without sessionName', () => {
      const result = parseMessage('{"type":"ping"}');

      expect(result).toEqual({ type: 'ping' });
    });
  });

  // US-13 Tests: Event Persistence and Recovery
  describe('US-13: Event Persistence', () => {
    it('should create events with sequence numbers', () => {
      const event1 = createEvent('session_created', { name: 'test1' });
      const event2 = createEvent('session_created', { name: 'test2' });
      
      expect(event1.sequence).toBeDefined();
      expect(event2.sequence).toBeDefined();
      expect(event2.sequence!).toBe(event1.sequence! + 1);
    });

    it('should create events with unique eventId (UUID)', () => {
      const event1 = createEvent('session_created', { name: 'test1' });
      const event2 = createEvent('session_created', { name: 'test2' });
      
      expect(event1.eventId).toBeDefined();
      expect(event2.eventId).toBeDefined();
      expect(event1.eventId).not.toBe(event2.eventId);
    });

    it('should create events with timestamps', () => {
      const event = createEvent('session_created', { name: 'test' });
      
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('number');
    });
  });
});
