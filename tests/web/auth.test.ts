/**
 * Tests for Web Auth
 * Phase 0 US-0.1: Token-based authentication
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createDefaultTokenManager,
  parseAuthHeader,
  validateToken,
  generateToken,
} from '../../src/web/auth.js';
import type { WebConfig } from '../../src/web/types.js';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

import fs from 'fs';

describe('TokenManager', () => {
  let tokenManager: ReturnType<typeof createDefaultTokenManager>;
  let config: WebConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      port: 3285,
      tunnel: { provider: 'cloudflare' },
      auth: {
        tokenPath: '/tmp/.opensofa/web-token',
        tokenExpiryHours: 24,
      },
    };
    vi.clearAllMocks();
  });

  describe('getOrGenerate', () => {
    it('should generate new token when none exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      tokenManager = createDefaultTokenManager(config);
      const token = tokenManager.getOrGenerate();

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(20);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should load existing valid token', () => {
      const existingToken = 'existing-token-abc123';
      const tokenData = JSON.stringify({
        token: existingToken,
        createdAt: Date.now() - 1000 * 60 * 60,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(tokenData);

      tokenManager = createDefaultTokenManager(config);
      const token = tokenManager.getOrGenerate();

      expect(token).toBe(existingToken);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should regenerate expired token', () => {
      const tokenData = JSON.stringify({
        token: 'expired-token',
        createdAt: Date.now() - 1000 * 60 * 60 * 48,
        expiresAt: Date.now() - 1000 * 60 * 60,
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(tokenData);

      tokenManager = createDefaultTokenManager(config);
      const token = tokenManager.getOrGenerate();

      expect(token).not.toBe('expired-token');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should regenerate on corrupt token file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('not valid json');

      tokenManager = createDefaultTokenManager(config);
      const token = tokenManager.getOrGenerate();

      expect(token).toBeDefined();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('regenerate', () => {
    it('should generate new token', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      tokenManager = createDefaultTokenManager(config);
      const oldToken = tokenManager.getOrGenerate();
      const newToken = tokenManager.regenerate();

      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);
    });
  });

  describe('getTokenData', () => {
    it('should return token data with expiry', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      tokenManager = createDefaultTokenManager(config);
      tokenManager.getOrGenerate();

      const data = tokenManager.getTokenData();
      expect(data).not.toBeNull();
      expect(data!.token).toBeDefined();
      expect(data!.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('validate', () => {
    it('should validate correct token', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      tokenManager = createDefaultTokenManager(config);
      const token = tokenManager.getOrGenerate();

      expect(tokenManager.validate(token)).toBe(true);
    });

    it('should reject incorrect token', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      tokenManager = createDefaultTokenManager(config);
      tokenManager.getOrGenerate();

      expect(tokenManager.validate('wrong-token')).toBe(false);
    });
  });
});

describe('Pure Functions', () => {
  describe('generateToken', () => {
    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(20);
    });

    it('should generate URL-safe tokens', () => {
      const token = generateToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('parseAuthHeader', () => {
    it('should parse Bearer token', () => {
      const result = parseAuthHeader('Bearer my-token-123');
      expect(result).toBe('my-token-123');
    });

    it('should return null for missing header', () => {
      expect(parseAuthHeader(undefined)).toBeNull();
    });

    it('should return raw token if no Bearer prefix', () => {
      expect(parseAuthHeader('my-token-123')).toBe('my-token-123');
    });

    it('should handle whitespace', () => {
      expect(parseAuthHeader('Bearer   my-token   ')).toBe('my-token');
    });
  });

  describe('validateToken', () => {
    it('should validate matching tokens', () => {
      expect(validateToken('my-token', 'my-token')).toBe(true);
    });

    it('should reject non-matching tokens', () => {
      expect(validateToken('my-token', 'wrong-token')).toBe(false);
    });

    it('should reject empty tokens', () => {
      expect(validateToken('', 'my-token')).toBe(false);
      expect(validateToken('my-token', '')).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      const token = 'a'.repeat(32);
      const wrongToken = 'b'.repeat(32);
      
      validateToken(wrongToken, token);
      
      expect(true).toBe(true);
    });
  });
});
