/**
 * OpenSofa - OpenCode Models API
 * 
 * Endpoints to discover available models from configured providers.
 */

import { Hono } from 'hono';
import { execFileSync } from 'child_process';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('opencode-models');

/**
 * Parse the output of `opencode auth list` to get configured providers
 */
function getConfiguredProviders(): Set<string> {
  try {
    const output = execFileSync('opencode', ['auth', 'list'], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    const providers = new Set<string>();
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Look for provider names with ● or ✓ marker
      const match = line.match(/^[●✓]\s+(\S+)/);
      if (match && match[1]) {
        const name = match[1].toLowerCase();
        // Map provider display names to model prefixes
        if (name === 'openrouter') providers.add('openrouter');
        else if (name === 'z.ai coding plan' || name === 'zai' || name === 'z.ai' || name === 'z-ai') providers.add('huggingface/zai-org');
        else if (name === 'hugging face') providers.add('huggingface');
        else if (name === 'zeabur') providers.add('huggingface/zeabur');
        else if (name === 'zhipu ai' || name === 'zhipuai') providers.add('huggingface/zhipuai');
        else if (name === 'openai') providers.add('openai');
      }
    }
    
    return providers;
  } catch (err) {
    log.error('Failed to get configured providers', { error: String(err) });
    return new Set();
  }
}

/**
 * Get all available models from opencode
 */
function getAllModels(): string[] {
  try {
    const output = execFileSync('opencode', ['models'], {
      encoding: 'utf-8',
      timeout: 30000,
    });
    
    return output.split('\n').filter(line => line.trim());
  } catch (err) {
    log.error('Failed to get models', { error: String(err) });
    return [];
  }
}

export function createOpenCodeModelsRoutes(): Hono {
  const app = new Hono();
  
  // GET /api/opencode/models - Get models from configured providers
  app.get('/models', (c) => {
    const providers = getConfiguredProviders();
    const allModels = getAllModels();
    
    log.debug('Configured providers', { providers: Array.from(providers) });
    log.debug('Total models available', { count: allModels.length });
    
    // Filter models to only those from configured providers
    const configuredModels = allModels.filter(model => {
      for (const provider of providers) {
        if (model.startsWith(provider)) {
          return true;
        }
      }
      return false;
    });
    
    log.debug('Filtered models', { count: configuredModels.length });
    
    return c.json({
      success: true,
      providers: Array.from(providers),
      models: configuredModels,
    });
  });
  
  // GET /api/opencode/providers - Get configured providers
  app.get('/providers', (c) => {
    const providers = getConfiguredProviders();
    
    return c.json({
      success: true,
      providers: Array.from(providers),
    });
  });
  
  return app;
}
