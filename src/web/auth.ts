/**
 * OpenSofa Web - Authentication Module
 *
 * Token-based authentication for the web interface.
 * Uses pure functions for token operations, dependency injection for file I/O.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { expandPath } from '../utils/expand-path.js';
import { createLogger } from '../utils/logger.js';
import type { TokenData, WebConfig } from './types.js';

const log = createLogger('web:auth');

const TOKEN_LENGTH = 32;
const TOKEN_ENCODING = 'hex';

// ──────────────────────────────────────
// Pure Functions (Token Operations)
// ──────────────────────────────────────

/**
 * Generate a cryptographically secure random token
 */
export const generateToken = (): string => {
  return crypto.randomBytes(TOKEN_LENGTH).toString(TOKEN_ENCODING);
};

/**
 * Create token data with expiry
 */
export const createTokenData = (
  token: string,
  expiryHours: number
): TokenData => {
  const now = Date.now();
  return {
    token,
    createdAt: now,
    expiresAt: now + expiryHours * 60 * 60 * 1000,
  };
};

/**
 * Check if token data is expired
 */
export const isTokenExpired = (tokenData: TokenData): boolean => {
  return Date.now() > tokenData.expiresAt;
};

/**
 * Validate a provided token against expected token
 * Uses constant-time comparison to prevent timing attacks
 */
export const validateToken = (provided: string, expected: string): boolean => {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(provided, TOKEN_ENCODING),
    Buffer.from(expected, TOKEN_ENCODING)
  );
};

/**
 * Validate token from Authorization header
 * Supports: "Bearer <token>" and "<token>"
 * Per RFC 6750, Bearer scheme is case-insensitive
 */
export const parseAuthHeader = (header: string | undefined): string | null => {
  if (!header) return null;
  
  const trimmed = header.trim();
  if (trimmed === '') return null;
  
  // Use startsWith for clean Bearer prefix detection (case-insensitive)
  const lowerTrimmed = trimmed.toLowerCase();
  
  if (lowerTrimmed.startsWith('bearer ')) {
    const token = trimmed.slice(7).trim();
    return token || null;
  }
  
  // No Bearer prefix - return as-is (raw token)
  return trimmed || null;
};

// ──────────────────────────────────────
// File Operations (with dependency injection)
// ──────────────────────────────────────

export interface TokenStorage {
  load: () => TokenData | null;
  save: (tokenData: TokenData) => void;
  exists: () => boolean;
}

/**
 * Create file-based token storage
 */
export const createFileTokenStorage = (tokenPath: string): TokenStorage => {
  const resolvedPath = expandPath(tokenPath);
  const dir = path.dirname(resolvedPath);

  return {
    exists: () => fs.existsSync(resolvedPath),

    load: () => {
      try {
        if (!fs.existsSync(resolvedPath)) return null;
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        return JSON.parse(content) as TokenData;
      } catch (err) {
        log.warn('Failed to load token file', { error: String(err) });
        return null;
      }
    },

    save: (tokenData: TokenData) => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(resolvedPath, JSON.stringify(tokenData, null, 2), {
          mode: 0o600, // Owner read/write only
        });
        log.info('Token saved', { path: resolvedPath });
      } catch (err) {
        log.error('Failed to save token file', { error: String(err) });
        throw err;
      }
    },
  };
};

// ──────────────────────────────────────
// Token Manager (combines operations)
// ──────────────────────────────────────

export interface TokenManager {
  getOrGenerate: () => string;
  validate: (providedToken: string) => boolean;
  getTokenData: () => TokenData | null;
  regenerate: () => string;
}

export interface TokenManagerDeps {
  storage: TokenStorage;
  expiryHours: number;
}

/**
 * Create a token manager with injected dependencies
 */
export const createTokenManager = (deps: TokenManagerDeps): TokenManager => {
  let cachedTokenData: TokenData | null = null;

  const loadOrGenerate = (): TokenData => {
    if (cachedTokenData && !isTokenExpired(cachedTokenData)) {
      return cachedTokenData;
    }

    const stored = deps.storage.load();
    if (stored && !isTokenExpired(stored)) {
      cachedTokenData = stored;
      return stored;
    }

    const newToken = generateToken();
    const newTokenData = createTokenData(newToken, deps.expiryHours);
    deps.storage.save(newTokenData);
    cachedTokenData = newTokenData;
    log.info('Generated new auth token');
    return newTokenData;
  };

  return {
    getOrGenerate: () => loadOrGenerate().token,

    validate: (providedToken: string): boolean => {
      const expected = loadOrGenerate().token;
      return validateToken(providedToken, expected);
    },

    getTokenData: () => {
      if (cachedTokenData && !isTokenExpired(cachedTokenData)) {
        return cachedTokenData;
      }
      return deps.storage.load();
    },

    regenerate: () => {
      const newToken = generateToken();
      const newTokenData = createTokenData(newToken, deps.expiryHours);
      deps.storage.save(newTokenData);
      cachedTokenData = newTokenData;
      log.info('Regenerated auth token');
      return newToken;
    },
  };
};

// ──────────────────────────────────────
// Convenience Factory
// ──────────────────────────────────────

/**
 * Create default token manager from config
 */
export const createDefaultTokenManager = (config: WebConfig): TokenManager => {
  return createTokenManager({
    storage: createFileTokenStorage(config.auth.tokenPath),
    expiryHours: config.auth.tokenExpiryHours,
  });
};

// ──────────────────────────────────────
// Legacy convenience function for main.ts
// ──────────────────────────────────────

let defaultTokenManager: TokenManager | null = null;

/**
 * Load or generate auth token (singleton pattern for convenience)
 */
export const loadOrGenerateToken = (config?: WebConfig): string => {
  // In E2E test mode, use a fixed test token (64 hex chars = 32 bytes)
  if (process.env.E2E_TEST === 'true' && process.env.NODE_ENV !== 'production') {
    return 'e2e0000000000000000000000000000000000000000000000000000000000000';
  }

  if (!defaultTokenManager && config) {
    defaultTokenManager = createDefaultTokenManager(config);
  }
  if (!defaultTokenManager) {
    throw new Error('Token manager not initialized. Call with config first.');
  }
  return defaultTokenManager.getOrGenerate();
};

/**
 * Get the token manager instance
 */
export const getTokenManager = (): TokenManager | null => defaultTokenManager;
