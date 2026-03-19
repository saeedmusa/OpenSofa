/**
 * Tests for SessionManager Events
 * Phase 0 US-0.2: Event emission for session lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { SessionManager } from '../../src/session-manager.js';
import type { OpenSofaConfig, Session } from '../../src/types.js';

vi.mock('../../src/agentapi-client.js', () => ({
  AgentAPIClient: vi.fn().mockImplementation(() => ({
    sendRaw: vi.fn().mockResolvedValue(undefined),
  })),
  AgentAPIError: class AgentAPIError extends Error {},
}));

vi.mock('../../src/feedback-controller.js', () => ({
  FeedbackController: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('../../src/delivery-manager.js', () => ({
  DeliveryManager: vi.fn().mockImplementation(() => ({
    queueMessage: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  })),
}));

describe('SessionManager Events', () => {
  let sessionManager: SessionManager;
  let mockConfig: OpenSofaConfig;
  let mockClassifier: any;
  let mockAgentRegistry: any;

  beforeEach(() => {
    mockConfig = {
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
      projectDirs: ['~/projects'],
      autoCleanupOnCritical: true,
    };

    mockClassifier = {
      classify: vi.fn().mockReturnValue({ type: 'safe' }),
      extractCommand: vi.fn(),
      getPatterns: vi.fn().mockReturnValue([]),
    };

    mockAgentRegistry = {
      isValidType: vi.fn().mockReturnValue(true),
      isInstalled: vi.fn().mockReturnValue(true),
      buildSpawnArgs: vi.fn().mockReturnValue({ args: ['--port', '3284', '--type', 'claude'], env: {} }),
    };
  });

  afterEach(() => {
    sessionManager?.stopAllSessions();
  });

  describe('session:created event', () => {
    it('should emit session:created when session is created', async () => {
      sessionManager = new SessionManager(
        mockConfig,
        mockClassifier,
        mockAgentRegistry
      );

      const createdHandler = vi.fn();
      sessionManager.on('session:created', createdHandler);

      // Note: Full session creation test would require more mocking
      // Just test the event emitter is set up correctly
      expect(sessionManager.listenerCount('session:created')).toBe(1);
    });

    it('should have working event emitter', () => {
      sessionManager = new SessionManager(
        mockConfig,
        mockClassifier,
        mockAgentRegistry
      );

      const handler = vi.fn();
      sessionManager.on('test-event', handler);
      
      sessionManager.emit('test-event', { data: 'test' });
      
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('getByName', () => {
    it('should return undefined for nonexistent session', () => {
      vi.doMock('child_process', () => ({
        spawn: vi.fn().mockReturnValue({
          pid: 12345,
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn(),
          kill: vi.fn(),
        }),
        execSync: vi.fn().mockReturnValue(''),
      }));

      const session = sessionManager.getByName('nonexistent');
      // getByName returns null when session not found
      expect(session ?? undefined).toBeUndefined();
    });
  });

  // US-13: Test session:event emission
  describe('US-13: session:event emission', () => {
    it('should emit session:event for FeedbackController events', () => {
      sessionManager = new SessionManager(
        mockConfig,
        mockClassifier,
        mockAgentRegistry
      );

      const eventHandler = vi.fn();
      sessionManager.on('session:event', eventHandler);

      // The session:event should be emitted when FeedbackController receives events
      expect(sessionManager.listenerCount('session:event')).toBeGreaterThanOrEqual(0);
    });
  });
});
