/**
 * OpenSofa - Aider Model Adapter
 * 
 * Discovers models from Aider's .aider.conf.yml configuration.
 * Config: ~/.aider.conf.yml → `model` key
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import yaml from 'js-yaml';
import { createLogger } from '../utils/logger.js';
import { getEnrichedPath } from '../utils/expand-path.js';
import { BaseAdapter } from './base-adapter.js';
import type { AgentType } from '../types.js';
import type { ModelProvider } from './types.js';

const log = createLogger('aider-adapter');

interface AiderConfig {
  model?: string;
  'openai-api-key'?: string;
  'anthropic-api-key'?: string;
}

export class AiderAdapter extends BaseAdapter {
  readonly agent: AgentType = 'aider';
  readonly name = 'Aider';

  private readonly configPath: string;

  constructor() {
    super();
    this.configPath = path.join(homedir(), '.aider.conf.yml');
  }

  protected override getBinaryName(): string {
    return 'aider';
  }

  /**
   * Check if Aider is available asynchronously.
   * Returns true if aider binary exists OR if config file exists.
   */
  async isAvailableAsync(): Promise<boolean> {
    const binaryAvailable = await super.isAvailableAsync();
    if (binaryAvailable) {
      return true;
    }

    return existsSync(this.configPath);
  }

  /**
   * Check if Aider is available (sync version - deprecated).
   * @deprecated Use isAvailableAsync() instead
   */
  override isAvailable(): boolean {
    try {
      execFileSync('which', ['aider'], {
        stdio: 'pipe',
        env: { ...process.env, PATH: getEnrichedPath() },
      });
      return true;
    } catch { /* noop */ }

    return existsSync(this.configPath);
  }

  async discoverModels(): Promise<ModelProvider[]> {
    if (!existsSync(this.configPath)) {
      log.debug('Aider config not found', { path: this.configPath });
      return [];
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const config = yaml.load(content) as AiderConfig | null;

      if (!config?.model) {
        log.debug('No model configured in Aider config');
        return [];
      }

      const modelId = config.model;
      const configured = Boolean(config['openai-api-key'] || config['anthropic-api-key'] || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

      const provider = this.createProvider(
        this.detectProvider(modelId),
        this.detectProvider(modelId).toLowerCase(),
        [this.createModel(modelId, modelId, this.detectProvider(modelId))],
        configured,
      );

      log.debug('Discovered Aider model', { model: modelId });
      return [provider];
    } catch (err) {
      log.error('Failed to parse Aider config', { error: String(err) });
      return [];
    }
  }

  override getDefaultModel(): string | undefined {
    if (!existsSync(this.configPath)) return undefined;
    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const config = yaml.load(content) as AiderConfig | null;
      return config?.model;
    } catch {
      return undefined;
    }
  }

  private detectProvider(modelId: string): string {
    const lower = modelId.toLowerCase();
    if (lower.includes('claude') || lower.includes('anthropic')) return 'Anthropic';
    if (lower.includes('gpt') || lower.includes('openai')) return 'OpenAI';
    if (lower.includes('gemini') || lower.includes('google')) return 'Google';
    if (lower.includes('deepseek')) return 'DeepSeek';
    if (lower.includes('ollama')) return 'Ollama';
    return 'Unknown';
  }
}
