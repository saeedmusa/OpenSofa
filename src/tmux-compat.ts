/**
 * OpenSofa - Tmux Compatibility Layer
 *
 * Provides the same interface as current tmux functions but uses ProcessManager internally.
 * Allows gradual migration from tmux to node-pty based process management.
 */

import { EventEmitter } from 'events';
import { createLogger } from './utils/logger.js';
import { ProcessManager, type ProcessOptions, type ManagedProcess } from './process-manager.js';

const log = createLogger('tmux-compat');

// ── Types ──────────────────────────────────────────────

export interface TmuxCompatOptions {
  processManager?: ProcessManager;
  defaultCols?: number;
  defaultRows?: number;
}

export interface TmuxSession {
  name: string;
  pid: number;
  port: number;
  createdAt: number;
  status: 'active' | 'stopped';
}

// ── Tmux Compatibility Class ──────────────────────────

export class TmuxCompatibility extends EventEmitter {
  private processManager: ProcessManager;
  private sessions: Map<string, TmuxSession> = new Map();
  private readonly defaultCols: number;
  private readonly defaultRows: number;

  constructor(options: TmuxCompatOptions = {}) {
    super();
    this.processManager = options.processManager ?? new ProcessManager();
    this.defaultCols = options.defaultCols ?? 120;
    this.defaultRows = options.defaultRows ?? 36;

    // Forward process manager events
    this.processManager.on('output', (data) => {
      this.emit('output', data);
    });

    this.processManager.on('exit', (data) => {
      this.handleProcessExit(data.pid);
    });
  }

  /**
   * Create a new tmux-like session
   * Equivalent to: tmux new-session -d -s <name> -x <cols> -y <rows> <command> <args...>
   */
  createSession(
    sessionName: string,
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string>;
      cols?: number;
      rows?: number;
    },
  ): TmuxSession {
    log.info('Creating tmux-compat session', { sessionName, command, args });

    // Check if session already exists
    if (this.sessions.has(sessionName)) {
      throw new Error(`Session '${sessionName}' already exists`);
    }

    const processOptions: ProcessOptions = {
      command,
      args,
      cwd: options.cwd,
      env: options.env,
      cols: options.cols ?? this.defaultCols,
      rows: options.rows ?? this.defaultRows,
      name: 'xterm-256color',
    };

    const managed = this.processManager.spawn(processOptions);

    const session: TmuxSession = {
      name: sessionName,
      pid: managed.pid,
      port: 0, // Will be set by caller
      createdAt: Date.now(),
      status: 'active',
    };

    this.sessions.set(sessionName, session);
    log.info('Tmux-compat session created', { sessionName, pid: managed.pid });

    return session;
  }

  /**
   * Kill a session
   * Equivalent to: tmux kill-session -t <name>
   */
  killSession(sessionName: string): void {
    const session = this.sessions.get(sessionName);
    if (!session) {
      log.debug('Session not found for kill', { sessionName });
      return;
    }

    log.info('Killing tmux-compat session', { sessionName });

    // Find the managed process by PID
    const proc = this.processManager.getProcess(session.pid);
    if (proc) {
      this.processManager.kill(session.pid);
    }

    session.status = 'stopped';
    this.sessions.delete(sessionName);
  }

  /**
   * List all sessions
   * Equivalent to: tmux list-sessions -F '#{session_name}'
   */
  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Check if a session exists
   */
  sessionExists(sessionName: string): boolean {
    return this.sessions.has(sessionName);
  }

  /**
   * Get session by name
   */
  getSession(sessionName: string): TmuxSession | undefined {
    return this.sessions.get(sessionName);
  }

  /**
   * Capture pane content
   * Equivalent to: tmux capture-pane -t <name> -p -S -<lines>
   */
  capturePane(sessionName: string, lines: number = 50): string {
    const session = this.sessions.get(sessionName);
    if (!session) {
      log.warn('Cannot capture pane: session not found', { sessionName });
      return '';
    }

    return this.processManager.capture(session.pid, lines);
  }

  /**
   * Resize session terminal
   * Equivalent to: tmux resize-window -t <name> -x <cols> -y <rows>
   */
  resizeSession(sessionName: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionName);
    if (!session) {
      log.warn('Cannot resize: session not found', { sessionName });
      return;
    }

    this.processManager.resize(session.pid, cols, rows);
  }

  /**
   * Get pane PID
   * Equivalent to: tmux list-panes -t <name> -F '#{pane_pid}'
   */
  getPanePid(sessionName: string): number {
    const session = this.sessions.get(sessionName);
    if (!session) {
      log.warn('Cannot get PID: session not found', { sessionName });
      return 0;
    }

    return session.pid;
  }

  /**
   * Write to session stdin
   * Equivalent to: tmux send-keys -t <name> <keys>
   */
  sendKeys(sessionName: string, keys: string): void {
    const session = this.sessions.get(sessionName);
    if (!session) {
      log.warn('Cannot send keys: session not found', { sessionName });
      return;
    }

    this.processManager.writeToProcess(session.pid, keys);
  }

  /**
   * Check if server is running (always true for node-pty)
   * Equivalent to: tmux list-sessions (server check)
   */
  isServerRunning(): boolean {
    return true; // node-pty doesn't have a server concept
  }

  /**
   * Ensure server is running (no-op for node-pty)
   * Equivalent to: tmux start-server
   */
  ensureServer(): void {
    // No-op for node-pty
    log.debug('ensureServer called (no-op for node-pty)');
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TmuxSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up all sessions
   */
  cleanup(): void {
    log.info('Cleaning up all tmux-compat sessions', { count: this.sessions.size });

    for (const [sessionName] of this.sessions) {
      this.killSession(sessionName);
    }

    this.sessions.clear();
  }

  /**
   * Get the underlying process manager
   */
  getProcessManager(): ProcessManager {
    return this.processManager;
  }

  // ── Private Methods ──────────────────────────────────

  /**
   * Handle process exit event
   */
  private handleProcessExit(pid: number): void {
    // Find session by PID
    for (const [sessionName, session] of this.sessions) {
      if (session.pid === pid) {
        session.status = 'stopped';
        this.sessions.delete(sessionName);
        this.emit('session:exit', { sessionName, pid });
        log.info('Tmux-compat session exited', { sessionName, pid });
        break;
      }
    }
  }
}

// ── Factory Functions ──────────────────────────────────

/**
 * Create a tmux compatibility layer
 */
export function createTmuxCompat(options?: TmuxCompatOptions): TmuxCompatibility {
  return new TmuxCompatibility(options);
}

/**
 * Check if tmux is available (always true for node-pty)
 * This function exists for backward compatibility
 */
export function isTmuxAvailable(): boolean {
  return true;
}
