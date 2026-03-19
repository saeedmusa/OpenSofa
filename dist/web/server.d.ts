/**
 * OpenSofa Web - Server Module
 *
 * Creates and manages the HTTP + WebSocket server.
 * Encapsulates Hono app, routes, WebSocket, and terminal streaming.
 */
import { createDefaultTokenManager } from './auth.js';
import { type Notifier } from './notifier.js';
import type { SessionManager } from '../session-manager.js';
import type { AgentRegistry } from '../agent-registry.js';
import type { Broadcaster } from './broadcaster.js';
import type { TunnelStatus } from './types.js';
import type { WebConfig } from './types.js';
export interface WebServerConfig {
    enabled: boolean;
    port: number;
    tunnel: {
        provider: 'cloudflare' | 'local' | 'disabled';
    };
    auth: {
        tokenPath: string;
        tokenExpiryHours: number;
    };
}
export declare const DEFAULT_WEB_CONFIG: WebConfig;
export interface WebServerDeps {
    sessionManager: SessionManager;
    agentRegistry: AgentRegistry;
    notifier: Notifier;
    webConfig: WebConfig;
    getUptime: () => number;
    getSystemResources: () => {
        cpu: string;
        freeMem: string;
    };
}
export interface WebServer {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    getTunnelUrl: () => string | null;
    getTunnelStatus: () => TunnelStatus;
    getBroadcaster: () => Broadcaster;
    getTokenManager: () => ReturnType<typeof createDefaultTokenManager>;
    getQRCodeUrl: () => Promise<string | null>;
    revokeToken: () => void;
}
export declare const createWebServer: (deps: WebServerDeps) => WebServer;
//# sourceMappingURL=server.d.ts.map