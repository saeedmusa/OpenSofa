/**
 * OpenSofa - Base Adapter
 *
 * Base class providing common functionality for model discovery adapters.
 */
import type { AgentType } from '../types.js';
import type { ModelAdapter, ModelProvider, DiscoveredModel } from './types.js';
/**
 * Base class for model discovery adapters.
 * Provides common functionality like binary availability checking,
 * command execution with proper PATH setup, and error handling.
 */
export declare abstract class BaseAdapter implements ModelAdapter {
    abstract readonly agent: AgentType;
    abstract readonly name: string;
    protected constructor();
    /**
     * Check if the agent binary is available on PATH
     */
    isAvailable(): boolean;
    /**
     * Get the binary name for this agent.
     * Override in subclass if different from agent type.
     */
    protected getBinaryName(): string;
    /**
     * Execute a command and return the output.
     * Uses enriched PATH to find binaries.
     *
     * @param command - The command to execute
     * @param args - Arguments to pass
     * @param timeout - Timeout in ms (default 30000)
     * @returns The stdout output, or empty string on error
     */
    protected executeCommand(command: string, args: string[], timeout?: number): string;
    /**
     * Execute a shell command using execSync.
     * Uses enriched PATH to find binaries.
     */
    protected executeShell(command: string, timeout?: number): string;
    /**
     * Create a DiscoveredModel object with common fields.
     */
    protected createModel(id: string, name: string, provider: string): DiscoveredModel;
    /**
     * Create a ModelProvider object.
     */
    protected createProvider(name: string, id: string, models: DiscoveredModel[], configured: boolean): ModelProvider;
    /**
     * Abstract method to discover models - must be implemented by subclass.
     */
    abstract discoverModels(): Promise<ModelProvider[]>;
    /**
     * Get the default model for this agent.
     * Override in subclass if the agent has a concept of default model.
     */
    getDefaultModel(): string | undefined;
}
//# sourceMappingURL=base-adapter.d.ts.map