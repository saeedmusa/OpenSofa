/**
 * Tests for Web Server
 * Phase 0 US-0.1: HTTP + WebSocket server lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_WEB_CONFIG } from '../../src/web/types.js';
import type { WebConfig } from '../../src/web/types.js';

vi.mock('../../src/web/tunnel.js', () => ({
  createTunnelManager: vi.fn(() => ({
    start: vi.fn().mockResolvedValue('https://test.trycloudflare.com'),
    stop: vi.fn(),
    getUrl: vi.fn().mockReturnValue('https://test.trycloudflare.com'),
    getStatus: vi.fn().mockReturnValue('running'),
    onStatus: vi.fn(),
  })),
  isCloudflaredAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/web/terminal-stream.js', () => ({
  createTerminalStream: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    stopAll: vi.fn(),
    isStreaming: vi.fn().mockReturnValue(false),
  })),
}));

vi.mock('qrcode', () => ({
  default: {
    toString: vi.fn().mockResolvedValue('[QR CODE]'),
  },
}));

const createMockSessionManager = () => ({
  getByName: vi.fn(),
  getActiveSessions: vi.fn().mockReturnValue([]),
  getSessionsMap: vi.fn().mockReturnValue(new Map()),
  on: vi.fn(),
  emit: vi.fn(),
});

const createMockAgentRegistry = () => ({
  getInstalledAgents: vi.fn().mockReturnValue([]),
  isAgentInstalled: vi.fn().mockReturnValue(true),
});

describe('DEFAULT_WEB_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_WEB_CONFIG.enabled).toBe(true);
    expect(DEFAULT_WEB_CONFIG.port).toBe(3285);
    expect(DEFAULT_WEB_CONFIG.tunnel.provider).toBe('cloudflare');
    expect(DEFAULT_WEB_CONFIG.auth.tokenPath).toContain('.opensofa/web-token');
    expect(DEFAULT_WEB_CONFIG.auth.tokenExpiryHours).toBe(24);
  });
});

describe('WebServer Module', () => {
  it('should export createWebServer function', async () => {
    const { createWebServer } = await import('../../src/web/server.js');
    expect(typeof createWebServer).toBe('function');
  });

  it('should export DEFAULT_WEB_CONFIG', async () => {
    const mod = await import('../../src/web/server.js');
    expect(mod.DEFAULT_WEB_CONFIG).toBeDefined();
    expect(mod.DEFAULT_WEB_CONFIG.port).toBe(3285);
  });

  it('should create server with all required methods', async () => {
    const { createWebServer } = await import('../../src/web/server.js');
    
    const server = createWebServer({
      sessionManager: createMockSessionManager() as any,
      agentRegistry: createMockAgentRegistry() as any,
      webConfig: { ...DEFAULT_WEB_CONFIG, enabled: false },
      getUptime: () => 12345,
      getSystemResources: () => ({ cpu: '10%', freeMem: '8GB' }),
    });

    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
    expect(typeof server.getTunnelUrl).toBe('function');
    expect(typeof server.getTunnelStatus).toBe('function');
    expect(typeof server.getBroadcaster).toBe('function');
    expect(typeof server.getTokenManager).toBe('function');
    expect(typeof server.getQRCodeUrl).toBe('function');
  });

  it('should skip starting when disabled', async () => {
    const { createWebServer } = await import('../../src/web/server.js');
    
    const server = createWebServer({
      sessionManager: createMockSessionManager() as any,
      agentRegistry: createMockAgentRegistry() as any,
      webConfig: { ...DEFAULT_WEB_CONFIG, enabled: false },
      getUptime: () => 12345,
      getSystemResources: () => ({ cpu: '10%', freeMem: '8GB' }),
    });

    await server.start();
    
    expect(server.getTunnelUrl()).toBeNull();
    expect(server.getTunnelStatus()).toBe('stopped');
  });

  it('should return null for QR code when no tunnel', async () => {
    const { createWebServer } = await import('../../src/web/server.js');
    
    const server = createWebServer({
      sessionManager: createMockSessionManager() as any,
      agentRegistry: createMockAgentRegistry() as any,
      webConfig: { ...DEFAULT_WEB_CONFIG, enabled: false },
      getUptime: () => 12345,
      getSystemResources: () => ({ cpu: '10%', freeMem: '8GB' }),
    });

    const qrUrl = await server.getQRCodeUrl();
    expect(qrUrl).toBeNull();
  });

  it('should handle stop when not started', async () => {
    const { createWebServer } = await import('../../src/web/server.js');
    
    const server = createWebServer({
      sessionManager: createMockSessionManager() as any,
      agentRegistry: createMockAgentRegistry() as any,
      webConfig: { ...DEFAULT_WEB_CONFIG },
      getUptime: () => 12345,
      getSystemResources: () => ({ cpu: '10%', freeMem: '8GB' }),
    });

    await expect(server.stop()).resolves.not.toThrow();
  });
});

describe('WebServer Types', () => {
  it('should export WebServerDeps interface fields', async () => {
    const { createWebServer } = await import('../../src/web/server.js');
    
    const deps = {
      sessionManager: createMockSessionManager(),
      agentRegistry: createMockAgentRegistry(),
      webConfig: DEFAULT_WEB_CONFIG,
      getUptime: () => 12345,
      getSystemResources: () => ({ cpu: '10%', freeMem: '8GB' }),
    };

    expect(() => createWebServer(deps as any)).not.toThrow();
  });
});
