/**
 * OpenSofa Web - Tunnel Manager
 *
 * Manages cloudflared tunnel lifecycle for remote access.
 * Uses dependency injection for process spawning to enable testing.
 */

import { spawn, ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger.js';
import type { TunnelStatus } from './types.js';

const log = createLogger('web:tunnel');

const TUNNEL_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const STARTUP_TIMEOUT_MS = 60000; // Increased to 60s for slower networks

// ──────────────────────────────────────
// Pure Functions
// ──────────────────────────────────────

/**
 * Extract tunnel URL from cloudflared output
 */
export const extractTunnelUrl = (output: string): string | null => {
  const match = output.match(TUNNEL_URL_REGEX);
  return match ? match[0] : null;
};

/**
 * Build cloudflared command arguments
 */
export const buildTunnelArgs = (localPort: number): string[] => [
  'tunnel',
  '--url',
  `http://localhost:${localPort}`,
];

// ──────────────────────────────────────
// Process Spawner Interface (for DI)
// ──────────────────────────────────────

export interface ProcessSpawner {
  spawn: (args: string[]) => ChildProcess;
}

export const defaultSpawner: ProcessSpawner = {
  spawn: (args: string[]) =>
    spawn('cloudflared', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
};

// ──────────────────────────────────────
// Tunnel Manager Interface
// ──────────────────────────────────────

export interface TunnelManager {
  start: () => Promise<string>;
  stop: () => void;
  getUrl: () => string | null;
  getStatus: () => TunnelStatus;
  onStatus: (handler: (status: TunnelStatus, url?: string) => void) => void;
}

export interface TunnelManagerDeps {
  localPort: number;
  spawner?: ProcessSpawner;
  startupTimeoutMs?: number;
}

// ──────────────────────────────────────
// Tunnel Manager Factory
// ──────────────────────────────────────

export const createTunnelManager = (deps: TunnelManagerDeps): TunnelManager => {
  const spawner = deps.spawner ?? defaultSpawner;
  const timeoutMs = deps.startupTimeoutMs ?? STARTUP_TIMEOUT_MS;

  let process: ChildProcess | null = null;
  let url: string | null = null;
  let status: TunnelStatus = 'stopped';
  const statusHandlers = new Set<(status: TunnelStatus, url?: string) => void>();

  /**
   * Tunnel State for Auto-restart
   */
  let restartAttempts = 0;
  const MAX_RESTARTS = 10;
  const RESTART_DELAY_BASE = 2000;
  let lastSuccessfulRunAt = 0;

  const setStatus = (newStatus: TunnelStatus, newUrl?: string): void => {
    status = newStatus;
    if (status === 'running') {
      lastSuccessfulRunAt = Date.now();
    }
    for (const handler of statusHandlers) {
      try {
        handler(status, newUrl);
      } catch (err) {
        log.warn('Status handler error', { error: String(err) });
      }
    }
  };

  const start = async (): Promise<string> => {
    if (status === 'running' && url) {
      return url;
    }

    if (status === 'starting') {
      throw new Error('Tunnel already starting');
    }

    setStatus('starting');
    log.info('Starting cloudflared tunnel', { port: deps.localPort });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        stop();
        reject(new Error('Tunnel startup timeout'));
      }, timeoutMs);

      try {
        process = spawner.spawn(buildTunnelArgs(deps.localPort));
      } catch (err) {
        clearTimeout(timeout);
        setStatus('error');
        reject(new Error(`Failed to spawn cloudflared: ${err}`));
        return;
      }

      process.on('error', (err) => {
        clearTimeout(timeout);
        setStatus('error');
        log.error('Tunnel process error', { error: err.message });
        reject(new Error(`Tunnel process error: ${err.message}`));
      });

      // cloudflared outputs the tunnel URL to BOTH stdout and stderr
      // We need to check both streams
      const checkForUrl = (data: Buffer) => {
        const line = data.toString();
        const extractedUrl = extractTunnelUrl(line);
        if (extractedUrl) {
          clearTimeout(timeout);
          url = extractedUrl;
          setStatus('running', url);
          log.info('Tunnel established', { url });
          resolve(url);
        }
      };

      process.stdout?.on('data', (data: Buffer) => {
        log.debug('cloudflared stdout', { line: data.toString().trim() });
        checkForUrl(data);
      });

      process.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        log.debug('cloudflared stderr', { line });
        checkForUrl(data);
      });

      process.on('exit', (code, signal) => {
        clearTimeout(timeout);
        const previousUrl = url;
        const wasRunning = status === 'running';
        
        url = null;
        process = null;
        setStatus('stopped');
        log.info('Tunnel process exited', { code, signal, wasRunning });
        
        // Auto-restart logic
        if (wasRunning) {
          handleUnexpectedExit(previousUrl);
        }
      });
    });
  };

  const handleUnexpectedExit = (previousUrl: string | null): void => {
    // If we've been running for more than 5 minutes, reset restart attempts
    const now = Date.now();
    if (now - lastSuccessfulRunAt > 5 * 60 * 1000) {
      restartAttempts = 0;
    }

    if (restartAttempts >= MAX_RESTARTS) {
      log.error('Max tunnel restarts reached. Manual intervention required.', {
        attempts: restartAttempts,
        previousUrl
      });
      setStatus('error');
      return;
    }

    const delay = RESTART_DELAY_BASE * Math.pow(2, restartAttempts);
    restartAttempts++;

    log.warn(`Tunnel exited unexpectedly. Restarting in ${delay}ms...`, {
      attempt: restartAttempts,
      maxAttempts: MAX_RESTARTS,
      previousUrl
    });

    setTimeout(() => {
      if (status === 'stopped') {
        start().catch(err => {
          log.error('Auto-restart failed', { error: String(err) });
        });
      }
    }, delay);
  };

  const stop = (): void => {
    if (process) {
      log.info('Stopping tunnel');
      process.kill('SIGTERM');
      process = null;
    }
    url = null;
    setStatus('stopped');
  };

  const getUrl = (): string | null => url;

  const getStatus = (): TunnelStatus => status;

  const onStatus = (handler: (status: TunnelStatus, url?: string) => void): void => {
    statusHandlers.add(handler);
  };

  return {
    start,
    stop,
    getUrl,
    getStatus,
    onStatus,
  };
};

// ──────────────────────────────────────
// Check if cloudflared is available
// ──────────────────────────────────────

import { execSync, execFileSync } from 'child_process';

export const isCloudflaredAvailable = (): boolean => {
  try {
    execFileSync('which', ['cloudflared'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
