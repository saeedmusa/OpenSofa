/**
 * OpenSofa - OpenCode Model Adapter
 *
 * Adapter for discovering models from OpenCode CLI.
 * Uses `opencode models` and `opencode auth list` commands.
 */
import { BaseAdapter } from './base-adapter.js';
import type { AgentType } from '../types.js';
import type { ModelProvider } from './types.js';
/**
 * OpenCode Adapter - discovers models from OpenCode CLI
 */
export declare class OpenCodeAdapter extends BaseAdapter {
    readonly agent: AgentType;
    readonly name = "OpenCode";
    constructor();
    /**
     * Get the binary name for availability check
     */
    protected getBinaryName(): string;
    /**
     * Get the default model for OpenCode
     * Returns undefined since OpenCode manages its own default
     */
    getDefaultModel(): string | undefined;
    /**
     * Discover all available models from OpenCode
     * Groups models by provider
     */
    discoverModels(): Promise<ModelProvider[]>;
    /**
     * Parse the output of `opencode auth list` to get configured provider prefixes
     */
    private getConfiguredProviderPrefixes;
    /**
     * Get all available models from opencode
     */
    private getAllModels;
    /**
     * Extract the provider prefix from a model ID
     * e.g., "anthropic/claude-sonnet-4-20250514" → undefined
     * e.g., "openrouter/anthropic/claude-sonnet-4-20250514" → "openrouter/"
     */
    private extractPrefix;
    /**
     * Extract the display name from a model ID
     * e.g., "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4-20250514"
     */
    private extractDisplayName;
    /**
     * Normalize a provider prefix to a short ID
     * e.g., "huggingface/zai-org" → "huggingface-zai-org"
     */
    private normalizeProviderId;
    /**
     * Check if a model supports vision/image input based on its name.
     * Vision-capable: opus, sonnet (except sonnet-4-haiku), claude-3-5-sonnet, claude-3-opus
     * Non-vision (text-only): haiku models, gpt-4o-mini (for some providers)
     */
    private supportsVision;
    /**
     * Check if a model supports image generation/output.
     * DALL-E, Imagen, and some GPT models support image generation.
     */
    private supportsImages;
}
//# sourceMappingURL=opencode-adapter.d.ts.map