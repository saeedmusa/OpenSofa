/**
 * OpenSofa - Claude Code Model Adapter
 *
 * Discovers models from Claude Code's settings.json configuration.
 * Supports Z.AI provider with GLM models and standard Anthropic API.
 */
import { BaseAdapter } from './base-adapter.js';
import type { AgentType } from '../types.js';
import type { ModelProvider } from './types.js';
/**
 * Claude Code model adapter.
 * Parses ~/.claude/settings.json to discover configured models and providers.
 */
export declare class ClaudeAdapter extends BaseAdapter {
    readonly agent: AgentType;
    readonly name = "Claude Code";
    private readonly configPath;
    constructor();
    /**
     * Check if Claude Code is available.
     * Returns true if claude binary exists OR if settings.json exists.
     */
    isAvailable(): boolean;
    /**
     * Discover models from Claude Code's configuration.
     * Reads ~/.claude/settings.json and extracts provider and model info.
     */
    discoverModels(): Promise<ModelProvider[]>;
    /**
     * Detect the provider based on ANTHROPIC_BASE_URL.
     */
    private detectProvider;
    /**
     * Extract models from environment variables.
     */
    private extractModels;
    /**
     * Get the default model from Claude settings.
     */
    getDefaultModel(): string | undefined;
}
//# sourceMappingURL=claude-adapter.d.ts.map