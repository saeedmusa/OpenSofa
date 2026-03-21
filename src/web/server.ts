/**
 * OpenSofa Web - Server Module
 *
 * Creates and manages the HTTP + WebSocket server.
 * Encapsulates Hono app, routes, WebSocket, and terminal streaming.
 */

import { IncomingMessage } from 'http';
import { execSync } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve, type ServerType } from '@hono/node-server';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../utils/logger.js';
import { createApiRoutes } from './routes/index.js';
import { createBroadcaster, createEvent, parseMessage } from './broadcaster.js';
import { createTunnelManager, isCloudflaredAvailable } from './tunnel.js';
import { createTerminalStream } from './terminal-stream.js';
import { bodyLimit } from 'hono/body-limit';
import { createRateLimiter } from './middleware/rate-limit.js';
import { createAuthMiddleware, validateWebSocketAuth } from './middleware/auth.js';
import { isIpBanned, recordIpStrike } from './ip-ban.js';
import { createDefaultTokenManager, validateToken } from './auth.js';
import { ACPEventParser } from './event-parser/acp-parser.js';
import { mapACPTextToAGUI, mapACPToolCallToAGUI, mapACPToolResultToAGUI } from './event-parser/acp-mapper.js';
import { mapAGUIToActivityEvent } from './event-parser/mapper.js';
import { type Notifier } from './notifier.js';
import type { SessionManager } from '../session-manager.js';
import type { AgentRegistry } from '../agent-registry.js';
import type { TunnelManager } from './tunnel.js';
import type { Broadcaster } from './broadcaster.js';
import type { TunnelStatus } from './types.js';
import type { TerminalStream } from './terminal-stream.js';
import type { WebConfig } from './types.js';
import type { Server as HttpServerType } from 'http';
import { sessionToSummary } from './types.js';
import { randomUUID } from 'crypto';
import qrcode from 'qrcode';

const log = createLogger('web:server');

const WEB_PORT = 3285;
const WEB_PUBLIC_DIR = 'src/web/public';

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

export const DEFAULT_WEB_CONFIG: WebConfig = {
  enabled: true,
  port: WEB_PORT,
  tunnel: {
    provider: 'cloudflare',
  },
  auth: {
    tokenPath: '~/.opensofa/web-token',
    tokenExpiryHours: 24,
  },
};

export interface WebServerDeps {
  sessionManager: SessionManager;
  agentRegistry: AgentRegistry;
  notifier: Notifier;
  webConfig: WebConfig;
  getUptime: () => number;
  getSystemResources: () => { cpu: string; freeMem: string };
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

export const createWebServer = (deps: WebServerDeps): WebServer => {
  const { sessionManager, agentRegistry, notifier, webConfig, getUptime, getSystemResources } = deps;

  let httpServer: ServerType | null = null;
  let wss: WebSocketServer | null = null;
  let tunnelManager: TunnelManager | null = null;
  let terminalStream: TerminalStream | null = null;
  let broadcaster: Broadcaster | null = null;
  let tokenManager: ReturnType<typeof createDefaultTokenManager> | null = null;

  const start = async (): Promise<void> => {
    if (!webConfig.enabled) {
      log.info('Web interface disabled in config');
      return;
    }

    // Initialize token manager
    tokenManager = createDefaultTokenManager(webConfig);
    const token = tokenManager.getOrGenerate();
    log.info('Auth token ready');

    // Initialize broadcaster
    broadcaster = createBroadcaster({
      onClientMessage: async (clientId, message) => {
        if (message.type === 'subscribe_terminal' && message.sessionName) {
          broadcaster!.setTerminalSubscription(clientId, message.sessionName);
          const session = sessionManager.getByName(message.sessionName);
          if (session && terminalStream) {
            const socket = getSocketForClient(clientId);
            if (socket) {
              terminalStream.subscribe(socket, session.port);
            }
          }
        } else if (message.type === 'unsubscribe_terminal') {
          broadcaster!.setTerminalSubscription(clientId, null);
        } else if (message.type === 'terminal_resize' && message.payload) {
          // Handle terminal resize - resize tmux session
          const { sessionId, cols, rows } = message.payload as { sessionId: string; cols: number; rows: number };
          const session = sessionManager.getByName(sessionId);
          if (session) {
            try {
              const sessionName = `agentapi-${session.port}`;
              execSync(`tmux set-option -t ${sessionName} default-size ${cols}x${rows} 2>/dev/null`, { stdio: 'pipe' });
              log.debug('Terminal resized', { sessionId, cols, rows });
            } catch {
              // Ignore resize errors - session may not exist
            }
          }
        } else if (message.type === 'terminal_input' && message.payload) {
          // Handle terminal input - send to agent
          const { sessionId, content } = message.payload as { sessionId: string; content: string };
          const session = sessionManager.getByName(sessionId);
          if (session) {
            await sessionManager.sendToAgent(session, content);
          }
        } else if (message.type === 'terminal_command' && message.payload) {
          // Handle quick command palette commands
          const { sessionId, command } = message.payload as { sessionId: string; command: string };
          const session = sessionManager.getByName(sessionId);
          if (session) {
            switch (command) {
              case 'approve':
                await sessionManager.handleSessionCommand(session, { cmd: 'approve' });
                break;
              case 'reject':
                await sessionManager.handleSessionCommand(session, { cmd: 'reject' });
                break;
              case 'stop':
                await sessionManager.handleSessionCommand(session, { cmd: 'stop' });
                break;
              case 'help':
                await sessionManager.handleSessionCommand(session, { cmd: 'help' });
                break;
              case 'screenshot':
                await sessionManager.handleSessionCommand(session, { cmd: 'screenshot' });
                break;
            }
            log.debug('Terminal command executed', { sessionId, command });
          }
        } else if (message.type === 'terminal_interrupt' && message.payload) {
          // Handle Ctrl+C interrupt - send raw to agent
          const { sessionId } = message.payload as { sessionId: string };
          const session = sessionManager.getByName(sessionId);
          if (session) {
            try {
              const { AgentAPIClient } = await import('../agentapi-client.js');
              await new AgentAPIClient(session.port).sendRaw('\x03');
              log.debug('Terminal interrupt sent', { sessionId });
            } catch (err) {
              log.warn('Failed to send interrupt', { sessionId, error: String(err) });
            }
          }
        } else if (message.type === 'sync_request') {
          // Handle sync request for session state recovery
          const { since, sessionName } = message.payload as { since: number; sessionName?: string };

          // Get missed events from broadcaster's event history
          const missedEvents = broadcaster?.getEventsSince(since, sessionName);

          // Send events back to client
          const socket = getSocketForClient(clientId);
          if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
              type: 'sync_response',
              payload: { events: missedEvents || [] }
            }));
          }
        }
      },
    });

    // Initialize terminal stream with activity parsing
    terminalStream = createTerminalStream({
      onOutput: (port: number, _data: Buffer) => {
        const sessions = sessionManager.getActiveSessions();
        const session = sessions.find(s => s.port === port);
        if (!session || !broadcaster) return;

        // Events come from ACP parser, not terminal output
        // Terminal output is handled separately via terminalStream
      },
    });

    // Create Hono app
    const app = new Hono();

    // Payload size limiter (2MB max)
    app.use('*', bodyLimit({
      maxSize: 2 * 1024 * 1024,
      onError: (c) => c.json({ success: false, error: 'Payload size exceeds 2MB limit' }, 413)
    }));

    // Rate limiter (100 req per minute)
    app.use('*', createRateLimiter({ windowMs: 60000, max: 100 }));

    // Strict CORS for PWA
    app.use('*', cors({
      origin: (origin) => {
        if (!origin) return '';
        const isLocalhost = origin === `http://localhost:${WEB_PORT}` || origin === `http://127.0.0.1:${WEB_PORT}`;
        const tunnelUrl = tunnelManager?.getUrl();
        const isTunnel = tunnelUrl ? origin === tunnelUrl || origin.startsWith(tunnelUrl) : false;
        if (isLocalhost || isTunnel) {
          return origin;
        }
        return '';
      },
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }));

    // Health check (no auth)
    app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

    // Auth middleware for API routes
    const authMiddleware = createAuthMiddleware({ expectedToken: token });
    app.use('/api/*', authMiddleware);

    // Browse filesystem endpoint (for session creation)
    app.get('/api/browse', async (c) => {
      const queryPath = c.req.query('path') ?? '';
      const homeDir = process.env.HOME || '/root';
      const basePath = path.resolve(homeDir, queryPath);

      // Security: only allow browsing under home directory and prevent substring traversal (e.g. /home/user -> /home/user2)
      if (!basePath.startsWith(homeDir + path.sep) && basePath !== homeDir) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }

      try {
        if (!fs.existsSync(basePath)) {
          return c.json({ success: true, data: { entries: [] } });
        }

        const entries = (await fs.promises.readdir(basePath, { withFileTypes: true }))
          .filter(dirent => !dirent.name.startsWith('.'))
          .filter(dirent => dirent.isDirectory())
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 100)
          .map(dirent => {
            const fullPath = path.join(basePath, dirent.name);
            const gitPath = path.join(fullPath, '.git');
            const isGitRepo = fs.existsSync(gitPath);

            // Check if it's a worktree (file instead of directory)
            let isWorktree = false;
            if (isGitRepo) {
              try {
                const stats = fs.statSync(gitPath);
                isWorktree = stats.isFile();
              } catch {
                // Ignore
              }
            }

            return {
              name: dirent.name,
              type: dirent.isDirectory() ? 'directory' as const : 'file' as const,
              isGitRepo,
              isWorktree,
            };
          });

        return c.json({ success: true, data: { entries, currentPath: queryPath } });
      } catch (err) {
        log.warn('Failed to browse directory', { path: basePath, error: String(err) });
        return c.json({ success: true, data: { entries: [], currentPath: queryPath } });
      }
    });

    // Mount API routes
    const apiRoutes = createApiRoutes({
      sessionManager,
      agentRegistry,
      notifier,
      getTunnelManager: () => tunnelManager,
      getUptime,
      getSystemResources,
      revokeToken,
      token,
    });
    app.route('/api', apiRoutes);

    // Serve static files from built frontend
    const frontendDist = path.join(process.cwd(), 'dist', 'web', 'frontend');

    // Serve static assets
    app.use('/assets/*', serveStatic({ root: frontendDist }));

    // Serve other static files (favicon, etc)
    app.use('/*', serveStatic({ root: frontendDist }));

    // SPA fallback - serve index.html for non-API routes
    app.notFound(async (c) => {
      if (c.req.path.startsWith('/api')) {
        return c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404);
      }

      // Development mode: proxy to Vite dev server if frontend not built
      const isDev = process.env.NODE_ENV !== 'production';
      const vitePort = process.env.VITE_PORT || '5173';
      const indexPath = path.join(frontendDist, 'index.html');
      const frontendBuilt = fs.existsSync(indexPath);

      if (isDev && !frontendBuilt) {
        try {
          const viteUrl = `http://localhost:${vitePort}${c.req.path}`;
          const response = await fetch(viteUrl, {
            headers: Object.fromEntries(
              Object.entries(c.req.header()).filter(([, v]) => v !== undefined) as [string, string][]
            ),
          });
          const body = await response.text();
          const contentType = response.headers.get('content-type') || 'text/html';
          return new Response(body, {
            status: response.status,
            headers: { 'content-type': contentType },
          });
        } catch {
          return c.html(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>OpenSofa Web</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #030712;
                  color: #e5e5e5;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                }
                .container { text-align: center; padding: 2rem; }
                h1 { margin-bottom: 1rem; }
                p { color: #9ca3af; margin-bottom: 0.5rem; }
                code { 
                  background: #1f2937;
                  padding: 0.25rem 0.5rem;
                  border-radius: 0.25rem;
                  font-size: 0.875rem;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>OpenSofa Web</h1>
                <p>Vite dev server not running on port ${vitePort}.</p>
                <p>Start it with: <code>npm run dev:frontend</code></p>
                <p style="margin-top: 2rem;">
                  <a href="https://github.com/anomalyco/opensofa" style="color: #60a5fa;">Documentation</a>
                </p>
              </div>
            </body>
            </html>
          `, 503);
        }
      }

      // Production mode: serve built frontend
      try {
        const indexContent = await fs.promises.readFile(indexPath, 'utf-8');
        return c.html(indexContent, 200);
      } catch {
        return c.html(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>OpenSofa Web</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #030712;
                color: #e5e5e5;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
              }
              .container { text-align: center; padding: 2rem; }
              h1 { margin-bottom: 1rem; }
              p { color: #9ca3af; margin-bottom: 0.5rem; }
              code { 
                background: #1f2937;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                font-size: 0.875rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>OpenSofa Web</h1>
              <p>Frontend not built. Run <code>npm run build:frontend</code></p>
              <p style="margin-top: 2rem;">
                <a href="https://github.com/anomalyco/opensofa" style="color: #60a5fa;">Documentation</a>
              </p>
            </div>
          </body>
          </html>
        `, 200);
      }
    });

    // Start HTTP server using @hono/node-server
    httpServer = serve({
      fetch: app.fetch,
      port: webConfig.port,
    });

    // Create WebSocket server attached to HTTP server
    wss = new WebSocketServer({ server: httpServer as HttpServerType, path: '/ws' });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // Extract IP from request
      const cfIP = req.headers['cf-connecting-ip'] as string | undefined;
      const forwarded = req.headers['x-forwarded-for'] as string | undefined;
      
      let ip = 'unknown-ip';
      if (cfIP) {
        ip = cfIP.split(',')[0]?.trim() || 'unknown-ip';
      } else if (forwarded) {
        ip = forwarded.split(',')[0]?.trim() || 'unknown-ip';
      } else {
        ip = req.socket?.remoteAddress || 'unknown-ip';
      }
      
      // Check IP ban immediately
      if (isIpBanned(ip)) {
        log.warn('WebSocket connection rejected - IP banned');
        ws.close(1008, 'IP banned');
        return;
      }

      const url = req.url || '';
      const clientId = randomUUID();
      let authenticated = false;

      // Handle message-based auth (new secure method)
      const authTimeout = setTimeout(() => {
        if (!authenticated) {
          log.warn('WebSocket auth timeout', { clientId });
          ws.close(1008, 'Authentication timeout');
        }
      }, 5000); // 5 second timeout for auth

      ws.once('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth' && message.token) {
            if (validateToken(message.token, token)) {
              authenticated = true;
              clearTimeout(authTimeout);
              
              // Complete connection setup
              storeClientSocket(clientId, ws);
              broadcaster!.addClient(ws, clientId);
              log.debug('WebSocket client connected (message auth)', { clientId });
              
              // Send auth success
              ws.send(JSON.stringify({ type: 'auth_success' }));
              
              // Set up close handler
              ws.on('close', () => {
                removeClientSocket(clientId);
                broadcaster!.removeClient(clientId);
                log.debug('WebSocket client disconnected', { clientId });
              });
              
              ws.on('error', (err) => {
                log.warn('WebSocket error', { clientId, error: String(err) });
              });
            } else {
              recordIpStrike(ip);
              log.warn('WebSocket connection rejected - invalid token (message auth)');
              ws.close(1008, 'Unauthorized');
            }
          } else {
            // Fall back to URL token validation for backward compatibility
            if (validateWebSocketAuth(url, ip, token)) {
              authenticated = true;
              clearTimeout(authTimeout);
              
              storeClientSocket(clientId, ws);
              broadcaster!.addClient(ws, clientId);
              log.debug('WebSocket client connected (URL auth)', { clientId });
              
              ws.on('close', () => {
                removeClientSocket(clientId);
                broadcaster!.removeClient(clientId);
                log.debug('WebSocket client disconnected', { clientId });
              });
              
              ws.on('error', (err) => {
                log.warn('WebSocket error', { clientId, error: String(err) });
              });
              
              // Process the message as normal - forward to any handlers
              // Note: Client messages are handled by the broadcaster's message handler
              try {
                const msg = JSON.parse(data.toString());
                if (msg.type && msg.type !== 'auth') {
                  // Handle non-auth messages (sync_request, etc.)
                  // The broadcaster manages its own message handlers
                }
              } catch {
                // Binary or non-JSON message - ignore or handle as needed
              }
            } else {
              recordIpStrike(ip);
              log.warn('WebSocket connection rejected - invalid auth');
              ws.close(1008, 'Unauthorized');
            }
          }
        } catch {
          // Invalid JSON - treat as URL auth attempt
          if (validateWebSocketAuth(url, ip, token)) {
            authenticated = true;
            clearTimeout(authTimeout);
            
            storeClientSocket(clientId, ws);
            broadcaster!.addClient(ws, clientId);
            log.debug('WebSocket client connected (URL auth - binary)', { clientId });
            
            ws.on('close', () => {
              removeClientSocket(clientId);
              broadcaster!.removeClient(clientId);
              log.debug('WebSocket client disconnected', { clientId });
            });
            
            ws.on('error', (err) => {
              log.warn('WebSocket error', { clientId, error: String(err) });
            });
          } else {
            recordIpStrike(ip);
            log.warn('WebSocket connection rejected - invalid auth');
            ws.close(1008, 'Unauthorized');
          }
        }
      });
    });

    // Wire SessionManager events to broadcaster and terminal stream
    wireSessionEvents(sessionManager, broadcaster, terminalStream, () => tunnelManager?.getUrl() ?? null);

    log.info(`Web server listening on port ${webConfig.port}`);

    // Start tunnel if enabled
    if (webConfig.tunnel.provider === 'cloudflare' && isCloudflaredAvailable()) {
      tunnelManager = createTunnelManager({ localPort: webConfig.port });

      tunnelManager.onStatus((status, url) => {
        if (status === 'running' && url) {
          log.info('Tunnel status update', { status, url });
          broadcaster?.broadcast(createEvent('system_status', { tunnelUrl: url, connected: true }));

          // Update api routes with tunnel manager
          broadcastTunnelUrl(url);
        } else if (status === 'stopped' || status === 'error') {
          broadcaster?.broadcast(createEvent('system_status', { tunnelUrl: null, connected: false }));
        }
      });

      try {
        const tunnelUrl = await tunnelManager.start();
        log.info('Tunnel established', { url: tunnelUrl });

        // Generate and display QR code with token for auto-authentication
        const token = tokenManager.getOrGenerate();
        const qrUrl = `${tunnelUrl}?token=${token}`;
        await displayQRCode(qrUrl);
      } catch (err) {
        log.error('Failed to start tunnel', { error: String(err) });

        // Show local URL with QR code as fallback
        const localUrl = `http://localhost:${WEB_PORT}`;
        const token = tokenManager.getOrGenerate();
        const localQrUrl = `${localUrl}?token=${token}`;
        console.log('\n  [TUNNEL UNAVAILABLE - Using local access]\n');
        await displayQRCode(localQrUrl);
      }
    } else {
      log.info('Tunnel disabled or cloudflared not available');
    }
  };

  const stop = async (): Promise<void> => {
    log.info('Stopping web server...');

    // Stop terminal stream
    if (terminalStream) {
      terminalStream.stopAll();
      terminalStream = null;
    }

    // Stop tunnel
    if (tunnelManager) {
      tunnelManager.stop();
      tunnelManager = null;
    }

    // Close WebSocket server
    if (wss) {
      await new Promise<void>((resolve) => {
        wss!.close(() => {
          log.info('WebSocket server closed');
          resolve();
        });
      });
      wss = null;
    }

    // Close HTTP server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer!.close(() => {
          log.info('HTTP server closed');
          resolve();
        });
      });
      httpServer = null;
    }

    broadcaster = null;
    tokenManager = null;
  };

  const getTunnelUrl = (): string | null => {
    return tunnelManager?.getUrl() ?? null;
  };

  const getTunnelStatus = (): TunnelStatus => {
    return tunnelManager?.getStatus() ?? 'stopped';
  };

  const getBroadcaster = (): Broadcaster => {
    if (!broadcaster) throw new Error('Web server not started');
    return broadcaster;
  };

  const getTokenManager = (): ReturnType<typeof createDefaultTokenManager> => {
    if (!tokenManager) throw new Error('Web server not started');
    return tokenManager;
  };

  const getQRCodeUrl = async (): Promise<string | null> => {
    const tunnelUrl = getTunnelUrl();
    if (!tunnelUrl || !tokenManager) return null;
    const token = tokenManager.getOrGenerate();
    return `${tunnelUrl}?token=${token}`;
  };

  const broadcastTunnelUrl = (url: string) => {
    broadcaster?.broadcast(createEvent('system_status', { tunnelUrl: url, connected: true }));
  };

  const revokeToken = () => {
    if (!tokenManager) return;
    tokenManager.regenerate();
    log.warn('Admin revoked token instantly. All connections will be dropped.');
    
    if (broadcaster) {
      broadcaster.broadcast(createEvent('kill_session', { reason: 'Token revoked by user' }));
    }
    
    if (wss) {
      for (const client of wss.clients) {
        client.terminate();
      }
    }
    
    sessionManager.disconnectAllRuntime();
  };

  return {
    start,
    stop,
    getTunnelUrl,
    getTunnelStatus,
    getBroadcaster,
    getTokenManager,
    getQRCodeUrl,
    revokeToken,
  };
};

// ──────────────────────────────────────
// Helper: Wire SessionManager events to Broadcaster
// ──────────────────────────────────────

function wireSessionEvents(
  sessionManager: SessionManager,
  broadcaster: Broadcaster,
  terminalStream: TerminalStream,
  getTunnelUrl?: () => string | null
): void {
  // Map to store ACP parsers per session
  const acpParsers = new Map<string, ACPEventParser>();

  sessionManager.on('session:created', (session) => {
    broadcaster.broadcast(createEvent('session_created', sessionToSummary(session)));
    terminalStream.start(session.port);

    // Set transport to ACP since we're passing --experimental-acp to AgentAPI
    // This enables the ACP event parser below
    session.transport = 'acp';

    // Set up ACP event handling if transport is ACP
    if (session.transport === 'acp') {
      const acpParser = new ACPEventParser();
      acpParsers.set(session.name, acpParser);

      acpParser.on('tool_call', (tool) => {
        const aguiEvent = mapACPToolCallToAGUI(tool);
        const activity = mapAGUIToActivityEvent(aguiEvent, session.name);
        broadcaster.broadcast(createEvent('activity', { sessionName: session.name, events: [activity] }));
      });

      acpParser.on('text_chunk', (chunk) => {
        const aguiEvent = mapACPTextToAGUI(chunk);
        const activity = mapAGUIToActivityEvent(aguiEvent, session.name);
        broadcaster.broadcast(createEvent('activity', { sessionName: session.name, events: [activity] }));
      });

      acpParser.on('tool_call_update', (update) => {
        const aguiEvent = mapACPToolResultToAGUI(update.status, update.toolName || 'unknown');
        const activity = mapAGUIToActivityEvent(aguiEvent, session.name);
        broadcaster.broadcast(createEvent('activity', { sessionName: session.name, events: [activity] }));
      });

      acpParser.on('status_change', (change) => {
        broadcaster.broadcast(createEvent('session_updated', { agentStatus: change.status }, session.name));
      });

      log.debug('ACP parser set up for session', { sessionName: session.name });
    }
  });

  // Handle ACP events from FeedbackController
  sessionManager.on('session:event', (session, event) => {
    const acpParser = acpParsers.get(session.name);
    if (!acpParser) return;

    if (event.type === 'text') {
      // Reconstruct ACP event envelope from FeedbackEvent
      const envelope = {
        params: {
          SessionUpdate: {} as { AgentMessageChunk?: { Content?: { Text?: { Text?: string } } } },
        },
      };
      
      if (event.role === 'agent' && event.content) {
        envelope.params.SessionUpdate.AgentMessageChunk = {
          Content: {
            Text: {
              Text: event.content,
            },
          },
        };
      }
      
      if (envelope.params.SessionUpdate.AgentMessageChunk) {
        acpParser.parseACPEvent(envelope);
      }
    } else if (event.type === 'tool_call' && event.content) {
      // Parse tool info from content (format: "Kind: Title")
      const colonIndex = event.content.indexOf(':');
      if (colonIndex > 0) {
        const kind = event.content.substring(0, colonIndex).trim();
        const title = event.content.substring(colonIndex + 1).trim();
        acpParser.emit('tool_call', { Kind: kind, Title: title });
      }
    } else if (event.type === 'tool_result' && event.content) {
      // Parse status from content (format: "Tool status")
      const status = event.content.replace(/^Tool\s*/i, '').trim();
      acpParser.emit('tool_call_update', { status, toolName: 'unknown' });
    }
  });

  sessionManager.on('session:stopped', (data: { name: string; port: number }) => {
    // Clean up ACP parser
    acpParsers.delete(data.name);
    broadcaster.broadcast(createEvent('session_stopped', { name: data.name }));
    terminalStream.stop(data.port);
  });

  sessionManager.on('session:updated', (session) => {
    broadcaster.broadcast(createEvent('session_updated', sessionToSummary(session), session.name));
  });

  sessionManager.on('approval:needed', async (session) => {
    broadcaster.broadcast(
      createEvent('approval_needed', {
        sessionName: session.name,
        command: session.pendingApproval?.command ?? null,
      }, session.name)
    );

    // If user is offline, send push notification (US-12)
    try {
      if (broadcaster.isUserOffline()) {
        const { createNotifier } = await import('./notifier.js');
        const notifier = createNotifier();
        if (notifier.isEnabled()) {
          const tunnelUrl = getTunnelUrl?.();
          const clickUrl = tunnelUrl
            ? `${tunnelUrl}/session/${encodeURIComponent(session.name)}`
            : undefined;
          await notifier.sendNotification(
            `OpenSofa: Approval needed in ${session.name}`,
            session.pendingApproval?.command ? `Command: ${session.pendingApproval.command}` : 'A command requires your approval',
            clickUrl
          );
        }
      }
    } catch (err) {
      log.warn('Failed to send offline approval notification', { error: String(err) });
    }
  });

  sessionManager.on('approval:cleared', (session) => {
    broadcaster.broadcast(
      createEvent('approval_cleared', { sessionName: session.name }, session.name)
    );
  });

  log.info('Session event wiring complete');
}

// ──────────────────────────────────────
// Helper: Client socket storage for terminal streaming
// ──────────────────────────────────────

const clientSockets = new Map<string, WebSocket>();

function storeClientSocket(clientId: string, ws: WebSocket): void {
  clientSockets.set(clientId, ws);
}

function removeClientSocket(clientId: string): void {
  clientSockets.delete(clientId);
}

function getSocketForClient(clientId: string): WebSocket | undefined {
  return clientSockets.get(clientId);
}

// ──────────────────────────────────────
// Helper: Display QR code in terminal
// ──────────────────────────────────────

async function displayQRCode(url: string): Promise<void> {
  try {
    const qrString = await qrcode.toString(url, {
      type: 'utf8',
      width: 40,
      margin: 2,
    });

    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║          \x1b[32mO\x1b[0mpen\x1b[31mS\x1b[0mofa - KINETIC TERMINAL PWA            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n' + qrString);
    console.log('\n  Web Interface: ' + url);
    console.log('\n  Scan QR code with your phone camera to open PWA');
    console.log('  ─────────────────────────────────────────────────────');
    console.log('  Token auto-applied for instant access\n');
  } catch (err) {
    log.warn('Failed to generate QR code', { error: String(err) });
    console.log('\n  Web Interface: ' + url + '\n');
  }
}
