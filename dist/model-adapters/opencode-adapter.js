/**
 * OpenSofa - OpenCode Model Adapter
 *
 * Adapter for discovering models from OpenCode CLI.
 * Uses `opencode models` and `opencode auth list` commands.
 */
import { execSync } from 'child_process';
import { createLogger } from '../utils/logger.js';
import { getEnrichedEnv } from '../utils/expand-path.js';
import { BaseAdapter } from './base-adapter.js';
const log = createLogger('opencode-adapter');
/**
 * Mapping from raw provider names (from opencode auth list)
 * to model prefixes (used in opencode models output)
 */
const PROVIDER_PREFIX_MAP = {
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
const PREFIX_DISPLAY_NAME_MAP = {
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
function getDisplayNameForPrefix(prefix) {
    return PREFIX_DISPLAY_NAME_MAP[prefix] ?? prefix;
}
/**
 * OpenCode Adapter - discovers models from OpenCode CLI
 */
export class OpenCodeAdapter extends BaseAdapter {
    agent = 'opencode';
    name = 'OpenCode';
    constructor() {
        super();
    }
    /**
     * Get the binary name for availability check
     */
    getBinaryName() {
        return 'opencode';
    }
    /**
     * Get the default model for OpenCode
     * Returns undefined since OpenCode manages its own default
     */
    getDefaultModel() {
        return undefined;
    }
    /**
     * Discover all available models from OpenCode
     * Groups models by provider
     */
    async discoverModels() {
        const configuredPrefixes = this.getConfiguredProviderPrefixes();
        const allModels = this.getAllModels();
        log.debug('OpenCode discovery', {
            configuredProviders: configuredPrefixes.size,
            totalModels: allModels.length,
        });
        // Group models by provider
        const providerMap = new Map();
        for (const modelId of allModels) {
            const prefix = this.extractPrefix(modelId);
            if (!prefix)
                continue;
            // Check if this model is from a configured provider
            const isConfigured = Array.from(configuredPrefixes).some((p) => prefix === p || prefix.startsWith(p));
            if (!isConfigured) {
                // Skip models from unconfigured providers
                continue;
            }
            const displayName = this.extractDisplayName(modelId);
            const providerName = getDisplayNameForPrefix(prefix);
            if (!providerMap.has(prefix)) {
                providerMap.set(prefix, []);
            }
            providerMap.get(prefix).push(this.createModel(modelId, displayName, providerName));
        }
        // Convert map to ModelProvider array
        const providers = [];
        for (const [prefix, models] of providerMap) {
            const displayName = getDisplayNameForPrefix(prefix);
            const isConfigured = configuredPrefixes.has(prefix);
            providers.push(this.createProvider(displayName, this.normalizeProviderId(prefix), models, isConfigured));
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
     */
    getConfiguredProviderPrefixes() {
        try {
            const output = execSync('opencode auth list', {
                encoding: 'utf-8',
                timeout: 10000,
                env: getEnrichedEnv(),
            });
            const prefixes = new Set();
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
        }
        catch (err) {
            log.warn('Failed to get configured providers', { error: String(err) });
            return new Set();
        }
    }
    /**
     * Get all available models from opencode
     */
    getAllModels() {
        try {
            const output = execSync('opencode models', {
                encoding: 'utf-8',
                timeout: 30000,
                env: getEnrichedEnv(),
            });
            return output.split('\n').filter((line) => line.trim());
        }
        catch (err) {
            log.warn('Failed to get models', { error: String(err) });
            return [];
        }
    }
    /**
     * Extract the provider prefix from a model ID
     * e.g., "anthropic/claude-sonnet-4-20250514" → undefined
     * e.g., "openrouter/anthropic/claude-sonnet-4-20250514" → "openrouter/"
     */
    extractPrefix(modelId) {
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
    extractDisplayName(modelId) {
        const lastSlashIndex = modelId.lastIndexOf('/');
        return lastSlashIndex !== -1 ? modelId.substring(lastSlashIndex + 1) : modelId;
    }
    /**
     * Normalize a provider prefix to a short ID
     * e.g., "huggingface/zai-org" → "huggingface-zai-org"
     */
    normalizeProviderId(prefix) {
        return prefix.replace(/\//g, '-').replace(/-$/, '');
    }
}
//# sourceMappingURL=opencode-adapter.js.map