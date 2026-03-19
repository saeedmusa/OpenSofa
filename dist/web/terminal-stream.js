/**
 * OpenSofa Web - Terminal Stream Manager
 *
 * Manages real-time terminal streaming using tmux pipe-pane.
 * Each AgentAPI session gets its own tmux pane, which we pipe to a log file
 * and then tail -f to stream to WebSocket clients.
 */
import { spawn, execSync, execFileSync } from 'child_process';
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
export const getLogPath = (port) => `${LOG_FILE_DIR}/terminal-${port}.log`;
/**
 * Get the tmux session name for a port
 */
export const getTmuxSessionName = (port) => `${TMUX_SESSION_PREFIX}${port}`;
/**
 * Build tmux pipe-pane command arguments
 */
export const buildPipeArgs = (sessionName, logPath) => [
    'pipe-pane',
    '-t', sessionName,
    '-o', // Only pipe when pane has output
    `cat >> ${logPath}`,
];
/**
 * Build tmux unpipe command arguments
 */
export const buildUnpipeArgs = (sessionName) => [
    'pipe-pane',
    '-t', sessionName,
    '', // Empty command stops piping
];
/**
 * Build tail -f command arguments
 */
export const buildTailArgs = (logPath) => [
    '-f',
    '-c', '+0', // Start from beginning, output bytes
    logPath,
];
/**
 * Encode terminal data for WebSocket transmission
 */
export const encodeTerminalData = (data) => data.toString('base64');
export const defaultTerminalSpawner = {
    spawnTmux: (args) => spawn('tmux', args, { stdio: ['ignore', 'pipe', 'pipe'] }),
    spawnTail: (args) => spawn('tail', args, { stdio: ['ignore', 'pipe', 'pipe'] }),
    execTmux: (args) => { execSync(`tmux ${args.join(' ')}`, { stdio: 'pipe' }); },
};
// ──────────────────────────────────────
// Terminal Stream Factory
// ──────────────────────────────────────
export const createTerminalStream = (deps) => {
    const spawner = deps?.spawner ?? defaultTerminalSpawner;
    // State
    const tailProcesses = new Map();
    const logPaths = new Map();
    const subscribers = new Map();
    const broadcastBuffers = new Map();
    const broadcastToSubscribers = (port, data) => {
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
                }
                catch (err) {
                    log.warn('Failed to send terminal data', { port, error: String(err) });
                }
            }
        }
    };
    const start = (port) => {
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
            }
            catch (err) {
                log.warn('Failed to remove old log file', { logPath, error: String(err) });
            }
        }
        // Start tmux pipe-pane
        try {
            spawner.execTmux(buildPipeArgs(sessionName, logPath));
            log.debug('Started tmux pipe-pane', { sessionName, logPath });
        }
        catch (err) {
            log.error('Failed to start tmux pipe-pane', { sessionName, error: String(err) });
            return;
        }
        // Start tail -f
        const tail = spawner.spawnTail(buildTailArgs(logPath));
        tailProcesses.set(port, tail);
        tail.stdout?.on('data', (data) => {
            broadcastToSubscribers(port, data);
        });
        tail.stderr?.on('data', (data) => {
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
    const stop = (port) => {
        // Stop tmux pipe
        const sessionName = getTmuxSessionName(port);
        try {
            spawner.execTmux(buildUnpipeArgs(sessionName));
        }
        catch (err) {
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
            }
            catch (err) {
                log.warn('Failed to remove log file', { logPath, error: String(err) });
            }
        }
        logPaths.delete(port);
        log.info('Terminal stream stopped', { port });
    };
    const subscribe = (ws, port) => {
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
    const unsubscribe = (ws) => {
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
    const stopAll = () => {
        for (const [port] of tailProcesses) {
            stop(port);
        }
        subscribers.clear();
        log.info('All terminal streams stopped');
    };
    const isStreaming = (port) => tailProcesses.has(port);
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
export const isTmuxAvailable = () => {
    try {
        execFileSync('which', ['tmux'], { stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
};
//# sourceMappingURL=terminal-stream.js.map