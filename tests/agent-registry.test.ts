/**
 * Tests for Agent Registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from '../src/agent-registry.js';
import { execFileSync, execSync } from 'child_process';

vi.mock('child_process');

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    registry = new AgentRegistry();
  });

  describe('getDefinition()', () => {
    it('should return definition for claude', () => {
      const def = registry.getDefinition('claude');
      expect(def).toBeDefined();
      expect(def!.type).toBe('claude');
      expect(def!.displayName).toBe('Claude Code');
    });

    it('should return definition for aider', () => {
      const def = registry.getDefinition('aider');
      expect(def).toBeDefined();
      expect(def!.type).toBe('aider');
    });

    it('should return definition for opencode', () => {
      const def = registry.getDefinition('opencode');
      expect(def).toBeDefined();
      expect(def!.type).toBe('opencode');
    });

    it('should return definition for gemini', () => {
      const def = registry.getDefinition('gemini');
      expect(def).toBeDefined();
      expect(def!.type).toBe('gemini');
    });

    it('should return definition for codex', () => {
      const def = registry.getDefinition('codex');
      expect(def).toBeDefined();
    });

    it('should return definition for goose', () => {
      const def = registry.getDefinition('goose');
      expect(def).toBeDefined();
    });

    it('should return definition for unknown agent', () => {
      const def = registry.getDefinition('invalid' as any);
      expect(def).toBeUndefined();
    });
  });

  describe('isInstalled()', () => {
    it('should return true when which command finds binary', () => {
      // Mock execFileSync to return successfully (binary found)
      vi.mocked(execFileSync).mockReturnValue(Buffer.from(''));
      expect(registry.isInstalled('claude')).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith(
        'which',
        expect.arrayContaining(['claude']),
        expect.any(Object)
      );
    });

    it('should return false when which command throws', () => {
      // Mock execFileSync to throw (binary not found)
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('Command not found');
      });
      expect(registry.isInstalled('claude')).toBe(false);
    });
  });

  describe('discoverInstalled()', () => {
    it('should return installed agents based on which command', () => {
      // Mock to return success for claude, failure for others
      vi.mocked(execFileSync).mockImplementation((cmd: string, args?: readonly string[]) => {
        if (cmd === 'which' && args && args.includes('claude')) {
          return Buffer.from('');
        }
        throw new Error('Not found');
      });
      
      const installed = registry.discoverInstalled();
      expect(installed).toContain('claude');
    });

    it('should return empty array when nothing found', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('Not found');
      });
      
      const installed = registry.discoverInstalled();
      expect(installed).toEqual([]);
    });
  });

  describe('buildSpawnArgs()', () => {
    it('should build args with port', () => {
      const { args } = registry.buildSpawnArgs('claude', 3284);
      expect(args).toContain('server');
      expect(args).toContain('--port=3284');
    });

    it('should build args with type', () => {
      const { args } = registry.buildSpawnArgs('claude', 3284);
      expect(args).toContain('--type=claude');
    });

    it('should include terminal dimensions', () => {
      const { args } = registry.buildSpawnArgs('claude', 3284);
      expect(args.some(a => a.includes('--term-width'))).toBe(true);
      expect(args.some(a => a.includes('--term-height'))).toBe(true);
    });

    it('should use responsive terminal dimensions', () => {
      const { args } = registry.buildSpawnArgs('claude', 3284, undefined, 100, 30);
      expect(args).toContain('--term-width=100');
      expect(args).toContain('--term-height=30');
    });

    it('should include model flag when model provided', () => {
      const { args } = registry.buildSpawnArgs('claude', 3284, 'sonnet');
      expect(args).toContain('sonnet');
    });

    it('should return env vars for model when no flag', () => {
      const { env } = registry.buildSpawnArgs('aider', 3284, 'gpt-4');
      // Aider uses env vars for model
      expect(env).toBeDefined();
    });

    it('should throw for unknown agent', () => {
      expect(() => registry.buildSpawnArgs('invalid' as any, 3284)).toThrow();
    });
  });

  describe('isValidType()', () => {
    it('should return true for valid types', () => {
      expect(registry.isValidType('claude')).toBe(true);
      expect(registry.isValidType('aider')).toBe(true);
      expect(registry.isValidType('opencode')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(registry.isValidType('invalid')).toBe(false);
      expect(registry.isValidType('')).toBe(false);
    });
  });

  describe('formatAgentList()', () => {
    it('should format list with installed status', () => {
      // Mock isInstalled to return true for claude
      vi.mocked(execFileSync).mockReturnValue(Buffer.from(''));
      
      const list = registry.formatAgentList();
      expect(list).toContain('Claude');
      expect(list).toContain('✅');
    });

    it('should show not installed with ⬚', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('Not found');
      });
      
      const list = registry.formatAgentList();
      expect(list).toContain('⬚');
    });
  });

  describe('getAllDefinitions()', () => {
    it('should return all agent definitions', () => {
      const defs = registry.getAllDefinitions();
      expect(defs.length).toBeGreaterThan(0);
    });

    it('should include required fields in each definition', () => {
      const defs = registry.getAllDefinitions();
      for (const def of defs) {
        expect(def.type).toBeDefined();
        expect(def.displayName).toBeDefined();
        expect(def.binary).toBeDefined();
      }
    });
  });

  describe('logDiscovery()', () => {
    it('should not throw when logging', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('Not found');
      });
      
      expect(() => registry.logDiscovery()).not.toThrow();
    });
  });
});
