/**
 * Tests for Aider, Gemini, Goose, and Codex Model Adapters
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { execFileSync } from 'child_process';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(() => { throw new Error('not found'); }),
  execFile: vi.fn((_cmd, _args, _opts, callback) => {
    const cb = typeof _opts === 'function' ? _opts : callback;
    if (cb) setTimeout(() => cb(null, { stdout: '', stderr: '' }), 0);
  }),
}));
vi.mock('fs');
vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
}));
vi.mock('../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
vi.mock('../../src/utils/expand-path.js', () => ({
  getEnrichedPath: vi.fn().mockReturnValue('/usr/local/bin:/usr/bin:/bin'),
  getEnrichedEnv: vi.fn().mockReturnValue({ ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' }),
}));

import { AiderAdapter } from '../../src/model-adapters/aider-adapter.js';
import { GeminiAdapter } from '../../src/model-adapters/gemini-adapter.js';
import { GooseAdapter } from '../../src/model-adapters/goose-adapter.js';
import { CodexAdapter } from '../../src/model-adapters/codex-adapter.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockHomedir = vi.mocked(homedir);

describe('AiderAdapter', () => {
  let adapter: AiderAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue('/home/testuser');
    adapter = new AiderAdapter();
  });

  it('should have correct agent type', () => {
    expect(adapter.agent).toBe('aider');
    expect(adapter.name).toBe('Aider');
  });

  it('should detect availability when config exists', () => {
    mockExistsSync.mockReturnValue(true);
    expect(adapter.isAvailable()).toBe(true);
  });

  it('should return false when config missing and binary not found', () => {
    mockExistsSync.mockReturnValue(false);
    expect(adapter.isAvailable()).toBe(false);
  });

  it('should discover model from config', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('model: gpt-4o\n');

    const providers = await adapter.discoverModels();

    expect(providers).toHaveLength(1);
    expect(providers[0].models[0].id).toBe('gpt-4o');
    expect(providers[0].name).toBe('OpenAI');
  });

  it('should return empty when no model configured', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('# empty config\n');

    const providers = await adapter.discoverModels();
    expect(providers).toHaveLength(0);
  });

  it('should return empty when config missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const providers = await adapter.discoverModels();
    expect(providers).toHaveLength(0);
  });

  it('should detect Anthropic provider from model name', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('model: claude-sonnet-4-20250514\n');

    const providers = await adapter.discoverModels();
    expect(providers[0].name).toBe('Anthropic');
  });
});

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GEMINI_MODEL;
    adapter = new GeminiAdapter();
  });

  it('should have correct agent type', () => {
    expect(adapter.agent).toBe('gemini');
    expect(adapter.name).toBe('Gemini');
  });

  it('should detect availability when config exists', () => {
    mockExistsSync.mockReturnValue(true);
    expect(adapter.isAvailable()).toBe(true);
  });

  it('should detect availability when env var set', () => {
    mockExistsSync.mockReturnValue(false);
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    expect(adapter.isAvailable()).toBe(true);
  });

  it('should discover model from config', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"model": "gemini-2.0-pro"}');

    const providers = await adapter.discoverModels();

    expect(providers).toHaveLength(1);
    expect(providers[0].models[0].id).toBe('gemini-2.0-pro');
    expect(providers[0].name).toBe('Google');
  });

  it('should fall back to env var', async () => {
    mockExistsSync.mockReturnValue(false);
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';

    const providers = await adapter.discoverModels();

    expect(providers).toHaveLength(1);
    expect(providers[0].models[0].id).toBe('gemini-2.0-flash');
  });
});

describe('GooseAdapter', () => {
  let adapter: GooseAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GooseAdapter();
  });

  it('should have correct agent type', () => {
    expect(adapter.agent).toBe('goose');
    expect(adapter.name).toBe('Goose');
  });

  it('should discover models from profiles', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(`
default:
  provider: openai
  model: gpt-4o
anthropic:
  provider: anthropic
  model: claude-sonnet-4-20250514
`);

    const providers = await adapter.discoverModels();

    expect(providers).toHaveLength(2);
    expect(providers[0].models[0].id).toBe('gpt-4o');
    expect(providers[1].models[0].id).toBe('claude-sonnet-4-20250514');
  });

  it('should return empty when config missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const providers = await adapter.discoverModels();
    expect(providers).toHaveLength(0);
  });
});

describe('CodexAdapter', () => {
  let adapter: CodexAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new CodexAdapter();
  });

  it('should have correct agent type', () => {
    expect(adapter.agent).toBe('codex');
    expect(adapter.name).toBe('Codex');
  });

  it('should discover model from config', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('model: o4-mini\n');

    const providers = await adapter.discoverModels();

    expect(providers).toHaveLength(1);
    expect(providers[0].models[0].id).toBe('o4-mini');
    expect(providers[0].name).toBe('OpenAI');
  });

  it('should return empty when config missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const providers = await adapter.discoverModels();
    expect(providers).toHaveLength(0);
  });

  it('should get default model', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('model: o4-mini\n');
    expect(adapter.getDefaultModel()).toBe('o4-mini');
  });
});
