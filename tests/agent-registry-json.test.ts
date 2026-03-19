/**
 * Tests for Agent Registry JSON Flag Support
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../src/agent-registry.js';

describe('AgentRegistry JSON Flags', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('getJsonOutputFlags', () => {
    it('should return JSON flags for opencode', () => {
      const flags = registry.getJsonOutputFlags('opencode');
      
      expect(flags).toEqual(['run', '--format', 'json']);
    });

    it('should return JSON flags for claude', () => {
      const flags = registry.getJsonOutputFlags('claude');
      
      expect(flags).toEqual(['--print', '--output-format=stream-json', '--verbose']);
    });

    it('should return JSON flags for aider', () => {
      const flags = registry.getJsonOutputFlags('aider');
      
      expect(flags).toEqual(['--json']);
    });

    it('should return null for unsupported agents', () => {
      const flags = registry.getJsonOutputFlags('codex');
      
      expect(flags).toBeNull();
    });

    it('should return null for unknown types', () => {
      const flags = registry.getJsonOutputFlags('unknown' as any);
      
      expect(flags).toBeNull();
    });
  });

  describe('supportsJsonOutput', () => {
    it('should return true for opencode', () => {
      expect(registry.supportsJsonOutput('opencode')).toBe(true);
    });

    it('should return true for claude', () => {
      expect(registry.supportsJsonOutput('claude')).toBe(true);
    });

    it('should return true for aider', () => {
      expect(registry.supportsJsonOutput('aider')).toBe(true);
    });

    it('should return false for codex', () => {
      expect(registry.supportsJsonOutput('codex')).toBe(false);
    });
  });

  describe('buildDirectSpawnArgs', () => {
    it('should build direct spawn args for opencode', () => {
      const result = registry.buildDirectSpawnArgs('opencode', '/workspace');
      
      expect(result.command).toBe('opencode');
      expect(result.args).toEqual(['run', '--format', 'json', '--continue']);
      expect(result.env).toEqual({});
    });

    it('should build direct spawn args for claude with model', () => {
      const result = registry.buildDirectSpawnArgs('claude', '/workspace', 'opus');
      
      expect(result.command).toBe('claude');
      expect(result.args).toContain('--model');
      expect(result.args).toContain('opus');
    });

    it('should build direct spawn args for aider', () => {
      const result = registry.buildDirectSpawnArgs('aider', '/workspace');
      
      expect(result.command).toBe('aider');
      expect(result.args).toContain('--json');
    });

    it('should throw for unsupported agents', () => {
      expect(() => {
        registry.buildDirectSpawnArgs('codex', '/workspace');
      }).toThrow('JSON output not supported for agent: codex');
    });
  });

  describe('buildSpawnArgs with jsonStream option', () => {
    it('should return direct spawn args when jsonStream is true', () => {
      const result = registry.buildSpawnArgs('opencode', 3456, undefined, 120, 36, { jsonStream: true });
      
      // Should return args for direct spawn, not AgentAPI
      expect(result.args).toContain('run');
      expect(result.args).toContain('--format');
      expect(result.args).toContain('json');
    });

    it('should return AgentAPI args when jsonStream is false', () => {
      const result = registry.buildSpawnArgs('opencode', 3456, undefined, 120, 36, { jsonStream: false });
      
      // Should return AgentAPI style args
      expect(result.args).toContain('server');
      expect(result.args).toContain('--port=3456');
    });

    it('should return AgentAPI args when jsonStream is undefined', () => {
      const result = registry.buildSpawnArgs('opencode', 3456);
      
      // Should return AgentAPI style args (default)
      expect(result.args).toContain('server');
      expect(result.args).toContain('--port=3456');
    });
  });
});
