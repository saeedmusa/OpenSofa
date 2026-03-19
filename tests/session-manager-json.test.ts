/**
 * Tests for JSON Stream Integration
 * 
 * These tests verify the full workflow from agent-registry
 * to event parsing and mapping.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../src/agent-registry.js';
import { OpenCodeAdapter } from '../src/web/agent-adapters/opencode-adapter.js';

describe('JSON Stream Integration', () => {
  let registry: AgentRegistry;
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    registry = new AgentRegistry();
    adapter = new OpenCodeAdapter('test-session');
  });

  describe('AgentRegistry JSON support detection', () => {
    it('should detect agents that support JSON output', () => {
      expect(registry.supportsJsonOutput('opencode')).toBe(true);
      expect(registry.supportsJsonOutput('claude')).toBe(true);
      expect(registry.supportsJsonOutput('aider')).toBe(true);
    });

    it('should detect agents that do not support JSON output', () => {
      expect(registry.supportsJsonOutput('codex')).toBe(false);
    });

    it('should get JSON output flags for supported agents', () => {
      const opencodeFlags = registry.getJsonOutputFlags('opencode');
      expect(opencodeFlags).toEqual(['run', '--format', 'json']);

      const claudeFlags = registry.getJsonOutputFlags('claude');
      expect(claudeFlags).toEqual(['--print', '--output-format=stream-json', '--verbose']);

      const aiderFlags = registry.getJsonOutputFlags('aider');
      expect(aiderFlags).toEqual(['--json']);
    });

    it('should return null for unsupported agents', () => {
      expect(registry.getJsonOutputFlags('codex')).toBeNull();
    });
  });

  describe('buildDirectSpawnArgs', () => {
    it('should build direct spawn args for OpenCode', () => {
      const result = registry.buildDirectSpawnArgs('opencode', '/workspace');
      
      expect(result.command).toBe('opencode');
      expect(result.args).toContain('run');
      expect(result.args).toContain('--format');
      expect(result.args).toContain('json');
      expect(result.args).toContain('--continue');
    });

    it('should throw for unsupported agents', () => {
      expect(() => {
        registry.buildDirectSpawnArgs('codex', '/workspace');
      }).toThrow('JSON output not supported for agent: codex');
    });
  });

  describe('buildSpawnArgs with jsonStream option', () => {
    it('should return direct args when jsonStream is true for supported agent', () => {
      const result = registry.buildSpawnArgs('opencode', 3456, undefined, 120, 36, { jsonStream: true });
      
      expect(result.direct).toBe(true);
      expect(result.args).toContain('run');
      expect(result.args).toContain('--format');
      expect(result.args).toContain('json');
    });

    it('should return AgentAPI args when jsonStream is false', () => {
      const result = registry.buildSpawnArgs('opencode', 3456, undefined, 120, 36, { jsonStream: false });
      
      expect(result.direct).toBeUndefined();
      expect(result.args).toContain('server');
      expect(result.args).toContain('--port=3456');
    });

    it('should return AgentAPI args when jsonStream is undefined (default)', () => {
      const result = registry.buildSpawnArgs('opencode', 3456);
      
      expect(result.direct).toBeUndefined();
      expect(result.args).toContain('server');
    });

    it('should fall back to AgentAPI for unsupported agents even with jsonStream true', () => {
      const result = registry.buildSpawnArgs('codex', 3456, undefined, 120, 36, { jsonStream: true });
      
      expect(result.direct).toBeUndefined();
      expect(result.args).toContain('server');
    });
  });

  describe('OpenCode Adapter parse and map workflow', () => {
    it('should parse JSONL from OpenCode and map to ActivityEvents', () => {
      const jsonlInput = JSON.stringify({
        type: 'tool_use',
        timestamp: 1767036061199,
        sessionID: 'ses_123',
        part: {
          id: 'prt_def',
          sessionID: 'ses_123',
          messageID: 'msg_xyz',
          type: 'tool',
          callID: 'call_123',
          tool: 'Edit',
          state: {
            status: 'completed',
            input: { file_path: 'src/main.ts', old_string: 'foo', new_string: 'bar' },
            output: 'File updated',
            title: 'Edit src/main.ts',
          }
        }
      }) + '\n';

      const activityEvents = adapter.parseAndMap(jsonlInput, 'my-session');

      expect(activityEvents).toHaveLength(1);
      expect(activityEvents[0].type).toBe('file_edited');
      expect(activityEvents[0].sessionName).toBe('my-session');
    });

    it('should detect approval events', () => {
      const jsonlInput = JSON.stringify({
        type: 'tool_use',
        timestamp: 1767036061199,
        sessionID: 'ses_123',
        part: {
          id: 'prt_def',
          sessionID: 'ses_123',
          messageID: 'msg_xyz',
          type: 'tool',
          callID: 'call_456',
          tool: 'Bash',
          state: {
            status: 'pending_approval',
            input: { command: 'rm -rf /' },
            title: 'Run: rm -rf /'
          }
        }
      }) + '\n';

      const events = adapter.parse(jsonlInput);
      const activityEvents = adapter.mapToActivityEvents(events, 'test');

      expect(activityEvents).toHaveLength(1);
      expect(activityEvents[0].type).toBe('approval_needed');
      expect(activityEvents[0].actionable).toBe(true);
    });
  });

  describe('End-to-end JSON stream scenario', () => {
    it('should support full workflow: agent spawn args -> parse -> map -> activity event', () => {
      // Step 1: Get spawn args from registry
      const reg = new AgentRegistry();
      const spawnArgs = reg.buildDirectSpawnArgs('opencode', '/workspace');
      
      expect(spawnArgs.command).toBe('opencode');
      expect(spawnArgs.args).toContain('--format');
      expect(spawnArgs.args).toContain('json');

      // Step 2: Use adapter to parse agent output
      const adp = new OpenCodeAdapter('session-1');
      const sampleOutput = JSON.stringify({
        type: 'tool_use',
        timestamp: Date.now(),
        sessionID: 'session-1',
        part: {
          id: 'prt_1',
          sessionID: 'session-1',
          messageID: 'msg_1',
          type: 'tool',
          callID: 'call_1',
          tool: 'Write',
          state: {
            status: 'completed',
            input: { file_path: 'test.ts', content: 'console.log("test")' },
            output: 'File created',
          }
        }
      }) + '\n';

      const events = adp.parse(sampleOutput);
      expect(events).toHaveLength(1);

      // Step 3: Map to ActivityEvent
      const activityEvents = adp.mapToActivityEvents(events, 'my-session');
      expect(activityEvents).toHaveLength(1);
      expect(activityEvents[0].type).toBe('file_created');
      expect(activityEvents[0].details?.filePath).toBe('test.ts');
    });
  });
});
