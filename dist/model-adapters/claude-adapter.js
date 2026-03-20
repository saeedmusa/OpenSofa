/**
 * OpenSofa - Claude Code Model Adapter
 *
 * Discovers models from Claude Code's settings.json configuration.
 * Supports Z.AI provider with GLM models and standard Anthropic API.
 */
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createLogger } from '../utils/logger.js';
import { getEnrichedPath } from '../utils/expand-path.js';
import { BaseAdapter } from './base-adapter.js';
const log = createLogger('claude-adapter');
/**
 * Claude Code model adapter.
 * Parses ~/.claude/settings.json to discover configured models and providers.
 */
export class ClaudeAdapter extends BaseAdapter {
    agent = 'claude';
    name = 'Claude Code';
    configPath;
    constructor() {
        super();
        this.configPath = path.join(homedir(), '.claude', 'settings.json');
    }
    /**
     * Check if Claude Code is available.
     * Returns true if claude binary exists OR if settings.json exists.
     */
    isAvailable() {
        // Check for claude binary
        try {
            execFileSync('which', ['claude'], {
                stdio: 'pipe',
                env: { ...process.env, PATH: getEnrichedPath() },
            });
            log.debug('Claude binary found');
            return true;
        }
        catch {
            // Binary not found, check for config file
        }
        // Check for settings.json
        if (existsSync(this.configPath)) {
            log.debug('Claude settings.json found');
            return true;
        }
        log.debug('Claude not available');
        return false;
    }
    /**
     * Discover models from Claude Code's configuration.
     * Reads ~/.claude/settings.json and extracts provider and model info.
     */
    async discoverModels() {
        log.debug('Discovering Claude Code models');
        if (!existsSync(this.configPath)) {
            log.warn('Claude settings.json not found', { path: this.configPath });
            return [];
        }
        let settings;
        try {
            const content = readFileSync(this.configPath, 'utf-8');
            settings = JSON.parse(content);
        }
        catch (err) {
            log.error('Failed to parse Claude settings.json', { error: String(err) });
            return [];
        }
        const env = settings.env || {};
        const provider = this.detectProvider(env.ANTHROPIC_BASE_URL);
        const models = this.extractModels(env, provider);
        const configured = Boolean(env.ANTHROPIC_AUTH_TOKEN);
        if (models.length === 0) {
            log.debug('No models found in Claude settings');
            return [];
        }
        const modelProvider = {
            name: provider === 'Z.AI' ? 'Z.AI' : 'Anthropic',
            id: provider.toLowerCase().replace('.', ''),
            agent: this.agent,
            models,
            configured,
        };
        log.debug('Discovered Claude models', {
            provider: modelProvider.name,
            modelCount: models.length,
            configured,
        });
        return [modelProvider];
    }
    /**
     * Detect the provider based on ANTHROPIC_BASE_URL.
     */
    detectProvider(baseUrl) {
        if (baseUrl && baseUrl.includes('z.ai')) {
            return 'Z.AI';
        }
        return 'Anthropic';
    }
    /**
     * Extract models from environment variables.
     */
    extractModels(env, provider) {
        const models = [];
        if (!env) {
            return models;
        }
        // Extract Opus-level model
        if (env.ANTHROPIC_DEFAULT_OPUS_MODEL) {
            models.push(this.createModel(env.ANTHROPIC_DEFAULT_OPUS_MODEL, env.ANTHROPIC_DEFAULT_OPUS_MODEL, provider));
        }
        // Extract Sonnet-level model
        if (env.ANTHROPIC_DEFAULT_SONNET_MODEL) {
            models.push(this.createModel(env.ANTHROPIC_DEFAULT_SONNET_MODEL, env.ANTHROPIC_DEFAULT_SONNET_MODEL, provider));
        }
        // Extract Haiku-level model
        if (env.ANTHROPIC_DEFAULT_HAIKU_MODEL) {
            models.push(this.createModel(env.ANTHROPIC_DEFAULT_HAIKU_MODEL, env.ANTHROPIC_DEFAULT_HAIKU_MODEL, provider));
        }
        return models;
    }
    /**
     * Get the default model from Claude settings.
     */
    getDefaultModel() {
        if (!existsSync(this.configPath)) {
            return undefined;
        }
        try {
            const content = readFileSync(this.configPath, 'utf-8');
            const settings = JSON.parse(content);
            return settings.model;
        }
        catch {
            return undefined;
        }
    }
}
//# sourceMappingURL=claude-adapter.js.map