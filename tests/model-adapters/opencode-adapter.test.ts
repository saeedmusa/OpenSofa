/**
 * Tests for OpenCode Model Adapter
 * Task 07: Testing for Model Discovery
 * 
 * Note: Full integration testing of discoverModels() requires a working opencode binary
 * because the adapter uses execSync to call 'opencode auth list' and 'opencode models'.
 * Without the actual binary, we can only test the interface contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock child_process module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

// Mock expand-path utilities
vi.mock('../../src/utils/expand-path.js', () => ({
  getEnrichedEnv: vi.fn().mockReturnValue({ PATH: '/usr/local/bin:/usr/bin:/bin' }),
  getEnrichedPath: vi.fn().mockReturnValue('/usr/local/bin:/usr/bin:/bin'),
}));

// Mock the logger
vi.mock('../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Import after mocks
import { execSync, execFileSync } from 'child_process';
import { OpenCodeAdapter } from '../../src/model-adapters/opencode-adapter.js';

describe('OpenCodeAdapter', () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenCodeAdapter();
  });

  describe('agent', () => {
    it('should have correct agent type', () => {
      expect(adapter.agent).toBe('opencode');
    });
  });

  describe('name', () => {
    it('should have correct display name', () => {
      expect(adapter.name).toBe('OpenCode');
    });
  });

  describe('isAvailable()', () => {
    it('should return true when opencode binary is found', () => {
      vi.mocked(execFileSync).mockReturnValue(Buffer.from('/usr/local/bin/opencode'));

      const result = adapter.isAvailable();

      expect(result).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith(
        'which',
        ['opencode'],
        expect.objectContaining({ stdio: 'pipe' })
      );
    });

    it('should return false when opencode binary is not found', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = adapter.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('getDefaultModel()', () => {
    it('should return undefined (OpenCode manages its own default)', () => {
      expect(adapter.getDefaultModel()).toBeUndefined();
    });
  });

  describe('discoverModels()', () => {
    /**
     * Integration tests that verify the adapter correctly processes mock command output.
     * These test the parsing/filtering logic by providing mock execSync responses.
     */
    const mockAuthListOutput = `
● openrouter
● z.ai coding plan
  openai
`;

    const mockModelsOutput = `openrouter/anthropic/claude-sonnet-4-20250514
openrouter/anthropic/claude-opus-4-20250514
openrouter/google/gemini-2.5-pro
huggingface/zai-org/claude-sonnet-4
huggingface/zai-org/claude-opus-4
openai/gpt-4o
openai/o3
anthropic/claude-sonnet-4-20250514`;

    it('should return empty array when no providers configured', async () => {
      // Without ● marker, no providers are considered "configured"
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from('  openrouter\n  openai'))
        .mockReturnValueOnce(Buffer.from(mockModelsOutput));

      const providers = await adapter.discoverModels();

      expect(providers).toEqual([]);
    });

    it('should return empty array when opencode models command fails', async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from(mockAuthListOutput))
        .mockImplementationOnce(() => {
          throw new Error('Command failed');
        });

      const providers = await adapter.discoverModels();

      expect(providers).toEqual([]);
    });

    it('should return empty array when no models available', async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from(mockAuthListOutput))
        .mockReturnValueOnce(Buffer.from(''));

      const providers = await adapter.discoverModels();

      expect(providers).toEqual([]);
    });
  });
});