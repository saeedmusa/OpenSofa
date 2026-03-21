/**
 * OpenSofa - Goose Model Adapter
 * 
 * Discovers models from Goose's profiles.yaml configuration.
 * Config: ~/.config/goose/profiles.yaml → provider/model
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { createLogger } from '../utils/logger.js';
import { BaseAdapter } from './base-adapter.js';
import type { AgentType } from '../types.js';
import type { ModelProvider } from './types.js';

const log = createLogger('goose-adapter');

interface GooseProfile {
  provider?: string;
  model?: string;
}

interface GooseProfiles {
  [profileName: string]: GooseProfile;
}

export class GooseAdapter extends BaseAdapter {
  readonly agent: AgentType = 'goose';
  readonly name = 'Goose';

  private readonly configPath: string;

  constructor() {
    super();
    this.configPath = path.join(homedir(), '.config', 'goose', 'profiles.yaml');
  }

  protected override getBinaryName(): string {
    return 'goose';
  }

  override isAvailable(): boolean {
    return existsSync(this.configPath);
  }

  async discoverModels(): Promise<ModelProvider[]> {
    if (!existsSync(this.configPath)) {
      log.debug('Goose profiles not found', { path: this.configPath });
      return [];
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const profiles = yaml.load(content) as GooseProfiles | null;

      if (!profiles || typeof profiles !== 'object') {
        log.debug('No profiles in Goose config');
        return [];
      }

      const providers: ModelProvider[] = [];

      for (const [profileName, profile] of Object.entries(profiles)) {
        if (!profile?.model) continue;

        const providerName = profile.provider ?? 'Unknown';
        const configured = Boolean(
          process.env.OPENAI_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.GOOSE_PROVIDER
        );

        providers.push(this.createProvider(
          `${providerName} (${profileName})`,
          providerName.toLowerCase().replace(/\s+/g, '-'),
          [this.createModel(profile.model, profile.model, providerName)],
          configured,
        ));
      }

      log.debug('Discovered Goose models', { profileCount: providers.length });
      return providers;
    } catch (err) {
      log.error('Failed to parse Goose profiles', { error: String(err) });
      return [];
    }
  }
}
