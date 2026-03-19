/**
 * OpenSofa Web - Authentication Module
 *
 * Token-based authentication for the web interface.
 * Uses pure functions for token operations, dependency injection for file I/O.
 */
import type { TokenData, WebConfig } from './types.js';
/**
 * Generate a cryptographically secure random token
 */
export declare const generateToken: () => string;
/**
 * Create token data with expiry
 */
export declare const createTokenData: (token: string, expiryHours: number) => TokenData;
/**
 * Check if token data is expired
 */
export declare const isTokenExpired: (tokenData: TokenData) => boolean;
/**
 * Validate a provided token against expected token
 * Uses constant-time comparison to prevent timing attacks
 */
export declare const validateToken: (provided: string, expected: string) => boolean;
/**
 * Validate token from Authorization header
 * Supports: "Bearer <token>" and "<token>"
 * Per RFC 6750, Bearer scheme is case-insensitive
 */
export declare const parseAuthHeader: (header: string | undefined) => string | null;
export interface TokenStorage {
    load: () => TokenData | null;
    save: (tokenData: TokenData) => void;
    exists: () => boolean;
}
/**
 * Create file-based token storage
 */
export declare const createFileTokenStorage: (tokenPath: string) => TokenStorage;
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
export declare const createTokenManager: (deps: TokenManagerDeps) => TokenManager;
/**
 * Create default token manager from config
 */
export declare const createDefaultTokenManager: (config: WebConfig) => TokenManager;
/**
 * Load or generate auth token (singleton pattern for convenience)
 */
export declare const loadOrGenerateToken: (config?: WebConfig) => string;
/**
 * Get the token manager instance
 */
export declare const getTokenManager: () => TokenManager | null;
//# sourceMappingURL=auth.d.ts.map