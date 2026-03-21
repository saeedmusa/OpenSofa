/**
 * OpenSofa - Gemini Model Adapter
 * 
 * Discovers models from Gemini CLI's settings.json configuration.
 * Config: ~/.gemini/settings.json → `model` key
 * Env: GEMINI_MODEL
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { createLogger } from '../utils/logger.js';
import { BaseAdapter } from './base-adapter.js';
import type { AgentType } from '../types.js';
import type { ModelProvider } from './types.js';

const log = createLogger('gemini-adapter');

interface GeminiSettings {
  model?: string;
  theme?: string;
}

export class GeminiAdapter extends BaseAdapter {
  readonly agent: AgentType = 'gemini';
  readonly name = 'Gemini';

  private readonly configPath: string;

  constructor() {
    super();
    this.configPath = path.join(homedir(), '.gemini', 'settings.json');
  }

  protected override getBinaryName(): string {
    return 'gemini';
  }

  override isAvailable(): boolean {
    return existsSync(this.configPath) || Boolean(process.env.GEMINI_MODEL);
  }

  async discoverModels(): Promise<ModelProvider[]> {
    let modelId: string | undefined;

    // Try config file first
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        const settings: GeminiSettings = JSON.parse(content);
        modelId = settings.model;
      } catch (err) {
        log.error('Failed to parse Gemini settings', { error: String(err) });
      }
    }

    // Fall back to env var
    if (!modelId) {
      modelId = process.env.GEMINI_MODEL;
    }

    if (!modelId) {
      log.debug('No Gemini model configured');
      return [];
    }

    const configured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

    const provider = this.createProvider(
      'Google',
      'google',
      [this.createModel(modelId, modelId, 'Google')],
      configured,
    );

    log.debug('Discovered Gemini model', { model: modelId });
    return [provider];
  }

  override getDefaultModel(): string | undefined {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        const settings: GeminiSettings = JSON.parse(content);
        return settings.model;
      } catch { /* noop */ }
    }
    return process.env.GEMINI_MODEL;
  }
}
