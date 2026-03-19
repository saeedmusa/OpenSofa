/**
 * OpenSofa - Agent Registry
 *
 * Central registry of all supported coding agents.
 * Knows how to discover installed agents, what models they support,
 * and how to build the correct AgentAPI spawn arguments.
 */
import type { AgentType } from './types.js';
export interface AgentDefinition {
    type: AgentType;
    displayName: string;
    binary: string;
    agentApiType: string;
    modelFlag?: string;
    modelEnvVar?: string;
    defaultModel?: string;
    knownModels: string[];
    description: string;
}
export declare class AgentRegistry {
    private definitions;
    private installedCache;
    constructor();
    /**
     * Get definition for an agent type
     */
    getDefinition(type: AgentType): AgentDefinition | undefined;
    /**
     * Get all agent definitions
     */
    getAllDefinitions(): AgentDefinition[];
    /**
     * Check if a specific agent binary is installed and on PATH
     */
    isInstalled(type: AgentType): boolean;
    /**
     * Discover all installed agents. Returns list of installed agent types.
     */
    discoverInstalled(): AgentType[];
    /**
     * Check if AgentAPI is installed
     */
    isAgentApiInstalled(): boolean;
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
    buildSpawnArgs(type: AgentType, port: number, model?: string, termWidth?: number, termHeight?: number): {
        args: string[];
        env: Record<string, string>;
    };
    /**
     * Validate that an agent type is supported
     */
    isValidType(type: string): type is AgentType;
    /**
     * Format a status summary of all agents for display (e.g. /agents command)
     */
    formatAgentList(): string;
    /**
     * Log discovered agents at startup
     */
    logDiscovery(): void;
}
//# sourceMappingURL=agent-registry.d.ts.map