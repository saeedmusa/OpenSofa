/**
 * OpenSofa - Agent Registry
 *
 * Central registry of all supported coding agents.
 * Knows how to discover installed agents, what models they support,
 * and how to build the correct AgentAPI spawn arguments.
 */
import { execFileSync } from 'child_process';
import { createLogger } from './utils/logger.js';
import { getEnrichedPath } from './utils/expand-path.js';
const log = createLogger('agent-registry');
// ──────────────────────────────────────
// Agent Definitions
// ──────────────────────────────────────
const AGENT_DEFINITIONS = [
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
        modelFlag: undefined, // opencode uses its own config file
        modelEnvVar: undefined,
        defaultModel: undefined, // uses whatever opencode is configured with
        knownModels: [
            'anthropic/claude-sonnet-4-20250514',
            'anthropic/claude-opus-4-20250514',
            'openai/gpt-4o',
            'openai/o3',
            'google/gemini-2.5-pro',
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
    definitions = new Map();
    installedCache = new Map();
    constructor() {
        for (const def of AGENT_DEFINITIONS) {
            this.definitions.set(def.type, def);
        }
    }
    /**
     * Get definition for an agent type
     */
    getDefinition(type) {
        return this.definitions.get(type);
    }
    /**
     * Get all agent definitions
     */
    getAllDefinitions() {
        return Array.from(this.definitions.values());
    }
    /**
     * Check if a specific agent binary is installed and on PATH
     */
    isInstalled(type) {
        if (this.installedCache.has(type)) {
            return this.installedCache.get(type);
        }
        const def = this.definitions.get(type);
        if (!def)
            return false;
        try {
            execFileSync('which', [def.binary], { stdio: 'pipe', env: { ...process.env, PATH: getEnrichedPath() } });
            this.installedCache.set(type, true);
            return true;
        }
        catch {
            this.installedCache.set(type, false);
            return false;
        }
    }
    /**
     * Discover all installed agents. Returns list of installed agent types.
     */
    discoverInstalled() {
        const installed = [];
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
    isAgentApiInstalled() {
        try {
            execFileSync('which', ['agentapi'], { stdio: 'pipe', env: { ...process.env, PATH: getEnrichedPath() } });
            return true;
        }
        catch {
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
     */
    buildSpawnArgs(type, port, model, termWidth = 120, termHeight = 36) {
        const def = this.definitions.get(type);
        if (!def) {
            throw new Error(`Unknown agent type: ${type}`);
        }
        const args = [
            'server',
            `--port=${port}`,
            `--type=${def.agentApiType}`,
            `--term-width=${termWidth}`,
            `--term-height=${termHeight}`,
            '--',
            def.binary,
        ];
        const env = {};
        const effectiveModel = model || def.defaultModel;
        if (effectiveModel) {
            if (def.modelFlag) {
                // Agent supports --model flag directly
                args.push(def.modelFlag, effectiveModel);
            }
            else if (def.modelEnvVar) {
                // Agent uses env var for model
                env[def.modelEnvVar] = effectiveModel;
            }
            // If neither modelFlag nor modelEnvVar, agent handles model via its own config
        }
        return { args, env };
    }
    /**
     * Validate that an agent type is supported
     */
    isValidType(type) {
        return this.definitions.has(type);
    }
    /**
     * Format a status summary of all agents for display (e.g. /agents command)
     */
    formatAgentList() {
        const lines = ['*Available Coding Agents*', ''];
        for (const def of this.definitions.values()) {
            const installed = this.isInstalled(def.type);
            const status = installed ? '✅' : '⬚';
            const modelInfo = def.defaultModel
                ? ` (default: ${def.defaultModel})`
                : def.knownModels.length > 0
                    ? ` (configure via ${def.binary} config)`
                    : '';
            lines.push(`${status} *${def.displayName}* (\`${def.type}\`)${modelInfo}`);
            lines.push(`   ${def.description}`);
            if (def.knownModels.length > 0) {
                lines.push(`   Models: ${def.knownModels.slice(0, 4).join(', ')}${def.knownModels.length > 4 ? '...' : ''}`);
            }
            lines.push('');
        }
        lines.push('✅ = installed, ⬚ = not found on PATH');
        lines.push('');
        lines.push('Send /new to start the guided session wizard.');
        return lines.join('\n');
    }
    /**
     * Log discovered agents at startup
     */
    logDiscovery() {
        const installed = this.discoverInstalled();
        const agentApiOk = this.isAgentApiInstalled();
        if (!agentApiOk) {
            log.warn('AgentAPI not found! Install: go install github.com/coder/agentapi@latest');
        }
        else {
            log.info('AgentAPI: installed');
        }
        if (installed.length === 0) {
            log.warn('No coding agents found on PATH');
        }
        else {
            log.info(`Installed agents: ${installed.join(', ')}`);
        }
    }
}
//# sourceMappingURL=agent-registry.js.map