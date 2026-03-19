/**
 * Tests for All Agent Adapters
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpenCodeAdapter } from '../src/web/agent-adapters/opencode-adapter.js';
import { ClaudeAdapter } from '../src/web/agent-adapters/claude-adapter.js';
import { AiderAdapter } from '../src/web/agent-adapters/aider-adapter.js';
import { AdapterRegistry, globalAdapterRegistry } from '../src/web/agent-adapters/mod.js';
import type { AGUIEvent } from '../src/web/ag-ui-events.js';

describe('Agent Adapters', () => {
  describe('OpenCodeAdapter', () => {
    let adapter: OpenCodeAdapter;

    beforeEach(() => {
      adapter = new OpenCodeAdapter('test-session');
    });

    it('should support opencode agent type', () => {
      expect(adapter.supports('opencode')).toBe(true);
    });

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
          snapshot: 'abc' 
        }
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('STEP_STARTED');
    });

    it('should parse tool_use event', () => {
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
            input: { file_path: 'src/main.ts' },
            output: 'File updated',
            title: 'Edit src/main.ts'
          }
        }
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      const event = events[0] as AGUIEvent & { toolName?: string };
      expect(event.type).toBe('TOOL_CALL_START');
      expect(event.toolName).toBe('Edit');
    });

    it('should parse pending_approval event', () => {
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
      const event = events[0] as AGUIEvent & { input?: Record<string, unknown> };
      expect(event.input).toHaveProperty('_pendingApproval');
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
          text: 'Hello world'
        }
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEXT_MESSAGE_CONTENT');
    });

    it('should parse error event', () => {
      const input = JSON.stringify({
        type: 'error',
        timestamp: 1767036065000,
        sessionID: 'ses_123',
        error: {
          name: 'APIError',
          data: { message: 'Rate limit exceeded', statusCode: 429 }
        }
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RUN_ERROR');
    });
  });

  describe('ClaudeAdapter', () => {
    let adapter: ClaudeAdapter;

    beforeEach(() => {
      adapter = new ClaudeAdapter('test-session');
    });

    it('should support claude agent type', () => {
      expect(adapter.supports('claude')).toBe(true);
      expect(adapter.supports('Claude')).toBe(true);
    });

    it('should not support other agents', () => {
      expect(adapter.supports('opencode')).toBe(false);
      expect(adapter.supports('aider')).toBe(false);
    });

    it('should parse message_start event', () => {
      const input = JSON.stringify({
        type: 'message_start',
        message: {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-sonnet-4-20250514',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 0 }
        }
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RUN_STARTED');
    });

    it('should parse message_delta event', () => {
      const input = JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null, usage: { output_tokens: 50 } },
        usage: { output_tokens: 50 }
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RUN_FINISHED');
    });

    it('should parse tool_use start event', () => {
      const input = JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'tool_use',
          id: 'tool_123',
          name: 'Read',
          input: { file_path: 'src/main.ts' }
        }
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_START');
      const event = events[0] as AGUIEvent & { toolName?: string; toolCallId?: string };
      expect(event.toolName).toBe('Read');
      expect(event.toolCallId).toBe('tool_123');
    });

    it('should parse text_delta event', () => {
      const input = JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello world' }
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEXT_MESSAGE_CONTENT');
      const event = events[0] as AGUIEvent & { delta?: string };
      expect(event.delta).toBe('Hello world');
    });
  });

  describe('AiderAdapter', () => {
    let adapter: AiderAdapter;

    beforeEach(() => {
      adapter = new AiderAdapter('test-session');
    });

    it('should support aider agent type', () => {
      expect(adapter.supports('aider')).toBe(true);
      expect(adapter.supports('Aider')).toBe(true);
    });

    it('should not support other agents', () => {
      expect(adapter.supports('opencode')).toBe(false);
      expect(adapter.supports('claude')).toBe(false);
    });

    it('should parse init event', () => {
      const input = JSON.stringify({
        type: 'init',
        model: 'sonnet',
        editor_model: 'sonnet',
        io_mode: 'plain'
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RUN_STARTED');
    });

    it('should parse chat_done event', () => {
      const input = JSON.stringify({
        type: 'chat_done',
        total_cost: 0.01,
        tokens_in: 100,
        tokens_out: 50,
        duration: 5.5
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RUN_FINISHED');
    });

    it('should parse tool_calls event', () => {
      const input = JSON.stringify({
        type: 'tool_calls',
        tool_name: 'Read',
        tool_input: { file_path: 'src/main.ts' },
        tool_call_id: 'call_123'
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_START');
      const event = events[0] as AGUIEvent & { toolName?: string };
      expect(event.toolName).toBe('Read');
    });

    it('should parse tool_result event', () => {
      const input = JSON.stringify({
        type: 'tool_result',
        tool_name: 'Read',
        tool_call_id: 'call_123',
        output: 'file content here'
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_RESULT');
    });

    it('should parse file_edited event', () => {
      const input = JSON.stringify({
        type: 'file_edited',
        file: 'src/main.ts',
        diff: '--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1,1 +1,2 @@\n+new line'
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_START');
      const event = events[0] as AGUIEvent & { toolName?: string };
      expect(event.toolName).toBe('Edit');
    });

    it('should parse file_created event', () => {
      const input = JSON.stringify({
        type: 'file_created',
        file: 'src/new.ts'
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_START');
      const event = events[0] as AGUIEvent & { toolName?: string };
      expect(event.toolName).toBe('Write');
    });

    it('should parse file_deleted event', () => {
      const input = JSON.stringify({
        type: 'file_deleted',
        file: 'src/old.ts'
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_START');
      const event = events[0] as AGUIEvent & { toolName?: string };
      expect(event.toolName).toBe('Delete');
    });

    it('should parse error event', () => {
      const input = JSON.stringify({
        type: 'error',
        message: 'Something went wrong',
        traceback: 'Error trace'
      }) + '\n';

      const events = adapter.parse(input);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RUN_ERROR');
      const event = events[0] as AGUIEvent & { error?: { message?: string } };
      expect(event.error?.message).toBe('Something went wrong');
    });
  });

  describe('AdapterRegistry', () => {
    let registry: AdapterRegistry;

    beforeEach(() => {
      registry = new AdapterRegistry();
    });

    it('should register and retrieve adapters', () => {
      registry.register(new OpenCodeAdapter());
      registry.register(new ClaudeAdapter());
      registry.register(new AiderAdapter());

      expect(registry.get('opencode')).toBeDefined();
      expect(registry.get('claude')).toBeDefined();
      expect(registry.get('aider')).toBeDefined();
    });

    it('should list all registered adapters', () => {
      registry.register(new OpenCodeAdapter());
      registry.register(new ClaudeAdapter());

      const list = registry.list();
      expect(list).toContain('opencode');
      expect(list).toContain('claude');
    });

    it('should return null for unknown agents', () => {
      expect(registry.get('unknown')).toBeNull();
    });

    it('should check if adapter exists', () => {
      registry.register(new OpenCodeAdapter());

      expect(registry.has('opencode')).toBe(true);
      expect(registry.has('claude')).toBe(false);
    });
  });

  describe('Global Registry', () => {
    it('should have adapters registered', () => {
      expect(globalAdapterRegistry.has('opencode')).toBe(true);
      expect(globalAdapterRegistry.has('claude')).toBe(true);
      expect(globalAdapterRegistry.has('aider')).toBe(true);
    });

    it('should retrieve correct adapters', () => {
      const opencodeAdapter = globalAdapterRegistry.get('opencode');
      expect(opencodeAdapter).toBeDefined();
      expect(opencodeAdapter?.supports('opencode')).toBe(true);

      const claudeAdapter = globalAdapterRegistry.get('claude');
      expect(claudeAdapter).toBeDefined();
      expect(claudeAdapter?.supports('claude')).toBe(true);

      const aiderAdapter = globalAdapterRegistry.get('aider');
      expect(aiderAdapter).toBeDefined();
      expect(aiderAdapter?.supports('aider')).toBe(true);
    });
  });
});
