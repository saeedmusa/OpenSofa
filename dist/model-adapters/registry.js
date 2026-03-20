/**
 * OpenSofa - Adapter Registry
 *
 * Central registry for model discovery adapters.
 * Manages registration and discovery of models across all agents.
 */
import { createLogger } from '../utils/logger.js';
const log = createLogger('adapter-registry');
// Singleton instance
let registryInstance = null;
/**
 * AdapterRegistry - manages all model discovery adapters
 *
 * Provides methods to:
 * - Register adapters for specific agent types
 * - Retrieve adapters by agent type
 * - Discover models from all or specific agents
 * - Handle errors gracefully across adapters
 */
export class AdapterRegistry {
    adapters = new Map();
    constructor() {
        // Private constructor for singleton
    }
    /**
     * Get the singleton registry instance
     */
    static getInstance() {
        if (!registryInstance) {
            registryInstance = new AdapterRegistry();
        }
        return registryInstance;
    }
    /**
     * Register an adapter for a specific agent type.
     * If an adapter already exists for this agent type, it will be replaced.
     *
     * @param adapter - The model adapter to register
     */
    registerAdapter(adapter) {
        log.debug(`Registering adapter for agent: ${adapter.agent}`, {
            name: adapter.name
        });
        this.adapters.set(adapter.agent, adapter);
    }
    /**
     * Get the adapter for a specific agent type.
     *
     * @param agent - The agent type to look up
     * @returns The adapter if found, undefined otherwise
     */
    getAdapter(agent) {
        return this.adapters.get(agent);
    }
    /**
     * Get all registered adapters.
     *
     * @returns Array of all registered adapters
     */
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }
    /**
     * Discover models from all registered adapters.
     * Errors in one adapter don't affect others.
     *
     * @param agents - Optional list of specific agents to discover from.
     *                 If not provided, discovers from all registered adapters.
     * @returns Combined discovery result from all adapters
     */
    async discoverAll(agents) {
        const errors = [];
        const allProviders = [];
        const adaptersToCheck = agents
            ? agents.map(agent => this.adapters.get(agent)).filter((a) => a !== undefined)
            : this.getAllAdapters();
        log.debug('Starting model discovery', {
            adapterCount: adaptersToCheck.length,
            agents: agents ?? 'all'
        });
        for (const adapter of adaptersToCheck) {
            try {
                if (!adapter.isAvailable()) {
                    log.debug(`Adapter not available, skipping: ${adapter.name}`);
                    continue;
                }
                const providers = await adapter.discoverModels();
                log.debug(`Discovered ${providers.length} providers from ${adapter.name}`);
                allProviders.push(...providers);
            }
            catch (err) {
                const errorMsg = `Error discovering models from ${adapter.name}: ${String(err)}`;
                log.error(errorMsg);
                errors.push(errorMsg);
            }
        }
        log.info('Model discovery complete', {
            providerCount: allProviders.length,
            errorCount: errors.length
        });
        return {
            success: errors.length === 0,
            providers: allProviders,
            errors: errors.length > 0 ? errors : undefined,
        };
    }
    /**
     * Discover models from a specific agent.
     *
     * @param agent - The agent type to discover models from
     * @returns List of providers from this agent, or empty array if adapter not found
     */
    async discoverForAgent(agent) {
        const adapter = this.adapters.get(agent);
        if (!adapter) {
            log.warn(`No adapter registered for agent: ${agent}`);
            return [];
        }
        if (!adapter.isAvailable()) {
            log.debug(`Adapter not available: ${adapter.name}`);
            return [];
        }
        try {
            return await adapter.discoverModels();
        }
        catch (err) {
            log.error(`Error discovering models for ${agent}`, { error: String(err) });
            return [];
        }
    }
    /**
     * Check if any adapters are registered.
     */
    hasAdapters() {
        return this.adapters.size > 0;
    }
    /**
     * Get list of agents with registered adapters.
     */
    getRegisteredAgents() {
        return Array.from(this.adapters.keys());
    }
}
// Export singleton getter for convenience
export function getAdapterRegistry() {
    return AdapterRegistry.getInstance();
}
//# sourceMappingURL=registry.js.map