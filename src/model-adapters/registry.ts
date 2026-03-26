/**
 * OpenSofa - Adapter Registry
 * 
 * Central registry for model discovery adapters.
 * Manages registration and discovery of models across all agents.
 * Includes caching and parallel discovery for performance.
 */

import { createLogger } from '../utils/logger.js';
import { ModelCache } from './cache/model-cache.js';
import type { AgentType } from '../types.js';
import type { 
  ModelAdapter, 
  ModelDiscoveryResult, 
  ModelProvider 
} from './types.js';
import type { DiscoveryProgress, CacheStatus } from './cache/cache-types.js';

const log = createLogger('adapter-registry');

// Cache key constants
const CACHE_KEYS = {
  allDiscovery: 'all:discovery',
  agentDiscovery: (agent: string) => `${agent}:discovery`,
} as const;

// Singleton instance
let registryInstance: AdapterRegistry | null = null;

/**
 * AdapterRegistry - manages all model discovery adapters
 * 
 * Provides methods to:
 * - Register adapters for specific agent types
 * - Retrieve adapters by agent type
 * - Discover models from all or specific agents
 * - Handle errors gracefully across adapters
 * - Cache discovery results for performance
 */
export class AdapterRegistry {
  private adapters: Map<AgentType, ModelAdapter> = new Map();
  private cache: ModelCache;
  private progress: Map<AgentType, DiscoveryProgress> = new Map();
  
  constructor() {
    this.cache = new ModelCache();
  }
  
  /**
   * Get the singleton registry instance
   */
  static getInstance(): AdapterRegistry {
    if (!registryInstance) {
      registryInstance = new AdapterRegistry();
    }
    return registryInstance;
  }
  
  /**
   * Register an adapter for a specific agent type.
   * If an adapter already exists for this agent type, it will be replaced.
   * 
   * @param adapter - The model adapter to register
   */
  registerAdapter(adapter: ModelAdapter): void {
    log.debug(`Registering adapter for agent: ${adapter.agent}`, { 
      name: adapter.name 
    });
    this.adapters.set(adapter.agent, adapter);
  }
  
  /**
   * Get the adapter for a specific agent type.
   * 
   * @param agent - The agent type to look up
   * @returns The adapter if found, undefined otherwise
   */
  getAdapter(agent: AgentType): ModelAdapter | undefined {
    return this.adapters.get(agent);
  }
  
  /**
   * Get all registered adapters.
   * 
   * @returns Array of all registered adapters
   */
  getAllAdapters(): ModelAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * Discover models from all registered adapters.
   * Uses caching and parallel discovery for performance.
   * Errors in one adapter don't affect others.
   * 
   * @param agents - Optional list of specific agents to discover from. 
   *                 If not provided, discovers from all registered adapters.
   * @returns Combined discovery result from all adapters
   */
  async discoverAll(agents?: AgentType[]): Promise<ModelDiscoveryResult> {
    const cacheKey = agents 
      ? `agents:${agents.sort().join(',')}`
      : CACHE_KEYS.allDiscovery;

    // Check cache first - implement stale-while-revalidate
    const cached = this.cache.get(cacheKey);
    const isStale = this.cache.isStale(cacheKey);
    
    if (cached && !isStale) {
      // Fresh cache hit - return immediately
      log.debug('Returning cached discovery result (fresh)', { cacheKey });
      return {
        success: true,
        providers: cached,
      };
    }
    
    if (cached && isStale) {
      // Stale cache - return stale data immediately but trigger background refresh
      log.debug('Returning stale cached result, triggering background refresh', { cacheKey });
      // Trigger background refresh (don't await)
      this.refreshCache(agents).catch(err => {
        log.error('Background cache refresh failed', { error: String(err) });
      });
      return {
        success: true,
        providers: cached,
      };
    }

    // No cache - do full discovery
    const errors: string[] = [];
    const allProviders: ModelProvider[] = [];
    
    const adaptersToCheck = agents 
      ? agents.map(agent => this.adapters.get(agent)).filter((a): a is ModelAdapter => a !== undefined)
      : this.getAllAdapters();
    
    log.debug('Starting model discovery', { 
      adapterCount: adaptersToCheck.length,
      agents: agents ?? 'all'
    });
    
    // Parallel discovery using Promise.allSettled
    const results = await Promise.allSettled(
      adaptersToCheck.map(adapter => this.discoverForAdapter(adapter))
    );

    // Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const adapter = adaptersToCheck[i];

      if (!result || !adapter) continue;

      if (result.status === 'fulfilled') {
        allProviders.push(...result.value);
      } else {
        const errorMsg = `Error discovering models from ${adapter.name}: ${String(result.reason)}`;
        log.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    log.info('Model discovery complete', { 
      providerCount: allProviders.length,
      errorCount: errors.length 
    });

    // Cache the result
    this.cache.set(cacheKey, allProviders);
    
    return {
      success: errors.length === 0,
      providers: allProviders,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Discover models for a single adapter with progress tracking.
   */
  private async discoverForAdapter(adapter: ModelAdapter): Promise<ModelProvider[]> {
    // Update progress
    this.progress.set(adapter.agent, {
      adapter: adapter.agent,
      status: 'running',
      startedAt: Date.now(),
    });

    try {
      // Use async availability check
      const available = await adapter.isAvailableAsync();
      if (!available) {
        log.debug(`Adapter not available, skipping: ${adapter.name}`);
        this.progress.set(adapter.agent, {
          adapter: adapter.agent,
          status: 'completed',
          startedAt: this.progress.get(adapter.agent)?.startedAt,
          completedAt: Date.now(),
        });
        return [];
      }

      const providers = await adapter.discoverModels();
      log.debug(`Discovered ${providers.length} providers from ${adapter.name}`);

      // Update progress
      this.progress.set(adapter.agent, {
        adapter: adapter.agent,
        status: 'completed',
        startedAt: this.progress.get(adapter.agent)?.startedAt,
        completedAt: Date.now(),
      });

      return providers;
    } catch (err) {
      // Update progress with error
      this.progress.set(adapter.agent, {
        adapter: adapter.agent,
        status: 'failed',
        startedAt: this.progress.get(adapter.agent)?.startedAt,
        completedAt: Date.now(),
        error: String(err),
      });
      throw err;
    }
  }
  
  /**
   * Discover models from a specific agent.
   * 
   * @param agent - The agent type to discover models from
   * @returns List of providers from this agent, or empty array if adapter not found
   */
  async discoverForAgent(agent: AgentType): Promise<ModelProvider[]> {
    const adapter = this.adapters.get(agent);
    
    if (!adapter) {
      log.warn(`No adapter registered for agent: ${agent}`);
      return [];
    }
    
    const available = await adapter.isAvailableAsync();
    if (!available) {
      log.debug(`Adapter not available: ${adapter.name}`);
      return [];
    }
    
    try {
      return await adapter.discoverModels();
    } catch (err) {
      log.error(`Error discovering models for ${agent}`, { error: String(err) });
      return [];
    }
  }

  /**
   * Force cache refresh for all or specific agents.
   * Invalidates cache and re-discovers models.
   */
  async refreshCache(agents?: AgentType[]): Promise<ModelDiscoveryResult> {
    const cacheKey = agents 
      ? `agents:${agents.sort().join(',')}`
      : CACHE_KEYS.allDiscovery;

    // Invalidate cache
    this.cache.invalidate(cacheKey);
    log.debug('Cache invalidated', { cacheKey });

    // Re-discover
    return this.discoverAll(agents);
  }

  /**
   * Get discovery progress for all adapters.
   */
  getProgress(): DiscoveryProgress[] {
    return Array.from(this.progress.values());
  }

  /**
   * Get cache status for a key.
   */
  getCacheStatus(key?: string): CacheStatus | null {
    const cacheKey = key ?? CACHE_KEYS.allDiscovery;
    return this.cache.getStatus(cacheKey);
  }

  /**
   * Get all cache statuses.
   */
  getAllCacheStatuses(): CacheStatus[] {
    const statuses: CacheStatus[] = [];
    for (const key of this.cache.getKeys()) {
      const status = this.cache.getStatus(key);
      if (status) {
        statuses.push(status);
      }
    }
    return statuses;
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; maxSize: number; keys: string[] } {
    return this.cache.getStats();
  }
  
  /**
   * Check if any adapters are registered.
   */
  hasAdapters(): boolean {
    return this.adapters.size > 0;
  }
  
  /**
   * Get list of agents with registered adapters.
   */
  getRegisteredAgents(): AgentType[] {
    return Array.from(this.adapters.keys());
  }
}

// Export singleton getter for convenience
export function getAdapterRegistry(): AdapterRegistry {
  return AdapterRegistry.getInstance();
}
