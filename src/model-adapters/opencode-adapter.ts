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
  authList: 20_000,       // 20s for `opencode auth list`
  models: 45_000,         // 45s for `opencode models`
} as const;

/**
 * Mapping from raw provider names (from opencode auth list)
 * to model prefixes (used in opencode models output)
 */
const PROVIDER_PREFIX_MAP: Record<string, string> = {
  'openrouter': 'openrouter/',
  'minimax': 'openrouter/minimax',
  'z.ai coding plan': 'huggingface/zai-org',
  'zai': 'huggingface/zai-org',
  'z.ai': 'huggingface/zai-org',
  'hugging face': 'huggingface/',
  'huggingface': 'huggingface/',
  'zeabur': 'huggingface/zeabur',
  'zhipu ai': 'huggingface/zhipuai',
  'zhipu': 'huggingface/zhipuai',
  'openai': 'openai/',
  'anthropic': 'anthropic/',
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
   * Groups models by the configured provider prefix they match
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

    // Group models by matching configured prefix
    const providerMap = new Map<string, DiscoveredModel[]>();

    for (const modelId of allModels) {
      // Find the longest matching configured prefix for this model
      const matchingPrefix = this.findMatchingPrefix(modelId, configuredPrefixes);
      if (!matchingPrefix) continue;

      const displayName = this.extractDisplayName(modelId);
      const providerName = getDisplayNameForPrefix(matchingPrefix);

      if (!providerMap.has(matchingPrefix)) {
        providerMap.set(matchingPrefix, []);
      }

      providerMap.get(matchingPrefix)!.push(this.createModel(
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

      providers.push(
        this.createProvider(
          displayName,
          this.normalizeProviderId(prefix),
          models,
          true // All grouped providers are from configured prefixes
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

      // Strip ANSI escape sequences for reliable parsing
      const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
      const prefixes = new Set<string>();

      // Try matching each known provider name against each line
      for (const line of cleanOutput.split('\n')) {
        // Look for lines with bullet markers: ● ProviderName or ✓ ProviderName
        const bulletMatch = line.match(/^[│ ]*[●✓*]\s+(.+?)(?:\s{2,}|$)/);
        if (bulletMatch) {
          const rawName = (bulletMatch[1] ?? '').trim().toLowerCase();
          // Try exact match first
          const prefix = PROVIDER_PREFIX_MAP[rawName];
          if (prefix) {
            prefixes.add(prefix);
            continue;
          }
          // Try matching each known provider key against the full line text
          for (const [key, mappedPrefix] of Object.entries(PROVIDER_PREFIX_MAP)) {
            if (rawName.includes(key) || key.includes(rawName)) {
              prefixes.add(mappedPrefix);
              break;
            }
          }
        }
      }

      // Fallback: If no providers were explicitly marked but we see 'openrouter' in the list,
      // assume it might be available if we're in a desktop context.
      if (prefixes.size === 0 && cleanOutput.toLowerCase().includes('openrouter')) {
        prefixes.add('openrouter/');
      }

      log.debug('Configured provider prefixes', {
        prefixes: Array.from(prefixes),
        foundInOutput: output.length > 0,
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
   * Find the longest matching configured prefix for a model ID.
   * Returns the prefix from configuredPrefixes that matches, or undefined.
   */
  private findMatchingPrefix(modelId: string, configuredPrefixes: Set<string>): string | undefined {
    let bestMatch: string | undefined;
    let bestLen = 0;

    for (const prefix of configuredPrefixes) {
      if (modelId.startsWith(prefix) && prefix.length > bestLen) {
        bestMatch = prefix;
        bestLen = prefix.length;
      }
    }

    return bestMatch;
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
