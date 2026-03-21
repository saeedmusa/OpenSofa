/**
 * Tests for API Key Discovery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { discoverAPIKeys } from '../src/discovery/key-discovery.js';

describe('KeyDiscovery', () => {
  beforeEach(() => {
    // Clear relevant env vars
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  it('should return all known key statuses', () => {
    const keys = discoverAPIKeys();
    expect(keys.length).toBeGreaterThanOrEqual(6);
    expect(keys.every(k => typeof k.name === 'string')).toBe(true);
    expect(keys.every(k => typeof k.configured === 'boolean')).toBe(true);
  });

  it('should detect configured keys', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';
    process.env.OPENAI_API_KEY = 'sk-test456';

    const keys = discoverAPIKeys();
    const anthropicKey = keys.find(k => k.name === 'ANTHROPIC_API_KEY');
    const openaiKey = keys.find(k => k.name === 'OPENAI_API_KEY');
    const geminiKey = keys.find(k => k.name === 'GEMINI_API_KEY');

    expect(anthropicKey?.configured).toBe(true);
    expect(openaiKey?.configured).toBe(true);
    expect(geminiKey?.configured).toBe(false);
  });

  it('should NEVER expose key values', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-secret-value';

    const keys = discoverAPIKeys();
    const json = JSON.stringify(keys);

    expect(json).not.toContain('sk-ant-secret-value');
    expect(json).not.toContain('secret');
  });

  it('should include display names and agent info', () => {
    const keys = discoverAPIKeys();
    const anthropicKey = keys.find(k => k.name === 'ANTHROPIC_API_KEY');

    expect(anthropicKey?.displayName).toBe('Anthropic API Key');
    expect(anthropicKey?.agent).toBe('Claude Code');
  });

  it('should handle empty env vars as not configured', () => {
    process.env.ANTHROPIC_API_KEY = '';

    const keys = discoverAPIKeys();
    const anthropicKey = keys.find(k => k.name === 'ANTHROPIC_API_KEY');

    expect(anthropicKey?.configured).toBe(false);
  });
});
