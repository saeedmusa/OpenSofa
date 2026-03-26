/**
 * OpenSofa - Cache Types
 * 
 * Type definitions for the model discovery caching system.
 */

import type { ModelProvider } from '../types.js';

// ──────────────────────────────────────
// Cache Interfaces
// ──────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheConfig {
  ttlMs: number;           // Default: 5 minutes (300000)
  maxSize: number;         // Max cached entries
  staleWhileRevalidate: boolean;  // Serve stale while refreshing
}

export interface CacheStatus {
  key: string;
  age: number;             // Age in ms
  ttl: number;             // TTL in ms
  isStale: boolean;
  isValid: boolean;
}

// ──────────────────────────────────────
// Discovery Progress
// ──────────────────────────────────────

export interface DiscoveryProgress {
  adapter: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// ──────────────────────────────────────
// Default Configuration
// ──────────────────────────────────────

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlMs: 300_000,           // 5 minutes
  maxSize: 100,
  staleWhileRevalidate: true,
};
