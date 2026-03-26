/**
 * OpenSofa - OpenCode Model Adapter
 * 
 * Adapter for discovering models from OpenCode CLI.
 * Uses `opencode models` and `opencode auth list` commands.
 */

import { createLogger } from '../utils/logger.js';
import { getEnrichedEnv } from '../utils/expand-path.js';
import { BaseAdapter } from './base-adapter.js';
import type { AgentType } from '../types.js';
import type { ModelProvider, DiscoveredModel } from './types.js';

const log = createLogger('opencode-adapter');

// Timeout constants
const TIMEOUTS = {
  authList: 10_000,       // 10s for `opencode auth list`
  models: 30_000,         // 30s for `opencode models`
} as const;

/**
 * Mapping from raw provider names (from opencode auth list)
 * to model prefixes (used in opencode models output)
 */
const PROVIDER_PREFIX_MAP: Record<string, string> = {
  'openrouter': 'openrouter/',
  'z.ai coding plan': 'huggingface/zai-org',
  'zai': 'huggingface/zai-org',
  'z.ai': 'huggingface/zai-org',
  'hugging face': 'huggingface/',
  'zeabur': 'huggingface/zeabur',
  'zhipu ai': 'huggingface/zhipuai',
  'openai': 'openai/',
};

/**
 * Mapping from model prefixes to human-readable provider names
 */
const PREFIX_DISPLAY_NAME_MAP: Record<string, string> = {
  'openrouter/': 'OpenRouter',
  'huggingface/zai-org': 'Z.AI Coding Plan',
  'huggingface/': 'HuggingFace',
  'huggingface/zeabur': 'Zeabur',
  'huggingface/zhipuai': 'ZhipuAI',
  'openai/': 'OpenAI',
};

/**
 * Get the display name for a provider prefix
 */
function getDisplayNameForPrefix(prefix: string): string {
  return PREFIX_DISPLAY_NAME_MAP[prefix] ?? prefix;
}

/**
 * OpenCode Adapter - discovers models from OpenCode CLI
 */
export class OpenCodeAdapter extends BaseAdapter {
  readonly agent: AgentType = 'opencode';
  readonly name = 'OpenCode';

  constructor() {
    super();
  }

  /**
   * Get the binary name for availability check
   */
  protected getBinaryName(): string {
    return 'opencode';
  }

  /**
   * Get the default model for OpenCode
   * Returns undefined since OpenCode manages its own default
   */
  getDefaultModel(): string | undefined {
    return undefined;
  }

  /**
   * Discover all available models from OpenCode
   * Groups models by provider
   */
  async discoverModels(): Promise<ModelProvider[]> {
    const [configuredPrefixes, allModels] = await Promise.all([
      this.getConfiguredProviderPrefixes(),
      this.getAllModels(),
    ]);

    log.debug('OpenCode discovery', {
      configuredProviders: configuredPrefixes.size,
      totalModels: allModels.length,
    });

    // Group models by provider
    const providerMap = new Map<string, DiscoveredModel[]>();

    for (const modelId of allModels) {
      const prefix = this.extractPrefix(modelId);
      if (!prefix) continue;

      // Check if this model is from a configured provider
      const isConfigured = Array.from(configuredPrefixes).some(
        (p) => prefix === p || prefix.startsWith(p)
      );

      if (!isConfigured) {
        // Skip models from unconfigured providers
        continue;
      }

      const displayName = this.extractDisplayName(modelId);
      const providerName = getDisplayNameForPrefix(prefix);

      if (!providerMap.has(prefix)) {
        providerMap.set(prefix, []);
      }

      providerMap.get(prefix)!.push(this.createModel(
        modelId,
        displayName,
        providerName,
        this.supportsVision(modelId),
        this.supportsImages(modelId),
      ));
    }

    // Convert map to ModelProvider array
    const providers: ModelProvider[] = [];

    for (const [prefix, models] of providerMap) {
      const displayName = getDisplayNameForPrefix(prefix);
      const isConfigured = configuredPrefixes.has(prefix);

      providers.push(
        this.createProvider(
          displayName,
          this.normalizeProviderId(prefix),
          models,
          isConfigured
        )
      );
    }

    // Sort providers by display name for consistency
    providers.sort((a, b) => a.name.localeCompare(b.name));

    log.info('OpenCode model discovery complete', {
      providerCount: providers.length,
      totalModels: providers.reduce((sum, p) => sum + p.models.length, 0),
    });

    return providers;
  }

  /**
   * Parse the output of `opencode auth list` to get configured provider prefixes
   * Uses async execution with timeout
   */
  private async getConfiguredProviderPrefixes(): Promise<Set<string>> {
    try {
      const output = await this.executeCommandAsync('opencode', ['auth', 'list'], TIMEOUTS.authList);

      const prefixes = new Set<string>();
      const lines = output.split('\n');

      for (const line of lines) {
        // Look for provider names with ● or ✓ marker
        const match = line.match(/^[●✓]\s+(\S+)/);
        if (match && match[1]) {
          const name = match[1].toLowerCase();
          const prefix = PROVIDER_PREFIX_MAP[name];
          if (prefix) {
            prefixes.add(prefix);
          }
        }
      }

      log.debug('Configured provider prefixes', {
        prefixes: Array.from(prefixes),
      });

      return prefixes;
    } catch (err) {
      log.warn('Failed to get configured providers', { error: String(err) });
      return new Set();
    }
  }

  /**
   * Get all available models from opencode
   * Uses async execution with timeout
   */
  private async getAllModels(): Promise<string[]> {
    try {
      const output = await this.executeCommandAsync('opencode', ['models'], TIMEOUTS.models);

      return output.split('\n').filter((line: string) => line.trim());
    } catch (err) {
      log.warn('Failed to get models', { error: String(err) });
      return [];
    }
  }

  /**
   * Extract the provider prefix from a model ID
   * e.g., "anthropic/claude-sonnet-4-20250514" → undefined
   * e.g., "openrouter/anthropic/claude-sonnet-4-20250514" → "openrouter/"
   */
  private extractPrefix(modelId: string): string | undefined {
    // Check each known prefix
    for (const prefix of Object.keys(PROVIDER_PREFIX_MAP)) {
      // Normalize prefix for comparison (ensure it ends with /)
      const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
      if (modelId.startsWith(normalizedPrefix)) {
        return prefix.endsWith('/') ? prefix : prefix + '/';
      }
    }

    // Check for prefixes in PREFIX_DISPLAY_NAME_MAP too
    for (const prefix of Object.keys(PREFIX_DISPLAY_NAME_MAP)) {
      if (modelId.startsWith(prefix)) {
        return prefix;
      }
    }

    return undefined;
  }

  /**
   * Extract the display name from a model ID
   * e.g., "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4-20250514"
   */
  private extractDisplayName(modelId: string): string {
    const lastSlashIndex = modelId.lastIndexOf('/');
    return lastSlashIndex !== -1 ? modelId.substring(lastSlashIndex + 1) : modelId;
  }

  /**
   * Normalize a provider prefix to a short ID
   * e.g., "huggingface/zai-org" → "huggingface-zai-org"
   */
  private normalizeProviderId(prefix: string): string {
    return prefix.replace(/\//g, '-').replace(/-$/, '');
  }

  /**
   * Check if a model supports vision/image input based on its name.
   * Vision-capable: opus, sonnet (except sonnet-4-haiku), claude-3-5-sonnet, claude-3-opus
   * Non-vision (text-only): haiku models, gpt-4o-mini (for some providers)
   */
  private supportsVision(modelId: string): boolean {
    const lower = modelId.toLowerCase();
    // Vision-capable patterns (Anthropic models)
    if (lower.includes('opus') || lower.includes('sonnet') || lower.includes('claude-3-5-sonnet') || lower.includes('claude-3-opus')) {
      return true;
    }
    // Non-vision patterns
    if (lower.includes('haiku')) {
      return false;
    }
    // Vision-capable OpenAI models
    if (lower.includes('gpt-4o') || lower.includes('gpt-4-vision')) {
      return true;
    }
    // Non-vision OpenAI models
    if (lower.includes('gpt-4o-mini') || lower.includes('gpt-3.5')) {
      return false;
    }
    // Vision-capable Gemini models
    if (lower.includes('gemini-1.5') || lower.includes('gemini-pro-vision')) {
      return true;
    }
    // Default to true for unknown models (most modern models support vision)
    return true;
  }

  /**
   * Check if a model supports image generation/output.
   * DALL-E, Imagen, and some GPT models support image generation.
   */
  private supportsImages(modelId: string): boolean {
    const lower = modelId.toLowerCase();
    // Image generation models
    if (lower.includes('dall-e') || lower.includes('imagen') || lower.includes('stable-diffusion')) {
      return true;
    }
    // GPT-4o with vision supports image output in some contexts
    if (lower.includes('gpt-4o') && !lower.includes('mini')) {
      return true;
    }
    return false;
  }
}
