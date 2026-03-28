/**
 * OpenSofa - Agent Registry
 * 
 * Central registry of all supported coding agents.
 * Knows how to discover installed agents, what models they support,
 * and how to build the correct AgentAPI spawn arguments.
 */

import { execSync, execFileSync } from 'child_process';
import { createLogger } from './utils/logger.js';
import { getEnrichedPath } from './utils/expand-path.js';
import type { AgentType } from './types.js';

const log = createLogger('agent-registry');

// ──────────────────────────────────────
// Agent Definition
// ──────────────────────────────────────

export interface AgentDefinition {
  type: AgentType;
  displayName: string;
  binary: string;              // CLI binary (e.g. "claude", "opencode")
  agentApiType: string;        // --type flag value for AgentAPI
  modelFlag?: string;          // CLI flag to pass model (e.g. "--model")
  modelEnvVar?: string;        // env var for model selection
  defaultModel?: string;       // default model if none specified
  agentFlag?: string;          // CLI flag to pass sub-agent/mode (e.g. "--agent")
  knownModels: string[];       // informational — known supported models
  description: string;
}

// ──────────────────────────────────────
// Agent Definitions
// ──────────────────────────────────────

const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    type: 'claude',
    displayName: 'Claude Code',
    binary: 'claude',
    agentApiType: 'claude',
    modelFlag: '--model',
    modelEnvVar: 'CLAUDE_MODEL',
    defaultModel: 'sonnet',
    knownModels: [
      'sonnet',
      'opus',
      'haiku',
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
    ],
    description: 'Anthropic Claude Code CLI agent',
  },
  {
    type: 'opencode',
    displayName: 'OpenCode',
    binary: 'opencode',
    agentApiType: 'opencode',
    modelFlag: '--model',
    modelEnvVar: 'CLAUDE_MODEL',
    agentFlag: '--agent',
    defaultModel: undefined,    // uses whatever opencode is configured with
    knownModels: [
      'anthropic/claude-3-5-sonnet',
      'anthropic/claude-3-opus',
      'openai/gpt-4o',
      'openai/o3',
      'google/gemini-2.0-flash',
      'openrouter/minimax-2.7',
      'glm-4.7',
      'bigscience/glm-4-9b-instruct',
    ],
    description: 'OpenCode CLI agent (model configured via opencode config)',
  },
  {
    type: 'aider',
    displayName: 'Aider',
    binary: 'aider',
    agentApiType: 'aider',
    modelFlag: '--model',
    modelEnvVar: undefined,
    defaultModel: 'sonnet',
    knownModels: [
      'sonnet',
      'opus',
      'gpt-4o',
      'gpt-4.1',
      'o3',
      'deepseek/deepseek-chat',
      'claude-sonnet-4-20250514',
    ],
    description: 'Aider AI pair programming tool',
  },
  {
    type: 'codex',
    displayName: 'Codex CLI',
    binary: 'codex',
    agentApiType: 'codex',
    modelFlag: '--model',
    modelEnvVar: undefined,
    defaultModel: 'o3',
    knownModels: ['o3', 'o4-mini', 'gpt-4.1'],
    description: 'OpenAI Codex CLI agent',
    agentFlag: '--agent', // Added support for sub-agent switching
  },
  {
    type: 'goose',
    displayName: 'Goose',
    binary: 'goose',
    agentApiType: 'goose',
    modelFlag: undefined,
    modelEnvVar: undefined,
    defaultModel: undefined,
    knownModels: [],
    description: 'Block Goose AI agent (model configured via goose profile)',
  },
  {
    type: 'gemini',
    displayName: 'Gemini CLI',
    binary: 'gemini',
    agentApiType: 'gemini',
    modelFlag: '--model',
    modelEnvVar: 'GEMINI_MODEL',
    defaultModel: 'gemini-2.5-pro',
    knownModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    description: 'Google Gemini CLI agent',
  },
  {
    type: 'amp',
    displayName: 'Amp',
    binary: 'amp',
    agentApiType: 'amp',
    modelFlag: undefined,
    modelEnvVar: undefined,
    defaultModel: undefined,
    knownModels: [],
    description: 'Sourcegraph Amp coding agent',
  },
  {
    type: 'copilot',
    displayName: 'GitHub Copilot CLI',
    binary: 'copilot',
    agentApiType: 'copilot',
    modelFlag: undefined,
    modelEnvVar: undefined,
    defaultModel: undefined,
    knownModels: [],
    description: 'GitHub Copilot CLI agent',
  },
  {
    type: 'cursor',
    displayName: 'Cursor Agent',
    binary: 'cursor-agent',
    agentApiType: 'cursor-agent',
    modelFlag: undefined,
    modelEnvVar: undefined,
    defaultModel: undefined,
    knownModels: [],
    description: 'Cursor background agent',
  },
  {
    type: 'auggie',
    displayName: 'Auggie',
    binary: 'auggie',
    agentApiType: 'auggie',
    modelFlag: undefined,
    modelEnvVar: undefined,
    defaultModel: undefined,
    knownModels: [],
    description: 'Augment Code auggie agent',
  },
  {
    type: 'amazonq',
    displayName: 'Amazon Q',
    binary: 'q',
    agentApiType: 'amazonq',
    modelFlag: undefined,
    modelEnvVar: undefined,
    defaultModel: undefined,
    knownModels: [],
    description: 'Amazon Q Developer CLI',
  },
];

// ──────────────────────────────────────
// Agent Registry
// ──────────────────────────────────────

export class AgentRegistry {
  private definitions: Map<AgentType, AgentDefinition> = new Map();
  private installedCache: Map<AgentType, boolean> = new Map();

  constructor() {
    for (const def of AGENT_DEFINITIONS) {
      this.definitions.set(def.type, def);
    }
  }

  /**
   * Get definition for an agent type
   */
  getDefinition(type: AgentType): AgentDefinition | undefined {
    return this.definitions.get(type);
  }

  /**
   * Get all agent definitions
   */
  getAllDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Check if a specific agent binary is installed and on PATH
   */
  isInstalled(type: AgentType): boolean {
    if (this.installedCache.has(type)) {
      return this.installedCache.get(type)!;
    }

    const def = this.definitions.get(type);
    if (!def) return false;

    try {
      execFileSync('which', [def.binary], { stdio: 'pipe', env: { ...process.env, PATH: getEnrichedPath() } });
      this.installedCache.set(type, true);
      return true;
    } catch {
      this.installedCache.set(type, false);
      return false;
    }
  }

  /**
   * Discover all installed agents. Returns list of installed agent types.
   */
  discoverInstalled(): AgentType[] {
    const installed: AgentType[] = [];
    for (const def of this.definitions.values()) {
      if (this.isInstalled(def.type)) {
        installed.push(def.type);
      }
    }
    return installed;
  }

  /**
   * Check if AgentAPI is installed
   */
  isAgentApiInstalled(): boolean {
    try {
      execFileSync('which', ['agentapi'], { stdio: 'pipe', env: { ...process.env, PATH: getEnrichedPath() } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build the args array for spawning AgentAPI with a given agent + model.
   * 
   * Terminal dimensions are responsive:
   * - Mobile (<768px): 80 cols x 24 rows (standard VT100)
   * - Tablet (768-1024px): 120 cols x 36 rows
   * - Desktop (>1024px): 200 cols x 50 rows
    * 
    * Returns: ['server', '--port=3284', '--type=claude', '--term-width=200', '--term-height=50', '--', 'claude', '--model', 'sonnet']
    * 
    * @param options.jsonStream - If true, returns direct spawn args instead of AgentAPI args
    */
  buildSpawnArgs(
    type: AgentType,
    port: number,
    model?: string,
    subAgent?: string, // Added subAgent parameter
    termWidth: number = 120,
    termHeight: number = 36,
    options?: { jsonStream?: boolean },
  ): { args: string[]; env: Record<string, string>; direct?: boolean } {
    // If jsonStream is enabled and agent supports it, return direct spawn args
    if (options?.jsonStream && this.supportsJsonOutput(type)) {
      const direct = this.buildDirectSpawnArgs(type, '', model);
      return {
        args: direct.args,
        env: direct.env,
        direct: true,
      };
    }

    const def = this.definitions.get(type);
    if (!def) {
      throw new Error(`Unknown agent type: ${type}`);
    }

    const args: string[] = [
      'server',
      `--port=${port}`,
      `--type=${def.agentApiType}`,
      `--term-width=${termWidth}`,
      `--term-height=${termHeight}`,
      '--',
      def.binary,
    ];

    const env: Record<string, string> = {};
    const effectiveModel = model || def.defaultModel;

    if (effectiveModel) {
      if (def.modelFlag) {
        // Agent supports --model flag directly
        args.push(def.modelFlag, effectiveModel);
      } else if (def.modelEnvVar) {
        // Agent uses env var for model
        env[def.modelEnvVar] = effectiveModel;
      }
      // If neither modelFlag nor modelEnvVar, agent handles model via its own config
    }

    // Add sub-agent if supported (e.g. opencode --agent plan)
    if (subAgent && def.agentFlag) {
      args.push(def.agentFlag, subAgent);
    }

    return { args, env };
  }

  /**
   * Get JSON output flags for an agent type
   * Returns null if the agent doesn't support JSON output
   */
  getJsonOutputFlags(type: AgentType): string[] | null {
    switch (type) {
      case 'opencode':
        return ['run', '--format', 'json'];
      case 'claude':
        return ['--print', '--output-format=stream-json', '--verbose'];
      case 'aider':
        return ['--json'];
      case 'codex':
        // Codex doesn't have good JSON support yet
        return null;
      default:
        return null;
    }
  }

  /**
   * Check if an agent supports JSON output
   */
  supportsJsonOutput(type: AgentType): boolean {
    return this.getJsonOutputFlags(type) !== null;
  }

  /**
   * Build spawn arguments for direct agent execution (bypassing AgentAPI)
   * Used when JSON output mode is enabled
   */
  buildDirectSpawnArgs(
    type: AgentType,
    workDir: string,
    model?: string,
  ): { command: string; args: string[]; env: Record<string, string> } {
    const def = this.definitions.get(type);
    if (!def) {
      throw new Error(`Unknown agent type: ${type}`);
    }

    const jsonFlags = this.getJsonOutputFlags(type);
    if (!jsonFlags) {
      throw new Error(`JSON output not supported for agent: ${type}`);
    }

    const args = [...jsonFlags, '--continue'];
    const env: Record<string, string> = {};

    // Add model if specified and supported
    const effectiveModel = model || def.defaultModel;
    if (effectiveModel && def.modelFlag) {
      args.push(def.modelFlag, effectiveModel);
    } else if (effectiveModel && def.modelEnvVar) {
      env[def.modelEnvVar] = effectiveModel;
    }

    return {
      command: def.binary,
      args,
      env,
    };
  }

  /**
   * Validate that an agent type is supported
   */
  isValidType(type: string): type is AgentType {
    return this.definitions.has(type as AgentType);
  }

  /**
   * Format a status summary of all agents for display (e.g. /agents command)
   */
  formatAgentList(): string {
    const lines: string[] = [];

    for (const def of this.definitions.values()) {
      const installed = this.isInstalled(def.type);
      if (!installed) continue; // Only show installed agents in compact list

      const modelInfo = def.defaultModel
        ? ` (default: \`${def.defaultModel}\`)`
        : '';

      lines.push(`• **${def.displayName}** (\`${def.type}\`)${modelInfo}`);
      lines.push(`  _${def.description}_`);
      
      if (def.knownModels.length > 0) {
        const models = def.knownModels.slice(0, 5).join(', ');
        const extra = def.knownModels.length > 5 ? '...' : '';
        lines.push(`  > Models: \`${models}${extra}\``);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Log discovered agents at startup
   */
  logDiscovery(): void {
    const installed = this.discoverInstalled();
    const agentApiOk = this.isAgentApiInstalled();

    if (!agentApiOk) {
      log.warn('AgentAPI not found! Install: go install github.com/coder/agentapi@latest');
    } else {
      log.info('AgentAPI: installed');
    }

    if (installed.length === 0) {
      log.warn('No coding agents found on PATH');
    } else {
      log.info(`Installed agents: ${installed.join(', ')}`);
    }
  }
}
