/**
 * Tests for OpenCode Agent Adapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpenCodeAdapter, createOpenCodeAdapter } from '../src/web/agent-adapters/opencode-adapter.js';
import { AdapterRegistry } from '../src/web/agent-adapters/mod.js';

describe('OpenCodeAdapter', () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    adapter = new OpenCodeAdapter('test-session');
  });

  describe('supports', () => {
    it('should support opencode agent type', () => {
      expect(adapter.supports('opencode')).toBe(true);
      expect(adapter.supports('OpenCode')).toBe(true);
      expect(adapter.supports('OPENCODE')).toBe(true);
    });

    it('should not support other agent types', () => {
      expect(adapter.supports('claude')).toBe(false);
      expect(adapter.supports('gemini')).toBe(false);
      expect(adapter.supports('aider')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse step_start event', () => {
      const input = JSON.stringify({
        type: 'step_start',
        timestamp: 1767036059338,
        sessionID: 'ses_123',
        part: {
          id: 'prt_abc',
          sessionID: 'ses_123',
          messageID: 'msg_xyz',
          type: 'step-start',
          snapshot: '71db24a798b347669c0ebadb2dfad238f991753d'
        }
      }) + '\n';

      const events = adapter.parse(input);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('STEP_STARTED');
      expect(events[0].runId).toBe('ses_123');
    });

    it('should parse tool_use event for Edit', () => {
      const input = JSON.stringify({
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
            metadata: { exit: 0 },
            time: { start: 1767036061123, end: 1767036061173 }
          }
        }
      }) + '\n';

      const events = adapter.parse(input);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_START');
      expect(events[0].toolName).toBe('Edit');
      expect(events[0].toolCallId).toBe('call_123');
    });

    it('should parse tool_use with pending_approval status', () => {
      const input = JSON.stringify({
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

      const events = adapter.parse(input);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_START');
      expect(events[0].input).toHaveProperty('_pendingApproval', true);
    });

    it('should parse text event', () => {
      const input = JSON.stringify({
        type: 'text',
        timestamp: 1767036064268,
        sessionID: 'ses_123',
        part: {
          id: 'prt_ghi',
          sessionID: 'ses_123',
          messageID: 'msg_xyz',
          type: 'text',
          text: 'Hello, I will help you with this task.',
          time: { start: 1767036064265, end: 1767036064265 }
        }
      }) + '\n';

      const events = adapter.parse(input);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEXT_MESSAGE_CONTENT');
      expect(events[0].delta).toBe('Hello, I will help you with this task.');
    });

    it('should parse step_finish event', () => {
      const input = JSON.stringify({
        type: 'step_finish',
        timestamp: 1767036064273,
        sessionID: 'ses_123',
        part: {
          id: 'prt_jkl',
          sessionID: 'ses_123',
          messageID: 'msg_xyz',
          type: 'step-finish',
          reason: 'stop',
          snapshot: '09dd05d11a4ac013136c1df10932efc0ad9116e8',
          cost: 0.001,
          tokens: {
            input: 671,
            output: 8,
            reasoning: 0,
            cache: { read: 21415, write: 0 }
          }
        }
      }) + '\n';

      const events = adapter.parse(input);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('STEP_FINISHED');
    });

    it('should parse error event', () => {
      const input = JSON.stringify({
        type: 'error',
        timestamp: 1767036065000,
        sessionID: 'ses_123',
        error: {
          name: 'APIError',
          data: {
            message: 'Rate limit exceeded',
            statusCode: 429,
            isRetryable: true
          }
        }
      }) + '\n';

      const events = adapter.parse(input);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RUN_ERROR');
      expect(events[0].error.message).toBe('Rate limit exceeded');
    });

    it('should handle multiple events in one chunk', () => {
      const input = 
        '{"type":"step_start","timestamp":1,"sessionID":"s1","part":{"id":"p1","sessionID":"s1","messageID":"m1","type":"step-start","snapshot":"abc"}}\n' +
        '{"type":"text","timestamp":2,"sessionID":"s1","part":{"id":"p2","sessionID":"s1","messageID":"m1","type":"text","text":"hello"}}\n';

      const events = adapter.parse(input);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('STEP_STARTED');
      expect(events[1].type).toBe('TEXT_MESSAGE_CONTENT');
    });

    it('should handle incomplete JSON in buffer', () => {
      const input = '{"type":"step_start","timestamp":1';

      const events = adapter.parse(input);

      expect(events).toHaveLength(0);
      expect(adapter.getBuffer()).toBe(input);
    });

    it('should emit raw event for non-JSON input', () => {
      const input = 'This is not JSON output\n';

      const events = adapter.parse(input);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RAW');
    });
  });

  describe('mapToActivityEvents', () => {
    it('should map Edit tool to file_edited', () => {
      const input = JSON.stringify({
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

      const events = adapter.parse(input);
      const activityEvents = adapter.mapToActivityEvents(events, 'test-session');

      expect(activityEvents).toHaveLength(1);
      expect(activityEvents[0].type).toBe('file_edited');
      expect(activityEvents[0].icon).toBe('✏️');
      expect(activityEvents[0].details?.filePath).toBe('src/main.ts');
    });

    it('should map Bash to command_run', () => {
      const input = JSON.stringify({
        type: 'tool_use',
        timestamp: 1767036061199,
        sessionID: 'ses_123',
        part: {
          id: 'prt_def',
          sessionID: 'ses_123',
          messageID: 'msg_xyz',
          type: 'tool',
          callID: 'call_123',
          tool: 'Bash',
          state: {
            status: 'completed',
            input: { command: 'npm test' },
            output: 'Tests passed',
          }
        }
      }) + '\n';

      const events = adapter.parse(input);
      const activityEvents = adapter.mapToActivityEvents(events, 'test-session');

      expect(activityEvents).toHaveLength(1);
      expect(activityEvents[0].type).toBe('command_run');
      expect(activityEvents[0].icon).toBe('⚡');
      expect(activityEvents[0].details?.command).toBe('npm test');
    });

    it('should map pending_approval Bash to approval_needed', () => {
      const input = JSON.stringify({
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

      const events = adapter.parse(input);
      const activityEvents = adapter.mapToActivityEvents(events, 'test-session');

      expect(activityEvents).toHaveLength(1);
      expect(activityEvents[0].type).toBe('approval_needed');
      expect(activityEvents[0].actionable).toBe(true);
    });
  });

  describe('parseAndMap', () => {
    it('should parse and map in one step', () => {
      const input = JSON.stringify({
        type: 'text',
        timestamp: 1767036064268,
        sessionID: 'ses_123',
        part: {
          id: 'prt_ghi',
          sessionID: 'ses_123',
          messageID: 'msg_xyz',
          type: 'text',
          text: 'Hello world',
        }
      }) + '\n';

      const activityEvents = adapter.parseAndMap(input, 'my-session');

      expect(activityEvents).toHaveLength(1);
      expect(activityEvents[0].type).toBe('agent_message');
      expect(activityEvents[0].sessionName).toBe('my-session');
    });
  });

  describe('reset', () => {
    it('should reset parser state', () => {
      const input = '{"type":"text","timestamp":1,"sessionID":"s1","part":{"id":"p1","sessionID":"s1","messageID":"m1","type":"text","text":"a"}}\n';
      adapter.parse(input);

      adapter.reset('new-session');

      expect(adapter.getBuffer()).toBe('');
    });
  });
});

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('register and get', () => {
    it('should register and retrieve adapter', () => {
      const adapter = new OpenCodeAdapter();
      registry.register(adapter);

      expect(registry.get('opencode')).toBe(adapter);
    });

    it('should return null for unknown agent type', () => {
      expect(registry.get('unknown')).toBe(null);
    });
  });

  describe('has', () => {
    it('should return true for registered adapter', () => {
      registry.register(new OpenCodeAdapter());

      expect(registry.has('opencode')).toBe(true);
    });

    it('should return false for unknown agent type', () => {
      expect(registry.has('claude')).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all registered adapters', () => {
      registry.register(new OpenCodeAdapter());

      expect(registry.list()).toEqual(['opencode']);
    });
  });
});

describe('createOpenCodeAdapter', () => {
  it('should create adapter with custom session ID', () => {
    const adapter = createOpenCodeAdapter('custom-session');

    expect(adapter.supports('opencode')).toBe(true);
  });
});
