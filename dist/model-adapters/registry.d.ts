/**
 * OpenSofa - Adapter Registry
 *
 * Central registry for model discovery adapters.
 * Manages registration and discovery of models across all agents.
 */
import type { AgentType } from '../types.js';
import type { ModelAdapter, ModelDiscoveryResult, ModelProvider } from './types.js';
/**
 * AdapterRegistry - manages all model discovery adapters
 *
 * Provides methods to:
 * - Register adapters for specific agent types
 * - Retrieve adapters by agent type
 * - Discover models from all or specific agents
 * - Handle errors gracefully across adapters
 */
export declare class AdapterRegistry {
    private adapters;
    constructor();
    /**
     * Get the singleton registry instance
     */
    static getInstance(): AdapterRegistry;
    /**
     * Register an adapter for a specific agent type.
     * If an adapter already exists for this agent type, it will be replaced.
     *
     * @param adapter - The model adapter to register
     */
    registerAdapter(adapter: ModelAdapter): void;
    /**
     * Get the adapter for a specific agent type.
     *
     * @param agent - The agent type to look up
     * @returns The adapter if found, undefined otherwise
     */
    getAdapter(agent: AgentType): ModelAdapter | undefined;
    /**
     * Get all registered adapters.
     *
     * @returns Array of all registered adapters
     */
    getAllAdapters(): ModelAdapter[];
    /**
     * Discover models from all registered adapters.
     * Errors in one adapter don't affect others.
     *
     * @param agents - Optional list of specific agents to discover from.
     *                 If not provided, discovers from all registered adapters.
     * @returns Combined discovery result from all adapters
     */
    discoverAll(agents?: AgentType[]): Promise<ModelDiscoveryResult>;
    /**
     * Discover models from a specific agent.
     *
     * @param agent - The agent type to discover models from
     * @returns List of providers from this agent, or empty array if adapter not found
     */
    discoverForAgent(agent: AgentType): Promise<ModelProvider[]>;
    /**
     * Check if any adapters are registered.
     */
    hasAdapters(): boolean;
    /**
     * Get list of agents with registered adapters.
     */
    getRegisteredAgents(): AgentType[];
}
export declare function getAdapterRegistry(): AdapterRegistry;
//# sourceMappingURL=registry.d.ts.map