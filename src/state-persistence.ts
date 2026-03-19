/**
 * OpenSofa - State Persistence
 * 
 * Handles atomic read/write of session state to disk.
 * Implements .tmp → rename pattern for crash safety.
 * Based on LOW_LEVEL_DESIGN.md §13
 */

import fs from 'fs';
import { createLogger } from './utils/logger.js';
import { getStatePath } from './utils/expand-path.js';
import type { PersistedState, Session } from './types.js';

const log = createLogger('state');

/**
 * State Persistence class
 * Singleton - handles all state file I/O
 */
export class StatePersistence {
  private statePath: string;
  private tmpPath: string;
  private periodicSaveTimer: NodeJS.Timeout | null = null;
  private serializeFn: () => PersistedState;

  constructor(serializeFn: () => PersistedState) {
    this.statePath = getStatePath();
    this.tmpPath = this.statePath + '.tmp';
    this.serializeFn = serializeFn;
  }

  /**
   * Load persisted state from disk
   * Returns empty state if file doesn't exist or is corrupted
   */
  load(): PersistedState {
    try {
      if (!fs.existsSync(this.statePath)) {
        log.info('No existing state file found, starting fresh');
        return { sessions: [], lastSavedAt: 0 };
      }

      const content = fs.readFileSync(this.statePath, 'utf-8');
      const state = JSON.parse(content) as PersistedState;
      
      log.info(`Loaded ${state.sessions.length} persisted sessions from state file`);
      return state;
    } catch (err) {
      log.warn('Failed to load state file, starting fresh', { error: String(err) });
      
      // Try to recover from .bak if it exists
      const bakPath = this.statePath + '.bak';
      if (fs.existsSync(bakPath)) {
        try {
          const content = fs.readFileSync(bakPath, 'utf-8');
          const state = JSON.parse(content) as PersistedState;
          log.info(`Recovered ${state.sessions.length} sessions from backup file`);
          return state;
        } catch {
          log.warn('Failed to recover from backup file');
        }
      }
      
      return { sessions: [], lastSavedAt: 0 };
    }
  }

  /**
   * Save state to disk (async, atomic write)
   */
  async save(): Promise<void> {
    try {
      const state = this.serializeFn();
      
      // Backup current state before overwriting
      this.backup();
      
      // Write to .tmp first
      fs.writeFileSync(this.tmpPath, JSON.stringify(state, null, 2), 'utf-8');
      
      // Rename atomically (POSIX guarantees atomicity)
      fs.renameSync(this.tmpPath, this.statePath);
      
      log.debug(`State saved: ${state.sessions.length} sessions`);
    } catch (err) {
      log.error('Failed to save state', { error: String(err) });
    }
  }

  /**
   * Save state synchronously (for emergency shutdown)
   */
  saveSync(): void {
    try {
      const state = this.serializeFn();
      fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch {
      // Best effort — ignore errors during emergency shutdown
    }
  }

  /**
   * Create backup of current state file
   */
  backup(): void {
    try {
      if (fs.existsSync(this.statePath)) {
        fs.copyFileSync(this.statePath, this.statePath + '.bak');
      }
    } catch (err) {
      log.warn('Failed to create state backup', { error: String(err) });
    }
  }

  /**
   * Start periodic state persistence (every 60s as per LLD §13)
   */
  startPeriodicSave(intervalMs: number = 60000): void {
    if (this.periodicSaveTimer) {
      this.stopPeriodicSave();
    }

    this.periodicSaveTimer = setInterval(() => {
      this.save().catch(() => {});
    }, intervalMs);
    
    log.info(`Started periodic state save (every ${intervalMs}ms)`);
  }

  /**
   * Stop periodic state persistence
   */
  stopPeriodicSave(): void {
    if (this.periodicSaveTimer) {
      clearInterval(this.periodicSaveTimer);
      this.periodicSaveTimer = null;
      log.debug('Stopped periodic state save');
    }
  }

  /**
   * Get the state file path
   */
  getStatePath(): string {
    return this.statePath;
  }
}

/**
 * Serialize sessions map to PersistedState
 */
export function serializeSessions(sessions: Map<string, Session>): PersistedState {
  return {
    sessions: Array.from(sessions.values())
      .filter(s => s.status === 'active' || s.status === 'creating')
      .map(s => ({
        name: s.name,
        status: s.status,
        agentType: s.agentType,
        model: s.model,
        port: s.port,
        pid: s.pid,
        repoDir: s.repoDir,
        workDir: s.workDir,
        branch: s.branch,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        autoApprove: s.autoApprove,
        screenshotsEnabled: s.screenshotsEnabled,
      })),
    lastSavedAt: Date.now(),
  };
}