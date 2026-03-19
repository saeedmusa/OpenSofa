/**
 * OpenSofa - Agent Adapter Interface
 *
 * Defines the contract for agent-specific adapters that parse
 * raw agent output and convert it to AG-UI events.
 */
// Import adapters for registration
import { OpenCodeAdapter } from './opencode-adapter.js';
import { ClaudeAdapter } from './claude-adapter.js';
import { AiderAdapter } from './aider-adapter.js';
/**
 * Registry for managing agent adapters
 */
export class AdapterRegistry {
    adapters = new Map();
    /**
     * Register an adapter
     */
    register(adapter) {
        this.adapters.set(adapter.agentType.toLowerCase(), adapter);
    }
    /**
     * Get adapter for a specific agent type
     */
    get(agentType) {
        return this.adapters.get(agentType.toLowerCase()) || null;
    }
    /**
     * Check if an adapter exists for the agent type
     */
    has(agentType) {
        return this.adapters.has(agentType.toLowerCase());
    }
    /**
     * List all registered adapter agent types
     */
    list() {
        return Array.from(this.adapters.keys());
    }
}
/**
 * Default global registry instance with all adapters registered
 */
export const globalAdapterRegistry = new AdapterRegistry();
// Register all built-in adapters
globalAdapterRegistry.register(new OpenCodeAdapter());
globalAdapterRegistry.register(new ClaudeAdapter());
globalAdapterRegistry.register(new AiderAdapter());
// Re-export adapters
export { OpenCodeAdapter, createOpenCodeAdapter } from './opencode-adapter.js';
export { ClaudeAdapter, createClaudeAdapter } from './claude-adapter.js';
export { AiderAdapter, createAiderAdapter } from './aider-adapter.js';
//# sourceMappingURL=mod.js.map