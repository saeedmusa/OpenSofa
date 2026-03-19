/**
 * Tests for Tunnel Manager
 * Phase 0 US-0.1: Cloudflare tunnel lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTunnelManager,
  extractTunnelUrl,
  buildTunnelArgs,
} from '../../src/web/tunnel.js';
import type { ProcessSpawner } from '../../src/web/tunnel.js';
import { ChildProcess } from 'child_process';

describe('TunnelManager', () => {
  let mockSpawner: ProcessSpawner;
  let mockProcess: any;

  beforeEach(() => {
    const handlers: Record<string, Function[]> = {};
    
    mockProcess = {
      stdout: {
        on: vi.fn((event: string, handler: Function) => {
          handlers[`stdout:${event}`] = handlers[`stdout:${event}`] || [];
          handlers[`stdout:${event}`].push(handler);
        }),
      },
      stderr: {
        on: vi.fn((event: string, handler: Function) => {
          handlers[`stderr:${event}`] = handlers[`stderr:${event}`] || [];
          handlers[`stderr:${event}`].push(handler);
        }),
      },
      on: vi.fn((event: string, handler: Function) => {
        handlers[`process:${event}`] = handlers[`process:${event}`] || [];
        handlers[`process:${event}`].push(handler);
      }),
      kill: vi.fn(),
      _handlers: handlers,
      _emit: (target: string, event: string, data: any) => {
        const key = `${target}:${event}`;
        const h = handlers[key];
        if (h) h.forEach(fn => fn(data));
      },
    };

    mockSpawner = {
      spawn: vi.fn().mockReturnValue(mockProcess),
    };

    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should start tunnel and resolve with URL', async () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      const startPromise = manager.start();

      expect(mockSpawner.spawn).toHaveBeenCalledWith([
        'tunnel',
        '--url',
        'http://localhost:3285',
      ]);

      mockProcess._emit('stdout', 'data', Buffer.from('Your tunnel: https://abc123.trycloudflare.com'));

      const url = await startPromise;
      expect(url).toBe('https://abc123.trycloudflare.com');
    });

    it('should return existing URL if already running', async () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      const startPromise = manager.start();
      mockProcess._emit('stdout', 'data', Buffer.from('https://abc123.trycloudflare.com'));
      const url1 = await startPromise;

      const url2 = await manager.start();

      expect(url1).toBe(url2);
      expect(mockSpawner.spawn).toHaveBeenCalledTimes(1);
    });

    it('should reject if already starting', async () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      manager.start();
      await expect(manager.start()).rejects.toThrow('already starting');
    });

    it('should timeout if tunnel URL not received', async () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 100,
      });

      await expect(manager.start()).rejects.toThrow('timeout');
    });

    it('should handle process spawn errors', async () => {
      const errorSpawner: ProcessSpawner = {
        spawn: vi.fn().mockImplementation(() => {
          throw new Error('cloudflared not found');
        }),
      };

      const manager = createTunnelManager({
        localPort: 3285,
        spawner: errorSpawner,
        startupTimeoutMs: 5000,
      });

      await expect(manager.start()).rejects.toThrow('cloudflared');
    });

    it('should handle process error events', async () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      const startPromise = manager.start();
      mockProcess._emit('process', 'error', new Error('Process failed'));

      await expect(startPromise).rejects.toThrow('Process failed');
    });
  });

  describe('stop', () => {
    it('should kill process on stop', async () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      const startPromise = manager.start();
      mockProcess._emit('stdout', 'data', Buffer.from('https://abc123.trycloudflare.com'));
      await startPromise;

      manager.stop();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should update status on stop', async () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      const startPromise = manager.start();
      mockProcess._emit('stdout', 'data', Buffer.from('https://abc123.trycloudflare.com'));
      await startPromise;

      expect(manager.getStatus()).toBe('running');

      manager.stop();

      expect(manager.getStatus()).toBe('stopped');
    });
  });

  describe('getUrl', () => {
    it('should return null when not running', () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
      });

      expect(manager.getUrl()).toBeNull();
    });

    it('should return URL when running', async () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      const startPromise = manager.start();
      mockProcess._emit('stdout', 'data', Buffer.from('https://xyz789.trycloudflare.com'));
      await startPromise;

      expect(manager.getUrl()).toBe('https://xyz789.trycloudflare.com');
    });
  });

  describe('onStatus', () => {
    it('should call handler on status changes', async () => {
      const statusHandler = vi.fn();
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      manager.onStatus(statusHandler);

      const startPromise = manager.start();
      expect(statusHandler).toHaveBeenCalledWith('starting', undefined);

      mockProcess._emit('stdout', 'data', Buffer.from('https://abc123.trycloudflare.com'));
      await startPromise;

      expect(statusHandler).toHaveBeenCalledWith('running', 'https://abc123.trycloudflare.com');
    });

    it('should call handler on stop', async () => {
      const statusHandler = vi.fn();
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      manager.onStatus(statusHandler);

      const startPromise = manager.start();
      mockProcess._emit('stdout', 'data', Buffer.from('https://abc123.trycloudflare.com'));
      await startPromise;

      manager.stop();
      expect(statusHandler).toHaveBeenCalledWith('stopped', undefined);
    });
  });

  describe('getStatus', () => {
    it('should return stopped initially', () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
      });

      expect(manager.getStatus()).toBe('stopped');
    });

    it('should return starting while waiting for URL', () => {
      const manager = createTunnelManager({
        localPort: 3285,
        spawner: mockSpawner,
        startupTimeoutMs: 5000,
      });

      manager.start();

      expect(manager.getStatus()).toBe('starting');
    });
  });
});

describe('Pure Functions', () => {
  describe('extractTunnelUrl', () => {
    it('should extract cloudflare tunnel URL', () => {
      const output = 'Your tunnel is ready! https://abc-123-xyz.trycloudflare.com';
      expect(extractTunnelUrl(output)).toBe('https://abc-123-xyz.trycloudflare.com');
    });

    it('should return null for no URL', () => {
      expect(extractTunnelUrl('No tunnel URL here')).toBeNull();
    });

    it('should handle multiline output', () => {
      const output = `
2024-01-15 INFO Starting tunnel
2024-01-15 INFO Connection established
Your tunnel: https://my-tunnel.trycloudflare.com
2024-01-15 INFO Serving traffic
`;
      expect(extractTunnelUrl(output)).toBe('https://my-tunnel.trycloudflare.com');
    });

    it('should extract only first URL if multiple present', () => {
      const output = 'https://first.trycloudflare.com and https://second.trycloudflare.com';
      expect(extractTunnelUrl(output)).toBe('https://first.trycloudflare.com');
    });
  });

  describe('buildTunnelArgs', () => {
    it('should build correct tunnel arguments', () => {
      const args = buildTunnelArgs(3285);
      expect(args).toEqual(['tunnel', '--url', 'http://localhost:3285']);
    });

    it('should handle different ports', () => {
      const args = buildTunnelArgs(8080);
      expect(args).toContain('http://localhost:8080');
    });
  });
});
