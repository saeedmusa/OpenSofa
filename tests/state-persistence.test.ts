/**
 * Tests for State Persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { StatePersistence, serializeSessions } from '../src/state-persistence.js';
import type { Session, PersistedState } from '../src/types.js';

describe('StatePersistence', () => {
  let tempDir: string;
  let statePath: string;
  let statePersistence: StatePersistence;

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opensofa-test-'));
    statePath = path.join(tempDir, 'state.json');
    
    // Mock the getStatePath function by creating instance with custom path
    statePersistence = new StatePersistence(() => ({ sessions: [], lastSavedAt: Date.now() }));
    // Override the internal path
    (statePersistence as any).statePath = statePath;
    (statePersistence as any).tmpPath = statePath + '.tmp';
  });

  afterEach(() => {
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should return empty state when file does not exist', () => {
      const state = statePersistence.load();
      expect(state.sessions).toEqual([]);
      expect(state.lastSavedAt).toBe(0);
    });

    it('should load existing state file', () => {
      const existingState: PersistedState = {
        sessions: [{
          name: 'test-session',
          status: 'active',
          agentType: 'claude',
          model: 'sonnet',
          port: 3284,
          pid: 12345,
          repoDir: '~/test',
          workDir: '~/test-session',
          branch: 'feat/test',
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          autoApprove: false,
          screenshotsEnabled: true,
        }],
        lastSavedAt: Date.now(),
      };
      
      fs.writeFileSync(statePath, JSON.stringify(existingState));
      
      const state = statePersistence.load();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0]!.name).toBe('test-session');
    });

    it('should handle corrupted state file', () => {
      fs.writeFileSync(statePath, 'not valid json');
      
      const state = statePersistence.load();
      expect(state.sessions).toEqual([]);
    });
  });

  describe('save', () => {
    it('should save state to file', async () => {
      const serializeFn = () => ({
        sessions: [{
          name: 'test',
          status: 'active' as const,
          agentType: 'claude' as const,
          model: 'sonnet',
          port: 3284,
          pid: 12345,
          repoDir: '~/test',
          workDir: '~/test-work',
          branch: 'feat/test',
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          autoApprove: false,
          screenshotsEnabled: true,
        }],
        lastSavedAt: Date.now(),
      });
      
      const sp = new StatePersistence(serializeFn);
      (sp as any).statePath = statePath;
      (sp as any).tmpPath = statePath + '.tmp';
      
      await sp.save();
      
      expect(fs.existsSync(statePath)).toBe(true);
      const content = fs.readFileSync(statePath, 'utf-8');
      const state = JSON.parse(content);
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].name).toBe('test');
    });
  });

  describe('saveSync', () => {
    it('should save state synchronously', () => {
      statePersistence.saveSync();
      // Should not throw
    });
  });
});

describe('serializeSessions', () => {
  it('should serialize sessions map', () => {
    const sessions = new Map<string, Session>();
    sessions.set('test', {
      name: 'test',
      status: 'active',
      agentType: 'claude',
      model: 'sonnet',
      port: 3284,
      pid: 12345,
      repoDir: '~/test',
      workDir: '~/test-work',
      branch: 'feat/test',
      createdAt: 1000,
      lastActivityAt: 2000,
      agentStatus: 'stable',
      feedbackController: null,
      autoApprove: false,
      screenshotsEnabled: true,
    });

    const state = serializeSessions(sessions);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]!.name).toBe('test');
    expect(state.lastSavedAt).toBeGreaterThan(0);
  });

  it('should filter out non-active sessions', () => {
    const sessions = new Map<string, Session>();
    sessions.set('active', {
      name: 'active',
      status: 'active',
      agentType: 'claude',
      model: '',
      port: 3284,
      pid: 12345,
      repoDir: '~/test',
      workDir: '~/test-work',
      branch: 'feat/test',
      createdAt: 1000,
      lastActivityAt: 2000,
      agentStatus: 'stable',
      feedbackController: null,
      autoApprove: false,
      screenshotsEnabled: true,
    });
    sessions.set('stopped', {
      name: 'stopped',
      status: 'stopped',
      agentType: 'claude',
      model: '',
      port: 3285,
      pid: 12346,
      repoDir: '~/test2',
      workDir: '~/test2-work',
      branch: 'feat/test2',
      createdAt: 1000,
      lastActivityAt: 2000,
      agentStatus: 'stable',
      feedbackController: null,
      autoApprove: false,
      screenshotsEnabled: true,
    });

    const state = serializeSessions(sessions);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]!.name).toBe('active');
  });

  it('should return empty array for empty map', () => {
    const sessions = new Map<string, Session>();
    const state = serializeSessions(sessions);
    expect(state.sessions).toEqual([]);
  });
});