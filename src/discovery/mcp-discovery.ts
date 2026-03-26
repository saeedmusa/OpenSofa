/**
 * OpenSofa - MCP Server Auto-Discovery
 *
 * Reads MCP server configurations from agent config files.
 * Read-only — does NOT write to agent configs.
 *
 * Supported agents:
 * - Claude Code: ~/.claude.json (mcpServers) + .mcp.json (project)
 * - OpenCode: ~/.config/opencode/opencode.json (mcp)
 * - Goose: ~/.config/goose/config.yaml (extensions)
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { createLogger } from '../utils/logger.js';

const log = createLogger('discovery:mcp');

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────

export interface MCPServer {
  name: string;
  agent: string; // 'claude' | 'opencode' | 'goose'
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  envKeys: string[]; // Env var NAMES only (values redacted)
  envValues?: Record<string, string>; // Env var VALUES (for spawning servers)
  status: 'configured' | 'error';
  configPath: string;
}

// ──────────────────────────────────────
// Helpers
// ──────────────────────────────────────

const HOME = process.env.HOME || '/root';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, 'utf-8');
    // Strip JSONC comments (// and /* */)
    const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return JSON.parse(stripped) as T;
  } catch (err) {
    log.debug('Failed to read JSON file', { path, error: String(err) });
    return null;
  }
}

async function readYamlFile<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, 'utf-8');
    // Dynamic import to avoid requiring yaml as a hard dependency
    const yaml = await import('js-yaml');
    return yaml.load(content) as T;
  } catch (err) {
    log.debug('Failed to read YAML file', { path, error: String(err) });
    return null;
  }
}

// ──────────────────────────────────────
// Claude Code MCP Discovery
// ──────────────────────────────────────

interface ClaudeMcpServer {
  type?: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

interface ClaudeConfig {
  mcpServers?: Record<string, ClaudeMcpServer>;
  projects?: Record<string, { mcpServers?: Record<string, ClaudeMcpServer> }>;
}

async function discoverClaudeMCP(): Promise<MCPServer[]> {
  const servers: MCPServer[] = [];
  const configPath = join(HOME, '.claude.json');

  const config = await readJsonFile<ClaudeConfig>(configPath);
  if (!config) return servers;

  // Global MCP servers
  if (config.mcpServers) {
    for (const [name, server] of Object.entries(config.mcpServers)) {
      servers.push(normalizeClaudeServer(name, server, configPath));
    }
  }

  // Project-scoped MCP servers
  if (config.projects) {
    for (const [projectPath, project] of Object.entries(config.projects)) {
      if (project.mcpServers) {
        for (const [name, server] of Object.entries(project.mcpServers)) {
          servers.push(normalizeClaudeServer(`${name} (${projectPath})`, server, configPath));
        }
      }
    }
  }

  // Also check .mcp.json in common project dirs
  const projectMcpPaths = [
    join(HOME, '.mcp.json'),
  ];

  for (const mcpPath of projectMcpPaths) {
    if (await fileExists(mcpPath)) {
      const projectConfig = await readJsonFile<{ mcpServers?: Record<string, ClaudeMcpServer> }>(mcpPath);
      if (projectConfig?.mcpServers) {
        for (const [name, server] of Object.entries(projectConfig.mcpServers)) {
          servers.push(normalizeClaudeServer(`${name} (project)`, server, mcpPath));
        }
      }
    }
  }

  return servers;
}

function normalizeClaudeServer(name: string, server: ClaudeMcpServer, configPath: string): MCPServer {
  const transport = server.type || (server.url ? 'http' : 'stdio');
  return {
    name,
    agent: 'claude',
    transport: transport as 'stdio' | 'http' | 'sse',
    command: server.command,
    args: server.args,
    url: server.url,
    envKeys: Object.keys(server.env || {}),
    status: 'configured',
    configPath,
  };
}

// ──────────────────────────────────────
// OpenCode MCP Discovery
// ──────────────────────────────────────

interface OpenCodeMcpServer {
  type: 'local' | 'remote';
  command?: string[];
  url?: string;
  environment?: Record<string, string>;
  headers?: Record<string, string>;
  enabled?: boolean;
}

interface OpenCodeConfig {
  mcp?: Record<string, OpenCodeMcpServer>;
}

async function discoverOpenCodeMCP(): Promise<MCPServer[]> {
  const servers: MCPServer[] = [];
  const configPath = join(HOME, '.config', 'opencode', 'opencode.json');

  const config = await readJsonFile<OpenCodeConfig>(configPath);
  if (!config?.mcp) return servers;

  for (const [name, server] of Object.entries(config.mcp)) {
    const transport = server.type === 'remote' ? 'http' : 'stdio';
    servers.push({
      name,
      agent: 'opencode',
      transport,
      command: server.command?.[0],
      args: server.command?.slice(1),
      url: server.url,
      envKeys: Object.keys(server.environment || {}),
      envValues: server.environment,
      status: server.enabled === false ? 'error' : 'configured',
      configPath,
    });
  }

  return servers;
}

// ──────────────────────────────────────
// Goose MCP Discovery
// ──────────────────────────────────────

interface GooseExtension {
  name?: string;
  type: 'stdio' | 'streamable_http' | 'sse' | 'builtin';
  cmd?: string;
  args?: string[];
  url?: string;
  enabled?: boolean;
  envs?: Record<string, string>;
  env_keys?: string[];
  description?: string;
  bundled?: boolean;
}

interface GooseConfig {
  extensions?: Record<string, GooseExtension>;
}

async function discoverGooseMCP(): Promise<MCPServer[]> {
  const servers: MCPServer[] = [];
  const configPath = join(HOME, '.config', 'goose', 'config.yaml');

  const config = await readYamlFile<GooseConfig>(configPath);
  if (!config?.extensions) return servers;

  for (const [key, ext] of Object.entries(config.extensions)) {
    // Skip built-in extensions
    if (ext.type === 'builtin' || ext.bundled) continue;

    const transport = ext.type === 'streamable_http' || ext.type === 'sse' ? 'http' : 'stdio';
    servers.push({
      name: ext.name || key,
      agent: 'goose',
      transport: transport as 'stdio' | 'http',
      command: ext.cmd,
      args: ext.args,
      url: ext.url,
      envKeys: [...Object.keys(ext.envs || {}), ...(ext.env_keys || [])],
      status: ext.enabled === false ? 'error' : 'configured',
      configPath,
    });
  }

  return servers;
}

// ──────────────────────────────────────
// Public API
// ──────────────────────────────────────

/**
 * Discover all MCP servers from all agent configs.
 * Read-only — never writes to config files.
 */
export async function discoverMCPServers(): Promise<MCPServer[]> {
  log.info('Starting MCP server discovery');

  const [claude, opencode, goose] = await Promise.all([
    discoverClaudeMCP(),
    discoverOpenCodeMCP(),
    discoverGooseMCP(),
  ]);

  const all = [...claude, ...opencode, ...goose];

  log.info('MCP discovery complete', {
    total: all.length,
    claude: claude.length,
    opencode: opencode.length,
    goose: goose.length,
  });

  return all;
}

// ──────────────────────────────────────
// MCP Server Management (Write Operations)
// ──────────────────────────────────────

import { copyFile, writeFile } from 'fs/promises';

export interface MCPServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

/**
 * Add an MCP server to an agent's config file.
 * Creates a backup (.bak) before modifying.
 */
export async function addMCPServer(
  agent: string,
  serverName: string,
  config: MCPServerConfig,
): Promise<void> {
  if (agent === 'claude') {
    await addMCPServerToClaude(serverName, config);
  } else if (agent === 'opencode') {
    await addMCPServerToOpenCode(serverName, config);
  } else {
    throw new Error(`Unsupported agent for MCP management: ${agent}`);
  }
  log.info('MCP server added', { agent, serverName });
}

/**
 * Remove an MCP server from an agent's config file.
 * Creates a backup (.bak) before modifying.
 */
export async function removeMCPServer(agent: string, serverName: string): Promise<void> {
  if (agent === 'claude') {
    await removeMCPServerFromClaude(serverName);
  } else if (agent === 'opencode') {
    await removeMCPServerFromOpenCode(serverName);
  } else {
    throw new Error(`Unsupported agent for MCP management: ${agent}`);
  }
  log.info('MCP server removed', { agent, serverName });
}

async function backupFile(filePath: string): Promise<void> {
  if (await fileExists(filePath)) {
    await copyFile(filePath, `${filePath}.bak`);
    log.debug('Config backup created', { path: `${filePath}.bak` });
  }
}

async function addMCPServerToClaude(serverName: string, config: MCPServerConfig): Promise<void> {
  const configPath = join(HOME, '.claude.json');
  await backupFile(configPath);

  let existing: Record<string, unknown> = {};
  if (await fileExists(configPath)) {
    const content = await readFile(configPath, 'utf-8');
    try {
      existing = JSON.parse(content);
    } catch { /* start fresh */ }
  }

  if (!existing.mcpServers || typeof existing.mcpServers !== 'object') {
    existing.mcpServers = {};
  }

  (existing.mcpServers as Record<string, unknown>)[serverName] = {
    ...(config.command ? { command: config.command } : {}),
    ...(config.args ? { args: config.args } : {}),
    ...(config.url ? { url: config.url } : {}),
    ...(config.env ? { env: config.env } : {}),
  };

  await writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8');
}

async function removeMCPServerFromClaude(serverName: string): Promise<void> {
  const configPath = join(HOME, '.claude.json');
  await backupFile(configPath);

  if (!(await fileExists(configPath))) return;

  const content = await readFile(configPath, 'utf-8');
  const existing = JSON.parse(content);

  if (existing.mcpServers && existing.mcpServers[serverName]) {
    delete existing.mcpServers[serverName];
    await writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8');
  }
}

async function addMCPServerToOpenCode(serverName: string, config: MCPServerConfig): Promise<void> {
  const configPath = join(HOME, '.config', 'opencode', 'config.json');
  await backupFile(configPath);

  let existing: Record<string, unknown> = {};
  if (await fileExists(configPath)) {
    const content = await readFile(configPath, 'utf-8');
    try {
      existing = JSON.parse(content);
    } catch { /* start fresh */ }
  }

  if (!existing.mcp || typeof existing.mcp !== 'object') {
    existing.mcp = {};
  }

  (existing.mcp as Record<string, unknown>)[serverName] = {
    ...(config.command ? { command: config.command } : {}),
    ...(config.args ? { args: config.args } : {}),
    ...(config.url ? { url: config.url } : {}),
    ...(config.env ? { env: config.env } : {}),
  };

  await writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8');
}

async function removeMCPServerFromOpenCode(serverName: string): Promise<void> {
  const configPath = join(HOME, '.config', 'opencode', 'config.json');
  await backupFile(configPath);

  if (!(await fileExists(configPath))) return;

  const content = await readFile(configPath, 'utf-8');
  const existing = JSON.parse(content);

  if (existing.mcp && existing.mcp[serverName]) {
    delete existing.mcp[serverName];
    await writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8');
  }
}
