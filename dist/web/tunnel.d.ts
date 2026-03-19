/**
 * OpenSofa Web - Tunnel Manager
 *
 * Manages cloudflared tunnel lifecycle for remote access.
 * Uses dependency injection for process spawning to enable testing.
 */
import { ChildProcess } from 'child_process';
import type { TunnelStatus } from './types.js';
/**
 * Extract tunnel URL from cloudflared output
 */
export declare const extractTunnelUrl: (output: string) => string | null;
/**
 * Build cloudflared command arguments
 */
export declare const buildTunnelArgs: (localPort: number) => string[];
export interface ProcessSpawner {
    spawn: (args: string[]) => ChildProcess;
}
export declare const defaultSpawner: ProcessSpawner;
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
export declare const createTunnelManager: (deps: TunnelManagerDeps) => TunnelManager;
export declare const isCloudflaredAvailable: () => boolean;
//# sourceMappingURL=tunnel.d.ts.map