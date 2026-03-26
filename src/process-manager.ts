/**
 * OpenSofa - Process Manager
 *
 * Manages PTY-based processes using node-pty with child_process.spawn fallback.
 * Provides process spawning, terminal capture, resize, and lifecycle management.
 * 
 * Spawn strategy:
 *   1. Try node-pty.spawn() (full PTY emulation, best experience)
 *   2. If node-pty fails (e.g. posix_spawnp), fall back to child_process.spawn()
 *      with pipe-based I/O — sufficient for agentapi which manages its own PTY
 */

import * as pty from 'node-pty';
import { spawn as cpSpawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { createLogger } from './utils/logger.js';

const log = createLogger('process-manager');

// ── Fallback PTY wrapper ──────────────────────────────
// Wraps child_process.ChildProcess to match pty.IPty interface

class FallbackPty extends EventEmitter {
  private _process: ChildProcess;
  private _pid: number;
  private _dataHandler: ((data: string) => void) | null = null;
  private _exitHandler: ((e: { exitCode: number; signal?: number }) => void) | null = null;

  constructor(command: string, args: string[], options: {
    cwd: string;
    env: Record<string, string>;
  }) {
    super();

    this._process = cpSpawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    this._pid = this._process.pid ?? 0;

    // Forward stdout as terminal data
    this._process.stdout?.on('data', (chunk: Buffer) => {
      const data = chunk.toString('utf-8');
      if (this._dataHandler) this._dataHandler(data);
    });

    // Forward stderr as terminal data too (agents write to both)
    this._process.stderr?.on('data', (chunk: Buffer) => {
      const data = chunk.toString('utf-8');
      if (this._dataHandler) this._dataHandler(data);
    });

    this._process.on('exit', (code, signal) => {
      if (this._exitHandler) {
        this._exitHandler({
          exitCode: code ?? 1,
          signal: signal ? parseInt(signal, 10) || undefined : undefined,
        });
      }
    });

    this._process.on('error', (err) => {
      log.error('FallbackPty process error', { error: String(err) });
      if (this._exitHandler) {
        this._exitHandler({ exitCode: 1 });
      }
    });
  }

  get pid(): number {
    return this._pid;
  }

  onData(handler: (data: string) => void): { dispose: () => void } {
    this._dataHandler = handler;
    return { dispose: () => { this._dataHandler = null; } };
  }

  onExit(handler: (e: { exitCode: number; signal?: number }) => void): { dispose: () => void } {
    this._exitHandler = handler;
    return { dispose: () => { this._exitHandler = null; } };
  }

  write(data: string): void {
    try {
      this._process.stdin?.write(data);
    } catch {
      // stdin may be closed
    }
  }

  resize(_cols: number, _rows: number): void {
    // No-op for pipe-based processes — no terminal to resize
  }

  kill(signal?: string): void {
    try {
      this._process.kill(signal as NodeJS.Signals);
    } catch {
      // Already dead
    }
  }
}

// ── Types ──────────────────────────────────────────────

export interface ProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  cols?: number;
  rows?: number;
  name?: string;
}

export interface ManagedProcess {
  pty: pty.IPty;
  pid: number;
  port: number;
  sessionName: string;
  createdAt: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped';
  outputBuffer: string[];
}

export interface ProcessManagerOptions {
  maxBufferSize?: number;
  defaultCols?: number;
  defaultRows?: number;
}

// ── Constants ──────────────────────────────────────────

const DEFAULT_MAX_BUFFER_SIZE = 1000;
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 36;

// ── Process Manager Class ─────────────────────────────

export class ProcessManager extends EventEmitter {
  private processes: Map<number, ManagedProcess> = new Map();
  private readonly maxBufferSize: number;
  private readonly defaultCols: number;
  private readonly defaultRows: number;

  constructor(options: ProcessManagerOptions = {}) {
    super();
    this.maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    this.defaultCols = options.defaultCols ?? DEFAULT_COLS;
    this.defaultRows = options.defaultRows ?? DEFAULT_ROWS;
  }

  /**
   * Spawn a new process with PTY (node-pty first, child_process.spawn fallback)
   */
  spawn(options: ProcessOptions): ManagedProcess {
    const cols = options.cols ?? this.defaultCols;
    const rows = options.rows ?? this.defaultRows;
    const termName = options.name ?? 'xterm-256color';

    log.info('Spawning process', {
      command: options.command,
      args: options.args,
      cwd: options.cwd,
      cols,
      rows,
    });

    // Try node-pty first (full PTY emulation)
    let ptyLike: pty.IPty | FallbackPty;
    let backend: 'node-pty' | 'child_process';

    try {
      ptyLike = pty.spawn(options.command, options.args, {
        name: termName,
        cols,
        rows,
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env,
          TERM: termName,
        },
      });
      backend = 'node-pty';
    } catch (ptyError) {
      const errMsg = ptyError instanceof Error ? ptyError.message : String(ptyError);
      log.warn('node-pty spawn failed, falling back to child_process.spawn', {
        error: errMsg,
        command: options.command,
      });

      ptyLike = new FallbackPty(options.command, options.args, {
        cwd: options.cwd,
        env: {
          ...options.env,
          TERM: termName,
        },
      });
      backend = 'child_process';

      if (ptyLike.pid === 0) {
        throw new Error(`Failed to spawn process with both node-pty and child_process: ${errMsg}`);
      }
    }

    const managed: ManagedProcess = {
      pty: ptyLike as pty.IPty, // FallbackPty implements the same interface
      pid: ptyLike.pid,
      port: 0, // Will be set by caller
      sessionName: '',
      createdAt: Date.now(),
      status: 'starting',
      outputBuffer: [],
    };

    this.processes.set(ptyLike.pid, managed);

    // Set up data handler to buffer output
    ptyLike.onData((data: string) => {
      this.appendToBuffer(ptyLike.pid, data);
      this.emit('output', { pid: ptyLike.pid, data });
    });

    // Set up exit handler
    ptyLike.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      managed.status = 'stopped';
      this.processes.delete(ptyLike.pid);
      this.emit('exit', { pid: ptyLike.pid, exitCode, signal });
      log.info('Process exited', { pid: ptyLike.pid, exitCode, signal, backend });
    });

    // Mark as running after a short delay
    setTimeout(() => {
      if (managed.status === 'starting') {
        managed.status = 'running';
      }
    }, 100);

    log.info('Process spawned', { pid: ptyLike.pid, backend });
    return managed;
  }

  /**
   * Resize a process's terminal
   */
  resize(pid: number, cols: number, rows: number): void {
    const proc = this.processes.get(pid);
    if (!proc) {
      log.warn('Cannot resize: process not found', { pid });
      return;
    }

    if (proc.status === 'stopped') {
      log.warn('Cannot resize: process already stopped', { pid });
      return;
    }

    try {
      proc.pty.resize(cols, rows);
      log.debug('Terminal resized', { pid, cols, rows });
    } catch (err) {
      log.error('Failed to resize terminal', { pid, error: String(err) });
    }
  }

  /**
   * Capture terminal output for screenshots
   * Returns the last N lines of buffered output
   */
  capture(pid: number, lines: number = 50): string {
    const proc = this.processes.get(pid);
    if (!proc) {
      log.warn('Cannot capture: process not found', { pid });
      return '';
    }

    const buffer = proc.outputBuffer;
    const start = Math.max(0, buffer.length - lines);
    return buffer.slice(start).join('\n');
  }

  /**
   * Kill a process gracefully
   */
  kill(pid: number, signal?: string): void {
    const proc = this.processes.get(pid);
    if (!proc) {
      log.warn('Cannot kill: process not found', { pid });
      return;
    }

    if (proc.status === 'stopped') {
      log.debug('Process already stopped', { pid });
      return;
    }

    proc.status = 'stopping';
    try {
      proc.pty.kill(signal);
      log.info('Process killed', { pid, signal });
    } catch (err) {
      log.error('Failed to kill process', { pid, error: String(err) });
      // Force cleanup
      proc.status = 'stopped';
      this.processes.delete(pid);
    }
  }

  /**
   * Check if a process is alive
   */
  isAlive(pid: number): boolean {
    const proc = this.processes.get(pid);
    if (!proc) return false;
    return proc.status !== 'stopped';
  }

  /**
   * Get the last N lines of output
   */
  getOutput(pid: number, lines: number = 50): string {
    return this.capture(pid, lines);
  }

  /**
   * Get a managed process by PID
   */
  getProcess(pid: number): ManagedProcess | undefined {
    return this.processes.get(pid);
  }

  /**
   * Get all managed processes
   */
  getAllProcesses(): ManagedProcess[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get process count
   */
  getProcessCount(): number {
    return this.processes.size;
  }

  /**
   * Get process statistics
   */
  getStats(): { total: number; running: number; pids: number[] } {
    const running = Array.from(this.processes.values()).filter(
      (p) => p.status === 'running' || p.status === 'starting',
    );
    return {
      total: this.processes.size,
      running: running.length,
      pids: Array.from(this.processes.keys()),
    };
  }

  /**
   * Clean up all processes
   */
  cleanup(): void {
    log.info('Cleaning up all processes', { count: this.processes.size });

    for (const [pid, proc] of this.processes) {
      if (proc.status !== 'stopped') {
        try {
          proc.pty.kill();
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    this.processes.clear();
    this.emit('cleanup');
  }

  /**
   * Write data to a process's stdin
   */
  writeToProcess(pid: number, data: string): void {
    const proc = this.processes.get(pid);
    if (!proc) {
      log.warn('Cannot write: process not found', { pid });
      return;
    }

    if (proc.status === 'stopped') {
      log.warn('Cannot write: process already stopped', { pid });
      return;
    }

    try {
      proc.pty.write(data);
    } catch (err) {
      log.error('Failed to write to process', { pid, error: String(err) });
    }
  }

  // ── Private Methods ──────────────────────────────────

  /**
   * Append data to the output buffer with ring buffer behavior
   */
  private appendToBuffer(pid: number, data: string): void {
    const proc = this.processes.get(pid);
    if (!proc) return;

    // Split data into lines, handling both \n and \r\n
    const lines = data.replace(/\r\n/g, '\n').split('\n');

    for (const line of lines) {
      proc.outputBuffer.push(line);
      if (proc.outputBuffer.length > this.maxBufferSize) {
        proc.outputBuffer.shift();
      }
    }
  }
}

// ── Singleton Instance ─────────────────────────────────

let globalProcessManager: ProcessManager | null = null;

export function getProcessManager(): ProcessManager {
  if (!globalProcessManager) {
    globalProcessManager = new ProcessManager();
  }
  return globalProcessManager;
}

export function resetProcessManager(): void {
  if (globalProcessManager) {
    globalProcessManager.cleanup();
    globalProcessManager = null;
  }
}
