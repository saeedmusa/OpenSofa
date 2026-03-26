/**
 * OpenSofa - Codex Model Adapter
 * 
 * Discovers models from Codex's config.yaml configuration.
 * Config: ~/.codex/config.yaml → `model` key
 * Env: OPENAI_API_KEY
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { createLogger } from '../utils/logger.js';
import { BaseAdapter } from './base-adapter.js';
import type { AgentType } from '../types.js';
import type { ModelProvider } from './types.js';

const log = createLogger('codex-adapter');

interface CodexConfig {
  model?: string;
  provider?: string;
}

export class CodexAdapter extends BaseAdapter {
  readonly agent: AgentType = 'codex';
  readonly name = 'Codex';

  private readonly configPath: string;

  constructor() {
    super();
    this.configPath = path.join(homedir(), '.codex', 'config.yaml');
  }

  protected override getBinaryName(): string {
    return 'codex';
  }

  /**
   * Check if Codex is available asynchronously.
   * Returns true if config file exists.
   */
  async isAvailableAsync(): Promise<boolean> {
    return existsSync(this.configPath);
  }

  /**
   * Check if Codex is available (sync version - deprecated).
   * @deprecated Use isAvailableAsync() instead
   */
  override isAvailable(): boolean {
    return existsSync(this.configPath);
  }

  async discoverModels(): Promise<ModelProvider[]> {
    if (!existsSync(this.configPath)) {
      log.debug('Codex config not found', { path: this.configPath });
      return [];
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const config = yaml.load(content) as CodexConfig | null;

      if (!config?.model) {
        log.debug('No model in Codex config');
        return [];
      }

      const configured = Boolean(process.env.OPENAI_API_KEY);

      const provider = this.createProvider(
        'OpenAI',
        'openai',
        [this.createModel(config.model, config.model, 'OpenAI')],
        configured,
      );

      log.debug('Discovered Codex model', { model: config.model });
      return [provider];
    } catch (err) {
      log.error('Failed to parse Codex config', { error: String(err) });
      return [];
    }
  }

  override getDefaultModel(): string | undefined {
    if (!existsSync(this.configPath)) return undefined;
    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const config = yaml.load(content) as CodexConfig | null;
      return config?.model;
    } catch {
      return undefined;
    }
  }
}
