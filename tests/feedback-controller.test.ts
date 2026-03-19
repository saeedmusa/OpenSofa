/**
 * Tests for Feedback Controller replay handling and approval classification
 */

import { describe, it, expect, vi } from 'vitest';
import { FeedbackController } from '../src/feedback-controller.js';
import { PermissionClassifier } from '../src/permission-classifier.js';
import type { OpenSofaConfig, Session, FeedbackEvent } from '../src/types.js';

function createConfig(): OpenSofaConfig {
  return {
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
}

function createSession(): Session {
  return {
    name: 'test',
    status: 'active',
    agentType: 'claude',
    model: '',
    port: 3284,
    pid: 12345,
    repoDir: '/tmp/repo',
    workDir: '/tmp/repo-test',
    branch: 'feat/test',
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    agentStatus: 'stable',
    feedbackController: null,
    autoApprove: false,
    screenshotsEnabled: true,
  };
}

describe('FeedbackController', () => {
  it('skips exact replay updates for same message id', () => {
    const controller = new FeedbackController(createSession(), createConfig(), new PermissionClassifier());
    const eventSpy = vi.fn<(event: FeedbackEvent) => void>();
    controller.on('event', eventSpy);

    (controller as any).handleMessageUpdate({
      id: 1,
      role: 'agent',
      message: 'hello',
      time: new Date().toISOString(),
    });

    (controller as any).handleMessageUpdate({
      id: 1,
      role: 'agent',
      message: 'hello',
      time: new Date().toISOString(),
    });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy.mock.calls[0]?.[0].type).toBe('text');
    expect(eventSpy.mock.calls[0]?.[0].content).toBe('hello');
  });

  it('ignores stale message ids after reconnect replay', () => {
    const controller = new FeedbackController(createSession(), createConfig(), new PermissionClassifier());
    const eventSpy = vi.fn<(event: FeedbackEvent) => void>();
    controller.on('event', eventSpy);

    (controller as any).handleMessageUpdate({
      id: 2,
      role: 'agent',
      message: 'newer output',
      time: new Date().toISOString(),
    });

    (controller as any).handleMessageUpdate({
      id: 1,
      role: 'agent',
      message: 'older replay output',
      time: new Date().toISOString(),
    });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy.mock.calls[0]?.[0].agentMessageId).toBe(2);
  });

  it('emits only delta for growing updates on same message id', () => {
    const controller = new FeedbackController(createSession(), createConfig(), new PermissionClassifier());
    const eventSpy = vi.fn<(event: FeedbackEvent) => void>();
    controller.on('event', eventSpy);

    (controller as any).handleMessageUpdate({
      id: 5,
      role: 'agent',
      message: 'hel',
      time: new Date().toISOString(),
    });

    (controller as any).handleMessageUpdate({
      id: 5,
      role: 'agent',
      message: 'hello',
      time: new Date().toISOString(),
    });

    expect(eventSpy).toHaveBeenCalledTimes(2);
    expect(eventSpy.mock.calls[0]?.[0].content).toBe('hel');
    expect(eventSpy.mock.calls[1]?.[0].content).toBe('lo');
    expect(eventSpy.mock.calls[1]?.[0].priority).toBe('p2');
  });

  it('emits approval event as p0 when approval pattern is detected', () => {
    const controller = new FeedbackController(createSession(), createConfig(), new PermissionClassifier());
    const eventSpy = vi.fn<(event: FeedbackEvent) => void>();
    controller.on('event', eventSpy);

    (controller as any).handleMessageUpdate({
      id: 10,
      role: 'agent',
      message: "I'd like to run: npm install express\nDo you want to proceed?",
      time: new Date().toISOString(),
    });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const event = eventSpy.mock.calls[0]?.[0];
    expect(event?.type).toBe('approval');
    expect(event?.priority).toBe('p0');
  });
});
