/**
 * OpenSofa - Model Discovery Types
 *
 * Interfaces for the unified model discovery system.
 */
import type { AgentType } from '../types.js';
export interface DiscoveredModel {
    id: string;
    name: string;
    provider: string;
    agent: AgentType;
}
export interface ModelProvider {
    name: string;
    id: string;
    agent: AgentType;
    models: DiscoveredModel[];
    configured: boolean;
}
export interface ModelDiscoveryResult {
    success: boolean;
    providers: ModelProvider[];
    errors?: string[];
}
export interface ModelAdapter {
    readonly agent: AgentType;
    readonly name: string;
    /**
     * Check if this adapter is available (agent installed, etc.)
     */
    isAvailable(): boolean;
    /**
     * Discover all available models from this agent's providers
     */
    discoverModels(): Promise<ModelProvider[]>;
    /**
     * Get the default model for this agent (if any)
     */
    getDefaultModel(): string | undefined;
}
//# sourceMappingURL=types.d.ts.map