/**
 * Tests for Resource Monitor
 * Based on USER_STORIES.md P2-06
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResourceMonitor } from '../src/resource-monitor.js';
import type { OpenSofaConfig, Session } from '../src/types.js';

// Mock os module
vi.mock('os', () => ({
  default: {
    freemem: () => 2 * 1024 * 1024 * 1024, // 2GB free
    totalmem: () => 8 * 1024 * 1024 * 1024, // 8GB total
    platform: () => 'linux', // Force non-macOS so vm_stat is not called
    cpus: () => [
      { times: { idle: 1000, user: 500, nice: 0, sys: 300, irq: 0 } },
      { times: { idle: 1000, user: 500, nice: 0, sys: 300, irq: 0 } },
    ],
  },
}));

// Mock child_process (used by vm_stat on macOS — not needed in tests)
vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue(''),
  execFileSync: vi.fn().mockReturnValue(''),
}));

// Mock fetch for health checks
global.fetch = vi.fn();

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor;
  let config: OpenSofaConfig;
  let sessions: Map<string, Session>;

  const createMockSession = (name: string, port: number, status: 'active' | 'stopping' | 'stopped' = 'active'): Session => ({
    name,
    status,
    agentType: 'claude',
    model: '',
    port,
    pid: 12345,
    repoDir: `/tmp/${name}`,
    workDir: `/tmp/${name}-work`,
    branch: `feat/${name}`,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    agentStatus: 'stable',
    feedbackController: null,
    autoApprove: false,
    screenshotsEnabled: true,
  });

  beforeEach(() => {
    config = {
      defaultAgent: 'claude',
      maxSessions: 5,
      portRangeStart: 3284,
      debounceMs: 3000,
      screenshotIntervalMs: 10000,
      approvalTimeoutMs: 300000,
      healthCheckIntervalMs: 10000,
      idleTimeoutMs: 600000,
      screenshotFontSize: 14,
      screenshotCols: 80,
      autoApprove: false,
      projectDirs: ['~/development', '~/projects'],
      autoCleanupOnCritical: true,
    };

    sessions = new Map();
    sessions.set('test1', createMockSession('test1', 3284));
    sessions.set('test2', createMockSession('test2', 3285));

    monitor = new ResourceMonitor(config, () => sessions);
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('canCreateSession', () => {
    it('should allow session creation when resources are available', () => {
      const result = monitor.canCreateSession(2);
      expect(result.ok).toBe(true);
    });

    it('should block session creation when max sessions reached', () => {
      const result = monitor.canCreateSession(5);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('Max sessions');
    });

    it('should block session creation when CPU is too high', () => {
      // Create monitor with high CPU mock
      const highCpuMonitor = new ResourceMonitor(
        config,
        () => sessions,
        { getCpuUsage: () => 95 }
      );

      const result = highCpuMonitor.canCreateSession(2);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('CPU');
    });

    it('should block session creation when RAM is low', () => {
      // Create monitor with low RAM mock
      const lowRamMonitor = new ResourceMonitor(
        config,
        () => sessions,
        { getFreeMemMB: () => 500 }
      );

      const result = lowRamMonitor.canCreateSession(2);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('RAM');
    });
  });

  describe('getStats', () => {
    it('should return current resource stats', () => {
      const stats = monitor.getStats();
      expect(stats).toHaveProperty('cpu');
      expect(stats).toHaveProperty('freeMemMB');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats.activeSessions).toBe(2);
    });
  });

  describe('start/stop', () => {
    it('should start and stop monitoring', () => {
      monitor.start();
      expect(monitor.isRunning()).toBe(true);

      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });

    it('should not start twice', () => {
      monitor.start();
      monitor.start(); // Should be a no-op
      expect(monitor.isRunning()).toBe(true);

      monitor.stop();
    });
  });

  describe('health checks', () => {
    it('should emit session:unhealthy when health check fails', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));

      const unhealthySpy = vi.fn();
      monitor.on('session:unhealthy', unhealthySpy);

      // Use shorter interval for testing
      const testMonitor = new ResourceMonitor(
        { ...config, healthCheckIntervalMs: 100 },
        () => sessions
      );

      testMonitor.on('session:unhealthy', unhealthySpy);
      testMonitor.start();

      // Wait for health check to run
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(unhealthySpy).toHaveBeenCalled();

      testMonitor.stop();
    });

    it('should not emit unhealthy when health check passes', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ agent_type: 'claude', status: 'stable' }),
      } as Response);

      const unhealthySpy = vi.fn();
      monitor.on('session:unhealthy', unhealthySpy);

      const testMonitor = new ResourceMonitor(
        { ...config, healthCheckIntervalMs: 100 },
        () => sessions
      );

      testMonitor.on('session:unhealthy', unhealthySpy);
      testMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(unhealthySpy).not.toHaveBeenCalled();

      testMonitor.stop();
    });
  });

  describe('idle detection', () => {
    it('should emit session:idle for inactive sessions', async () => {
      // Create session that's been idle for 15 minutes
      const oldSession = createMockSession('old', 3286);
      oldSession.lastActivityAt = Date.now() - 15 * 60 * 1000; // 15 min ago
      sessions.set('old', oldSession);

      const idleSpy = vi.fn();
      monitor.on('session:idle', idleSpy);

      const testMonitor = new ResourceMonitor(
        { ...config, healthCheckIntervalMs: 100, idleTimeoutMs: 600000 },
        () => sessions
      );

      testMonitor.on('session:idle', idleSpy);
      testMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(idleSpy).toHaveBeenCalledWith('old', expect.any(Number));

      testMonitor.stop();
    });
  });

  describe('resources:critical', () => {
    it('should emit resources:critical when CPU is critical', async () => {
      const criticalSpy = vi.fn();
      monitor.on('resources:critical', criticalSpy);

      const criticalMonitor = new ResourceMonitor(
        { ...config, healthCheckIntervalMs: 100 },
        () => sessions,
        { getCpuUsage: () => 96, getFreeMemMB: () => 2000 }
      );

      criticalMonitor.on('resources:critical', criticalSpy);
      criticalMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(criticalSpy).toHaveBeenCalled();
      const stats = criticalSpy.mock.calls[0][0];
      expect(stats.cpu).toBeGreaterThan(95);

      criticalMonitor.stop();
    });

    it('should emit resources:critical when RAM is critical', async () => {
      const criticalSpy = vi.fn();
      monitor.on('resources:critical', criticalSpy);

      const criticalMonitor = new ResourceMonitor(
        { ...config, healthCheckIntervalMs: 100 },
        () => sessions,
        { getCpuUsage: () => 50, getFreeMemMB: () => 400 }
      );

      criticalMonitor.on('resources:critical', criticalSpy);
      criticalMonitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(criticalSpy).toHaveBeenCalled();
      const stats = criticalSpy.mock.calls[0][0];
      expect(stats.freeMemMB).toBeLessThan(512);

      criticalMonitor.stop();
    });
  });
});

/**
 * Tests for Resource Monitor Error Handling & Double-Start Prevention
 * Added 2026-03-14
 */

describe('ResourceMonitor error handling', () => {
  let config: OpenSofaConfig;
  let sessions: Map<string, Session>;

  beforeEach(() => {
    config = {
      defaultAgent: 'claude',
      maxSessions: 5,
      portRangeStart: 3284,
      debounceMs: 3000,
      screenshotIntervalMs: 10000,
      approvalTimeoutMs: 300000,
      healthCheckIntervalMs: 30000,
      idleTimeoutMs: 600000,
      screenshotFontSize: 14,
      screenshotCols: 80,
      autoApprove: false,
      projectDirs: ['~/development'],
      autoCleanupOnCritical: true,
    };
    sessions = new Map();
  });

  describe('error handler', () => {
    it('should have error handler to prevent process crash', () => {
      const monitor = new ResourceMonitor(config, () => sessions);
      
      // Critical: Without error handler, Node.js crashes when error event is emitted
      const hasErrorListener = monitor.listenerCount('error');
      expect(hasErrorListener).toBeGreaterThan(0);
    });

    it('should not crash when error event is emitted', () => {
      const monitor = new ResourceMonitor(config, () => sessions);
      
      // This should NOT crash the process
      expect(() => {
        monitor.emit('error', new Error('test error'));
      }).not.toThrow();
    });
  });

  describe('double-start prevention', () => {
    it('should not throw error on duplicate start (returns early silently)', () => {
      const monitor = new ResourceMonitor(config, () => sessions);
      
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
      
      // Second start should not throw, just return early
      expect(() => monitor.start()).not.toThrow();
      
      // Should still be running
      expect(monitor.isRunning()).toBe(true);
      
      monitor.stop();
    });

    it('should allow restart after stop', () => {
      const monitor = new ResourceMonitor(config, () => sessions);
      
      monitor.start();
      monitor.stop();
      
      // Should be able to start again
      expect(() => monitor.start()).not.toThrow();
      expect(monitor.isRunning()).toBe(true);
      monitor.stop();
    });
  });
});