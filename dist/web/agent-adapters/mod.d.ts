/**
 * OpenSofa - Agent Adapter Interface
 *
 * Defines the contract for agent-specific adapters that parse
 * raw agent output and convert it to AG-UI events.
 */
import type { AGUIEvent } from '../ag-ui-events.js';
import type { ActivityEvent } from '../activity-parser.js';
/**
 * Agent adapter interface
 * Each agent (OpenCode, Claude, Gemini, Aider) implements this
 * to normalize their output format to AG-UI events.
 */
export interface AgentAdapter {
    /**
     * Unique identifier for the agent
     */
    readonly agentType: string;
    /**
     * Parse raw stdout chunks from the agent
     * Returns normalized AG-UI events
     */
    parse(chunk: string): AGUIEvent[];
    /**
     * Check if this adapter supports the given agent type
     */
    supports(agentType: string): boolean;
}
/**
 * Agent adapter that produces OpenSofa ActivityEvents
 * Extends AgentAdapter with mapping capability
 */
export interface ActivityAdapter extends AgentAdapter {
    /**
     * Map AG-UI events to OpenSofa ActivityEvents
     */
    mapToActivityEvents(aguiEvents: AGUIEvent[], sessionName: string): ActivityEvent[];
}
/**
 * Registry for managing agent adapters
 */
export declare class AdapterRegistry {
    private adapters;
    /**
     * Register an adapter
     */
    register(adapter: ActivityAdapter): void;
    /**
     * Get adapter for a specific agent type
     */
    get(agentType: string): ActivityAdapter | null;
    /**
     * Check if an adapter exists for the agent type
     */
    has(agentType: string): boolean;
    /**
     * List all registered adapter agent types
     */
    list(): string[];
}
/**
 * Default global registry instance with all adapters registered
 */
export declare const globalAdapterRegistry: AdapterRegistry;
export { OpenCodeAdapter, createOpenCodeAdapter } from './opencode-adapter.js';
export { ClaudeAdapter, createClaudeAdapter } from './claude-adapter.js';
export { AiderAdapter, createAiderAdapter } from './aider-adapter.js';
//# sourceMappingURL=mod.d.ts.map