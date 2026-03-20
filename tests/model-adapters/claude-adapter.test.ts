/**
 * Tests for Claude Code Model Adapter
 * Task 07: Testing for Model Discovery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';

// Mock child_process module
vi.mock('child_process');

// Mock fs module
vi.mock('fs');

// Mock os.homedir
vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
}));

// Mock the logger to avoid console output during tests
vi.mock('../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock expand-path utilities
vi.mock('../../src/utils/expand-path.js', () => ({
  getEnrichedPath: vi.fn().mockReturnValue('/usr/local/bin:/usr/bin:/bin'),
}));

// Import adapter after mocks are set up
import { ClaudeAdapter } from '../../src/model-adapters/claude-adapter.js';

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;
  const mockConfigPath = '/home/testuser/.claude/settings.json';

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ClaudeAdapter();
  });

  describe('agent', () => {
    it('should have correct agent type', () => {
      expect(adapter.agent).toBe('claude');
    });
  });

  describe('name', () => {
    it('should have correct display name', () => {
      expect(adapter.name).toBe('Claude Code');
    });
  });

  describe('isAvailable()', () => {
    it('should return true when claude binary is found', () => {
      // Arrange: Mock execFileSync to return successfully (binary found)
      vi.mocked(execFileSync).mockReturnValue(Buffer.from('/usr/local/bin/claude'));

      // Act
      const result = adapter.isAvailable();

      // Assert
      expect(result).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith(
        'which',
        ['claude'],
        expect.objectContaining({ stdio: 'pipe' })
      );
    });

    it('should return true when settings.json exists even without binary', () => {
      // Arrange: Mock execFileSync to throw (binary not found), but settings.json exists
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('Command not found');
      });
      vi.mocked(existsSync).mockReturnValue(true);

      // Act
      const result = adapter.isAvailable();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when neither binary nor settings.json exists', () => {
      // Arrange
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('Command not found');
      });
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      const result = adapter.isAvailable();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('discoverModels()', () => {
    const mockSettingsWithZAI = JSON.stringify({
      env: {
        ANTHROPIC_AUTH_TOKEN: 'test-token-123',
        ANTHROPIC_BASE_URL: 'https://api.z.ai',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-20250514',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-20250514',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-20250514',
      },
    });

    const mockSettingsWithAnthropic = JSON.stringify({
      env: {
        ANTHROPIC_AUTH_TOKEN: 'test-token-456',
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-20250514',
      },
    });

    it('should return models from Z.AI provider', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(mockSettingsWithZAI);

      // Act
      const providers = await adapter.discoverModels();

      // Assert
      expect(providers.length).toBe(1);
      expect(providers[0].name).toBe('Z.AI');
      expect(providers[0].configured).toBe(true);
      expect(providers[0].models.length).toBe(3);
    });

    it('should return models from Anthropic provider', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(mockSettingsWithAnthropic);

      // Act
      const providers = await adapter.discoverModels();

      // Assert
      expect(providers.length).toBe(1);
      expect(providers[0].name).toBe('Anthropic');
      expect(providers[0].configured).toBe(true);
    });

    it('should mark provider as configured when auth token is present', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(mockSettingsWithZAI);

      // Act
      const providers = await adapter.discoverModels();

      // Assert
      expect(providers[0].configured).toBe(true);
    });

    it('should mark provider as not configured when auth token is missing', async () => {
      // Arrange
      const settingsWithoutToken = JSON.stringify({
        env: {
          ANTHROPIC_BASE_URL: 'https://api.z.ai',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-20250514',
        },
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(settingsWithoutToken);

      // Act
      const providers = await adapter.discoverModels();

      // Assert
      expect(providers[0].configured).toBe(false);
    });

    it('should return empty array when settings.json does not exist', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      const providers = await adapter.discoverModels();

      // Assert
      expect(providers).toEqual([]);
    });

    it('should return empty array when settings.json is invalid JSON', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('not valid json');

      // Act
      const providers = await adapter.discoverModels();

      // Assert
      expect(providers).toEqual([]);
    });

    it('should return empty array when no models are configured', async () => {
      // Arrange
      const settingsNoModels = JSON.stringify({
        env: {
          ANTHROPIC_AUTH_TOKEN: 'test-token',
        },
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(settingsNoModels);

      // Act
      const providers = await adapter.discoverModels();

      // Assert
      expect(providers).toEqual([]);
    });

    it('should create model objects with correct structure', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(mockSettingsWithZAI);

      // Act
      const providers = await adapter.discoverModels();

      // Assert
      const model = providers[0].models[0];
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('agent', 'claude');
      expect(model.name).toBe('claude-opus-4-20250514');
    });

    it('should normalize provider ID correctly', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(mockSettingsWithZAI);

      // Act
      const providers = await adapter.discoverModels();

      // Assert
      // Z.AI becomes "zai" (lowercase, dot removed)
      expect(providers[0].id).toBe('zai');
    });
  });

  describe('getDefaultModel()', () => {
    it('should return default model from settings.json', () => {
      // Arrange
      const settingsWithDefault = JSON.stringify({
        model: 'claude-sonnet-4-20250514',
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(settingsWithDefault);

      // Act
      const defaultModel = adapter.getDefaultModel();

      // Assert
      expect(defaultModel).toBe('claude-sonnet-4-20250514');
    });

    it('should return undefined when settings.json does not exist', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);

      // Act
      const defaultModel = adapter.getDefaultModel();

      // Assert
      expect(defaultModel).toBeUndefined();
    });

    it('should return undefined when settings.json has no default model', () => {
      // Arrange
      const settingsNoDefault = JSON.stringify({
        env: {
          ANTHROPIC_AUTH_TOKEN: 'test-token',
        },
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(settingsNoDefault);

      // Act
      const defaultModel = adapter.getDefaultModel();

      // Assert
      expect(defaultModel).toBeUndefined();
    });

    it('should return undefined when settings.json is invalid JSON', () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('not valid json');

      // Act
      const defaultModel = adapter.getDefaultModel();

      // Assert
      expect(defaultModel).toBeUndefined();
    });
  });
});
