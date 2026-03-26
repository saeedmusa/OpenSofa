/**
 * OpenSofa - MCP Tool Discovery
 * 
 * On-demand discovery of tools provided by MCP servers.
 * Spawns server processes temporarily to query their tool lists.
 * 
 * ⚠️ RISK: Spawns MCP server processes. Discovery is user-initiated only, never automatic.
 */

import { spawn } from 'child_process';
import { createLogger } from '../utils/logger.js';
import type { MCPServer } from './mcp-discovery.js';

const log = createLogger('discovery:mcp-tools');

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPToolDiscoveryResult {
  serverName: string;
  tools: MCPTool[];
  error?: string;
}

/** In-memory cache — cleared on app restart */
const toolCache = new Map<string, MCPTool[]>();

/**
 * Discover tools from an MCP server.
 * On-demand only — never called automatically.
 */
export async function discoverTools(server: MCPServer): Promise<MCPToolDiscoveryResult> {
  const cacheKey = `${server.agent}:${server.name}`;

  // Check cache first
  if (toolCache.has(cacheKey)) {
    log.debug('Returning cached tools', { server: server.name });
    return { serverName: server.name, tools: toolCache.get(cacheKey)! };
  }

  log.info('Discovering tools for MCP server', { server: server.name, transport: server.transport });

  try {
    let tools: MCPTool[];

    if (server.transport === 'stdio' && server.command) {
      tools = await discoverViaStdio(server.command, server.args ?? [], server.envKeys, server.envValues);
    } else if (server.transport === 'http' && server.url) {
      tools = await discoverViaHttp(server.url);
    } else {
      return { serverName: server.name, tools: [], error: 'Unsupported transport or missing config' };
    }

    // Cache the result
    toolCache.set(cacheKey, tools);
    log.info('Discovered tools', { server: server.name, count: tools.length });

    return { serverName: server.name, tools };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.warn('Tool discovery failed', { server: server.name, error: errorMsg });
    return { serverName: server.name, tools: [], error: errorMsg };
  }
}

/**
 * Discover tools via stdio transport.
 * Spawns the MCP server, sends tools/list, reads response, kills process.
 */
async function discoverViaStdio(
  command: string,
  args: string[],
  envKeys: string[],
  envValues?: Record<string, string>,
): Promise<MCPTool[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Discovery timeout (30s)'));
    }, 30_000);

    // Build env with only the required keys from parent process
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    // Enrich PATH for finding commands like npx, node
    const pathEnv = env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
    const paths = pathEnv.split(':').filter(Boolean);
    const additionalPaths = ['/usr/local/bin', '/opt/homebrew/bin', '/Users/**/Library/npm/bin'];
    env.PATH = [...new Set([...additionalPaths, ...paths])].join(':');

    // Pass env vars from config if provided
    if (envValues) {
      for (const [key, value] of Object.entries(envValues)) {
        env[key] = value;
      }
    }

    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      timeout: 10_000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();

      // Try to parse JSON-RPC response
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          if (response.jsonrpc === '2.0' && response.result?.tools) {
            clearTimeout(timeout);
            child.kill('SIGTERM');
            resolve(parseToolResponse(response.result.tools));
            return;
          }
          if (response.error) {
            clearTimeout(timeout);
            child.kill('SIGTERM');
            reject(new Error(response.error.message || 'MCP error'));
            return;
          }
        } catch {
          // Not JSON yet, keep reading
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn MCP server: ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        reject(new Error(`MCP server exited with code ${code}: ${stderr.slice(0, 200)}`));
      }
    });

    // Send tools/list request
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    }) + '\n';

    child.stdin.write(request);
    child.stdin.end();
  });
}

/**
 * Discover tools via HTTP transport.
 * Sends POST with JSON-RPC tools/list request.
 */
async function discoverViaHttp(url: string): Promise<MCPTool[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { result?: { tools?: unknown[] }; error?: { message?: string } };

    if (data.error) {
      throw new Error(data.error.message || 'MCP error');
    }

    return parseToolResponse(data.result?.tools ?? []);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse raw tool response into MCPTool array.
 */
function parseToolResponse(tools: unknown[]): MCPTool[] {
  return tools.map((tool) => {
    const t = tool as Record<string, unknown>;
    return {
      name: String(t.name ?? 'unknown'),
      description: t.description ? String(t.description) : undefined,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined,
    };
  });
}

/**
 * Clear the tool cache (for testing or manual refresh).
 */
export function clearToolCache(): void {
  toolCache.clear();
}
