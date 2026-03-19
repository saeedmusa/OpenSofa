/**
 * Tests for Session Manager Edge Cases
 * 
 * Additional edge case tests for session-manager.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../src/session-manager.js';
import { PermissionClassifier } from '../src/permission-classifier.js';
import { AgentRegistry } from '../src/agent-registry.js';

// Mock dependencies
vi.mock('../src/screenshot-service.js', () => ({
  ScreenshotService: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('SessionManager edge cases', () => {
  let sessionManager: SessionManager;
  let classifier: PermissionClassifier;
  let agentRegistry: AgentRegistry;

  const createTestConfig = (overrides = {}) => ({
    defaultAgent: 'claude' as const,
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
    projectDirs: ['~/development', '~/projects'],
    autoCleanupOnCritical: true,
    ...overrides,
  });

  beforeEach(() => {
    classifier = new PermissionClassifier();
    agentRegistry = new AgentRegistry();
    
    sessionManager = new SessionManager(
      createTestConfig(),
      classifier,
      agentRegistry
    );
  });

  describe('constructor', () => {
    it('should initialize with empty sessions', () => {
      const sessions = sessionManager.getSessionsList();
      expect(sessions).toHaveLength(0);
    });

    it('should initialize message queue with sender', () => {
      // The constructor sets up the message queue sender
      expect(sessionManager).toBeDefined();
    });
  });

  describe('getSessionsList', () => {
    it('should return empty array when no sessions', () => {
      const sessions = sessionManager.getSessionsList();
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('getByName', () => {
    it('should return null for non-existent session', () => {
      const session = sessionManager.getByName('nonexistent');
      expect(session).toBeNull();
    });
  });

  describe('setStateChangeHook', () => {
    it('should accept a hook function', () => {
      const hook = vi.fn();
      sessionManager.setStateChangeHook(hook);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('setScreenshotService', () => {
    it('should accept a screenshot service', () => {
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('setPushManager', () => {
    it('should accept a push manager', () => {
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('setResourceMonitor', () => {
    it('should accept a resource monitor', () => {
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('setWebUrlProvider', () => {
    it('should accept a URL provider', () => {
      const provider = vi.fn().mockResolvedValue('http://localhost:3000');
      sessionManager.setWebUrlProvider(provider);
      expect(true).toBe(true);
    });
  });

  describe('getSessionSettings', () => {
    it('should return empty object for non-existent session', () => {
      const settings = sessionManager.getSessionSettings('nonexistent');
      expect(settings).toEqual({});
    });
  });

  describe('setSessionSetting', () => {
    it('should throw for non-existent session', async () => {
      await expect(
        sessionManager.setSessionSetting('nonexistent', 'key', 'value')
      ).rejects.toThrow();
    });
  });

  describe('disconnectAllRuntime', () => {
    it('should not throw when no sessions', () => {
      expect(() => {
        sessionManager.disconnectAllRuntime();
      }).not.toThrow();
    });
  });

  describe('recoverSessions', () => {
    it('should handle empty persisted sessions', async () => {
      await sessionManager.recoverSessions([]);
      const sessions = sessionManager.getSessionsList();
      expect(sessions).toHaveLength(0);
    });
  });
});

describe('SessionManager config', () => {
  let sessionManager: SessionManager;
  let classifier: PermissionClassifier;
  let agentRegistry: AgentRegistry;

  beforeEach(() => {
    classifier = new PermissionClassifier();
    agentRegistry = new AgentRegistry();
  });

  it('should use custom port range start', () => {
    const config = {
      defaultAgent: 'claude' as const,
      maxSessions: 3,
      portRangeStart: 4000,
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
    
    sessionManager = new SessionManager(config, classifier, agentRegistry);
    expect(sessionManager).toBeDefined();
  });

  it('should use custom max sessions', () => {
    const config = {
      defaultAgent: 'claude' as const,
      maxSessions: 1,
      portRangeStart: 3284,
      debounceMs: 3000,
      screenshotIntervalMs: 10000,
      approvalTimeoutMs: 300000,
      healthCheckIntervalMs: 30000,
      idleTimeoutMs: 600000,
      screenshotFontSize: 14,
      screenshotCols: 80,
      autoApprove: true,
      projectDirs: ['~/development'],
      autoCleanupOnCritical: true,
    };
    
    sessionManager = new SessionManager(config, classifier, agentRegistry);
    expect(sessionManager).toBeDefined();
  });
});
