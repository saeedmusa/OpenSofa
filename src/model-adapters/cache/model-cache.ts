/**
 * OpenSofa - Model Cache
 * 
 * In-memory cache for model discovery results with TTL support.
 * Provides stale-while-revalidate pattern for optimal performance.
 */

import { createLogger } from '../../utils/logger.js';
import type { ModelProvider } from '../types.js';
import type { CacheEntry, CacheConfig, CacheStatus } from './cache-types.js';
import { DEFAULT_CACHE_CONFIG } from './cache-types.js';

const log = createLogger('model-cache');

/**
 * Model cache with TTL support and stale-while-revalidate pattern.
 */
export class ModelCache {
  private cache: Map<string, CacheEntry<ModelProvider[]>> = new Map();
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    log.debug('Model cache initialized', { config: this.config });
  }

  /**
   * Get cached data for a key.
   * Returns null if not found or expired (unless staleWhileRevalidate is enabled).
   */
  get(key: string): ModelProvider[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    const isValid = age < entry.ttl;
    const isStale = age >= entry.ttl;

    if (isValid) {
      log.debug(`Cache hit: ${key}`, { age: `${Math.round(age / 1000)}s` });
      return entry.data;
    }

    if (this.config.staleWhileRevalidate && isStale) {
      log.debug(`Cache stale: ${key}`, { age: `${Math.round(age / 1000)}s` });
      return entry.data;
    }

    // Expired and not using stale-while-revalidate
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cached data for a key.
   */
  set(key: string, data: ModelProvider[]): void {
    // Enforce max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.config.ttlMs,
    });

    log.debug(`Cache set: ${key}`, { entries: this.cache.size });
  }

  /**
   * Invalidate cache entry for a key, or all entries if no key provided.
   */
  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
      log.debug(`Cache invalidated: ${key}`);
    } else {
      this.cache.clear();
      log.debug('Cache cleared');
    }
  }

  /**
   * Check if a cache entry is stale.
   */
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;

    const age = Date.now() - entry.timestamp;
    return age >= entry.ttl;
  }

  /**
   * Get the age of a cache entry in milliseconds.
   */
  getAge(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) return -1;

    return Date.now() - entry.timestamp;
  }

  /**
   * Get cache status for a key.
   */
  getStatus(key: string): CacheStatus | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    const isValid = age < entry.ttl;

    return {
      key,
      age,
      ttl: entry.ttl,
      isStale: !isValid,
      isValid,
    };
  }

  /**
   * Get all cache keys.
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      keys: this.getKeys(),
    };
  }

  /**
   * Evict the oldest cache entry.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      log.debug(`Cache evicted oldest: ${oldestKey}`);
    }
  }
}
