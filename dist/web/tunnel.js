/**
 * OpenSofa Web - Tunnel Manager
 *
 * Manages cloudflared tunnel lifecycle for remote access.
 * Uses dependency injection for process spawning to enable testing.
 */
import { spawn } from 'child_process';
import { createLogger } from '../utils/logger.js';
const log = createLogger('web:tunnel');
const TUNNEL_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const STARTUP_TIMEOUT_MS = 60000; // Increased to 60s for slower networks
// ──────────────────────────────────────
// Pure Functions
// ──────────────────────────────────────
/**
 * Extract tunnel URL from cloudflared output
 */
export const extractTunnelUrl = (output) => {
    const match = output.match(TUNNEL_URL_REGEX);
    return match ? match[0] : null;
};
/**
 * Build cloudflared command arguments
 */
export const buildTunnelArgs = (localPort) => [
    'tunnel',
    '--url',
    `http://localhost:${localPort}`,
];
export const defaultSpawner = {
    spawn: (args) => spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
    }),
};
// ──────────────────────────────────────
// Tunnel Manager Factory
// ──────────────────────────────────────
export const createTunnelManager = (deps) => {
    const spawner = deps.spawner ?? defaultSpawner;
    const timeoutMs = deps.startupTimeoutMs ?? STARTUP_TIMEOUT_MS;
    let process = null;
    let url = null;
    let status = 'stopped';
    const statusHandlers = new Set();
    const setStatus = (newStatus, newUrl) => {
        status = newStatus;
        for (const handler of statusHandlers) {
            try {
                handler(status, newUrl);
            }
            catch (err) {
                log.warn('Status handler error', { error: String(err) });
            }
        }
    };
    const start = async () => {
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
            }
            catch (err) {
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
            const checkForUrl = (data) => {
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
            process.stdout?.on('data', (data) => {
                log.debug('cloudflared stdout', { line: data.toString().trim() });
                checkForUrl(data);
            });
            process.stderr?.on('data', (data) => {
                const line = data.toString().trim();
                log.debug('cloudflared stderr', { line });
                checkForUrl(data);
            });
            process.on('exit', (code, signal) => {
                clearTimeout(timeout);
                const previousUrl = url;
                url = null;
                process = null;
                setStatus('stopped');
                log.info('Tunnel process exited', { code, signal });
                // If we were running and exited unexpectedly, log it
                if (status === 'running') {
                    log.warn('Tunnel exited unexpectedly', { code, signal, previousUrl });
                }
            });
        });
    };
    const stop = () => {
        if (process) {
            log.info('Stopping tunnel');
            process.kill('SIGTERM');
            process = null;
        }
        url = null;
        setStatus('stopped');
    };
    const getUrl = () => url;
    const getStatus = () => status;
    const onStatus = (handler) => {
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
import { execFileSync } from 'child_process';
export const isCloudflaredAvailable = () => {
    try {
        execFileSync('which', ['cloudflared'], { stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
};
//# sourceMappingURL=tunnel.js.map