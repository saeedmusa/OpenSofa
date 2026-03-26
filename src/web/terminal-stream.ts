/**
 * OpenSofa Web - Terminal Stream Manager
 *
 * Manages real-time terminal streaming using tmux pipe-pane.
 * Each AgentAPI session gets its own tmux pane, which we pipe to a log file
 * and then tail -f to stream to WebSocket clients.
 */

import { spawn, ChildProcess, execFileSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { WebSocket } from 'ws';
import { createLogger } from '../utils/logger.js';

const log = createLogger('web:terminal-stream');

const LOG_FILE_DIR = '/tmp';
const TMUX_SESSION_PREFIX = 'agentapi-';

// ──────────────────────────────────────
// Pure Functions
// ──────────────────────────────────────

/**
 * Get the log file path for a port
 */
export const getLogPath = (port: number): string => {
  const sanitizedPort = String(port).replace(/[^0-9]/g, '');
  return `${LOG_FILE_DIR}/terminal-${sanitizedPort}.log`;
};

/**
 * Get the tmux session name for a port
 */
export const getTmuxSessionName = (port: number): string => {
  const sanitizedPort = String(port).replace(/[^0-9]/g, '');
  return `${TMUX_SESSION_PREFIX}${sanitizedPort}`;
};

/**
 * Build tmux pipe-pane command arguments
 */
export const buildPipeArgs = (sessionName: string, logPath: string): string[] => [
  'pipe-pane',
  '-t', sessionName,
  '-o',  // Only pipe when pane has output
  `cat >> ${logPath}`,
];

/**
 * Build tmux unpipe command arguments
 */
export const buildUnpipeArgs = (sessionName: string): string[] => [
  'pipe-pane',
  '-t', sessionName,
  '',  // Empty command stops piping
];

/**
 * Build tail -f command arguments
 */
export const buildTailArgs = (logPath: string): string[] => [
  '-f',
  '-c', '+0',  // Start from beginning, output bytes
  logPath,
];

/**
 * Encode terminal data for WebSocket transmission
 */
export const encodeTerminalData = (data: Buffer): string =>
  data.toString('base64');

// ──────────────────────────────────────
// Process Spawner Interface (for DI)
// ──────────────────────────────────────

export interface TerminalProcessSpawner {
  spawnTmux: (args: string[]) => ChildProcess;
  spawnTail: (args: string[]) => ChildProcess;
  execTmux: (args: string[]) => void;
}

export const defaultTerminalSpawner: TerminalProcessSpawner = {
  spawnTmux: (args) => spawn('tmux', args, { stdio: ['ignore', 'pipe', 'pipe'] }),
  spawnTail: (args) => spawn('tail', args, { stdio: ['ignore', 'pipe', 'pipe'] }),
  execTmux: (args) => { execFileSync('tmux', args, { stdio: 'pipe' }); },
};

// ──────────────────────────────────────
// Terminal Stream Interface
// ──────────────────────────────────────

export interface TerminalStream {
  start: (port: number) => void;
  stop: (port: number) => void;
  subscribe: (ws: WebSocket, port: number) => void;
  unsubscribe: (ws: WebSocket) => void;
  stopAll: () => void;
  isStreaming: (port: number) => boolean;
}

export interface TerminalStreamDeps {
  spawner?: TerminalProcessSpawner;
  onOutput?: (port: number, data: Buffer) => void;
}

// ──────────────────────────────────────
// Terminal Stream Factory
// ──────────────────────────────────────

export const createTerminalStream = (deps?: TerminalStreamDeps): TerminalStream => {
  const spawner = deps?.spawner ?? defaultTerminalSpawner;

  // State
  const tailProcesses = new Map<number, ChildProcess>();
  const logPaths = new Map<number, string>();
  const subscribers = new Map<WebSocket, number>();

  const broadcastToSubscribers = (port: number, data: Buffer): void => {
    if (deps?.onOutput) {
      deps.onOutput(port, data);
    }

    const message = JSON.stringify({
      type: 'terminal_output',
      payload: { data: encodeTerminalData(data) },
      timestamp: Date.now(),
    });

    for (const [ws, wsPort] of subscribers) {
      if (wsPort === port && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (err) {
          log.warn('Failed to send terminal data', { port, error: String(err) });
        }
      }
    }
  };

  const start = (port: number): void => {
    if (tailProcesses.has(port)) {
      log.debug('Terminal stream already running', { port });
      return;
    }

    const logPath = getLogPath(port);
    const sessionName = getTmuxSessionName(port);
    logPaths.set(port, logPath);

    // Clean up old log file
    if (existsSync(logPath)) {
      try {
        unlinkSync(logPath);
      } catch (err) {
        log.warn('Failed to remove old log file', { logPath, error: String(err) });
      }
    }

    // Start tmux pipe-pane
    try {
      spawner.execTmux(buildPipeArgs(sessionName, logPath));
      log.debug('Started tmux pipe-pane', { sessionName, logPath });
    } catch (err) {
      log.error('Failed to start tmux pipe-pane', { sessionName, error: String(err) });
      return;
    }

    // Start tail -f
    const tail = spawner.spawnTail(buildTailArgs(logPath));
    tailProcesses.set(port, tail);

    tail.stdout?.on('data', (data: Buffer) => {
      broadcastToSubscribers(port, data);
    });

    tail.stderr?.on('data', (data: Buffer) => {
      log.debug('tail stderr', { port, output: data.toString().trim() });
    });

    tail.on('error', (err) => {
      log.error('tail process error', { port, error: err.message });
      tailProcesses.delete(port);
    });

    tail.on('exit', (code) => {
      log.debug('tail process exited', { port, code });
      tailProcesses.delete(port);
    });

    log.info('Terminal stream started', { port });
  };

  const stop = (port: number): void => {
    // Stop tmux pipe
    const sessionName = getTmuxSessionName(port);
    try {
      spawner.execTmux(buildUnpipeArgs(sessionName));
    } catch (err) {
      log.debug('Failed to stop tmux pipe-pane', { sessionName, error: String(err) });
    }

    // Kill tail process
    const tail = tailProcesses.get(port);
    if (tail) {
      tail.kill();
      tailProcesses.delete(port);
    }

    // Clean up log file
    const logPath = logPaths.get(port);
    if (logPath && existsSync(logPath)) {
      try {
        unlinkSync(logPath);
      } catch (err) {
        log.warn('Failed to remove log file', { logPath, error: String(err) });
      }
    }
    logPaths.delete(port);

    log.info('Terminal stream stopped', { port });
  };

  const subscribe = (ws: WebSocket, port: number): void => {
    // Remove from old subscription if any
    unsubscribe(ws);

    // Ensure streaming is active
    start(port);

    // Track subscription
    subscribers.set(ws, port);
    log.debug('WebSocket subscribed to terminal', { port });

    // Handle WebSocket close
    ws.once('close', () => {
      unsubscribe(ws);
    });
  };

  const unsubscribe = (ws: WebSocket): void => {
    const port = subscribers.get(ws);
    if (port !== undefined) {
      subscribers.delete(ws);

      // Stop streaming if no more subscribers
      const hasOtherSubscribers = Array.from(subscribers.values()).includes(port);
      if (!hasOtherSubscribers) {
        stop(port);
      }

      log.debug('WebSocket unsubscribed from terminal', { port });
    }
  };

  const stopAll = (): void => {
    for (const [port] of tailProcesses) {
      stop(port);
    }
    subscribers.clear();
    log.info('All terminal streams stopped');
  };

  const isStreaming = (port: number): boolean => tailProcesses.has(port);

  return {
    start,
    stop,
    subscribe,
    unsubscribe,
    stopAll,
    isStreaming,
  };
};

// ──────────────────────────────────────
// Check if tmux is available
// ──────────────────────────────────────

export const isTmuxAvailable = (): boolean => {
  try {
    execFileSync('which', ['tmux'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
