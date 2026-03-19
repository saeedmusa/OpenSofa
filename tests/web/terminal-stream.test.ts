/**
 * Tests for Terminal Stream
 * Phase 0 US-0.3: Terminal output streaming via tmux
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTerminalStream,
  getLogPath,
  getTmuxSessionName,
  buildPipeArgs,
  buildUnpipeArgs,
  buildTailArgs,
  encodeTerminalData,
} from '../../src/web/terminal-stream.js';
import type { TerminalProcessSpawner } from '../../src/web/terminal-stream.js';
import { WebSocket } from 'ws';

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  unlinkSync: vi.fn(),
}));

describe('TerminalStream', () => {
  let mockSpawner: TerminalProcessSpawner;
  let mockTailProcess: any;
  let stream: ReturnType<typeof createTerminalStream>;

  beforeEach(() => {
    const tailHandlers: Record<string, Function[]> = {};
    
    mockTailProcess = {
      stdout: {
        on: vi.fn((event: string, handler: Function) => {
          tailHandlers[`stdout:${event}`] = tailHandlers[`stdout:${event}`] || [];
          tailHandlers[`stdout:${event}`].push(handler);
        }),
      },
      on: vi.fn((event: string, handler: Function) => {
        tailHandlers[`process:${event}`] = tailHandlers[`process:${event}`] || [];
        tailHandlers[`process:${event}`].push(handler);
      }),
      kill: vi.fn(),
      _emit: (target: string, event: string, data: any) => {
        const key = `${target}:${event}`;
        const h = tailHandlers[key];
        if (h) h.forEach(fn => fn(data));
      },
    };

    mockSpawner = {
      spawnTmux: vi.fn().mockReturnValue({ on: vi.fn(), kill: vi.fn() }),
      spawnTail: vi.fn().mockReturnValue(mockTailProcess),
      execTmux: vi.fn(),
    };

    stream = createTerminalStream({ spawner: mockSpawner });
    vi.clearAllMocks();
  });

  afterEach(() => {
    stream.stopAll();
  });

  describe('start', () => {
    it('should start tmux pipe-pane and tail process', () => {
      stream.start(3285);

      expect(mockSpawner.execTmux).toHaveBeenCalled();
      expect(mockSpawner.spawnTail).toHaveBeenCalled();
    });

    it('should not start duplicate stream for same port', () => {
      stream.start(3285);
      stream.start(3285);

      expect(mockSpawner.spawnTail).toHaveBeenCalledTimes(1);
    });

    it('should use correct log path', () => {
      stream.start(3285);

      const tailCall = vi.mocked(mockSpawner.spawnTail).mock.calls[0][0];
      expect(tailCall).toContain('/tmp/terminal-3285.log');
    });

    it('should use correct tmux session name', () => {
      stream.start(3285);

      const tmuxCall = vi.mocked(mockSpawner.execTmux).mock.calls[0][0];
      expect(tmuxCall).toContain('agentapi-3285');
    });
  });

  describe('stop', () => {
    it('should stop tail process and unpipe tmux', () => {
      stream.start(3285);
      stream.stop(3285);

      expect(mockTailProcess.kill).toHaveBeenCalled();
      expect(mockSpawner.execTmux).toHaveBeenCalledTimes(2);
    });

    it('should handle stopping non-existent stream', () => {
      expect(() => stream.stop(9999)).not.toThrow();
    });
  });

  describe('subscribe', () => {
    it('should send terminal output to subscribed WebSocket', () => {
      const sendMock = vi.fn();
      const ws = {
        readyState: WebSocket.OPEN,
        send: sendMock,
        on: vi.fn(),
        once: vi.fn(),
      } as unknown as WebSocket;

      stream.start(3285);
      stream.subscribe(ws, 3285);

      mockTailProcess._emit('stdout', 'data', Buffer.from('Hello Terminal'));

      expect(sendMock).toHaveBeenCalledTimes(1);
      
      const sentData = sendMock.mock.calls[0][0];
      const parsed = JSON.parse(sentData);
      expect(parsed.type).toBe('terminal_output');
      expect(parsed.payload.data).toBe(Buffer.from('Hello Terminal').toString('base64'));
    });

    it('should not send to closed WebSocket', () => {
      const sendMock = vi.fn();
      const ws = {
        readyState: WebSocket.CLOSED,
        send: sendMock,
        on: vi.fn(),
        once: vi.fn(),
      } as unknown as WebSocket;

      stream.start(3285);
      stream.subscribe(ws, 3285);

      mockTailProcess._emit('stdout', 'data', Buffer.from('Hello'));

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('should track multiple subscribers', () => {
      const sendMock1 = vi.fn();
      const sendMock2 = vi.fn();
      const ws1 = { readyState: WebSocket.OPEN, send: sendMock1, on: vi.fn(), once: vi.fn() } as unknown as WebSocket;
      const ws2 = { readyState: WebSocket.OPEN, send: sendMock2, on: vi.fn(), once: vi.fn() } as unknown as WebSocket;

      stream.start(3285);
      stream.subscribe(ws1, 3285);
      stream.subscribe(ws2, 3285);

      mockTailProcess._emit('stdout', 'data', Buffer.from('Output'));

      expect(sendMock1).toHaveBeenCalled();
      expect(sendMock2).toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should stop sending to unsubscribed WebSocket', () => {
      const sendMock = vi.fn();
      const ws = {
        readyState: WebSocket.OPEN,
        send: sendMock,
        on: vi.fn(),
        once: vi.fn(),
      } as unknown as WebSocket;

      stream.start(3285);
      stream.subscribe(ws, 3285);
      stream.unsubscribe(ws);

      mockTailProcess._emit('stdout', 'data', Buffer.from('After unsubscribe'));

      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe('isStreaming', () => {
    it('should return false when not streaming', () => {
      expect(stream.isStreaming(3285)).toBe(false);
    });

    it('should return true when streaming', () => {
      stream.start(3285);
      expect(stream.isStreaming(3285)).toBe(true);
    });

    it('should return false after stop', () => {
      stream.start(3285);
      stream.stop(3285);
      expect(stream.isStreaming(3285)).toBe(false);
    });
  });

  describe('stopAll', () => {
    it('should stop all active streams', () => {
      stream.start(3285);
      stream.start(3286);
      stream.stopAll();

      expect(stream.isStreaming(3285)).toBe(false);
      expect(stream.isStreaming(3286)).toBe(false);
    });
  });
});

describe('Pure Functions', () => {
  describe('getLogPath', () => {
    it('should return correct log path for port', () => {
      expect(getLogPath(3285)).toBe('/tmp/terminal-3285.log');
      expect(getLogPath(8080)).toBe('/tmp/terminal-8080.log');
    });
  });

  describe('getTmuxSessionName', () => {
    it('should return correct tmux session name', () => {
      expect(getTmuxSessionName(3285)).toBe('agentapi-3285');
      expect(getTmuxSessionName(8080)).toBe('agentapi-8080');
    });
  });

  describe('buildPipeArgs', () => {
    it('should build pipe-pane arguments', () => {
      const args = buildPipeArgs('agentapi-3285', '/tmp/terminal-3285.log');
      expect(args).toEqual([
        'pipe-pane',
        '-t', 'agentapi-3285',
        '-o',
        'cat >> /tmp/terminal-3285.log',
      ]);
    });
  });

  describe('buildUnpipeArgs', () => {
    it('should build unpipe arguments', () => {
      const args = buildUnpipeArgs('agentapi-3285');
      expect(args).toEqual([
        'pipe-pane',
        '-t', 'agentapi-3285',
        '',
      ]);
    });
  });

  describe('buildTailArgs', () => {
    it('should build tail -f arguments', () => {
      const args = buildTailArgs('/tmp/terminal-3285.log');
      expect(args).toEqual(['-f', '-c', '+0', '/tmp/terminal-3285.log']);
    });
  });

  describe('encodeTerminalData', () => {
    it('should encode data as base64', () => {
      const data = Buffer.from('Hello World');
      expect(encodeTerminalData(data)).toBe('SGVsbG8gV29ybGQ=');
    });

    it('should handle empty buffer', () => {
      expect(encodeTerminalData(Buffer.alloc(0))).toBe('');
    });

    it('should handle binary data', () => {
      const data = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      expect(encodeTerminalData(data)).toBe('AAEC/w==');
    });
  });
});
