/**
 * Tests for AG-UI Event Parser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JsonlParser } from '../src/web/event-parser/jsonl-parser.js';
import { mapAGUIToActivityEvent, isApprovalEvent, extractCommandFromApproval } from '../src/web/event-parser/mapper.js';
import type { AGUIEvent, ToolCallStartEvent, TextMessageContentEvent, RunErrorEvent, StepStartedEvent } from '../src/web/ag-ui-events.js';

describe('JsonlParser', () => {
  let parser: JsonlParser;

  beforeEach(() => {
    parser = new JsonlParser();
  });

  describe('parsing OpenCode events', () => {
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
      });

      const events = parser.feed(input + '\n');
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('STEP_STARTED');
      const stepEvent = events[0] as StepStartedEvent;
      expect(stepEvent.stepId).toBe('prt_abc');
      expect(stepEvent.runId).toBe('ses_123');
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
      });

      const events = parser.feed(input + '\n');
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_START');
      const toolEvent = events[0] as ToolCallStartEvent;
      expect(toolEvent.toolName).toBe('Edit');
      expect(toolEvent.toolCallId).toBe('call_123');
      expect(toolEvent.input).toEqual({ file_path: 'src/main.ts', old_string: 'foo', new_string: 'bar' });
    });

    it('should parse tool_use event with pending_approval status', () => {
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
      });

      const events = parser.feed(input + '\n');
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TOOL_CALL_START');
      const toolEvent = events[0] as ToolCallStartEvent;
      expect(toolEvent.toolName).toBe('Bash');
      expect(toolEvent.input).toHaveProperty('_pendingApproval', true);
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
      });

      const events = parser.feed(input + '\n');
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEXT_MESSAGE_CONTENT');
      const textEvent = events[0] as TextMessageContentEvent;
      expect(textEvent.delta).toBe('Hello, I will help you with this task.');
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
      });

      const events = parser.feed(input + '\n');
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('STEP_FINISHED');
      const stepEvent = events[0] as StepStartedEvent;
      expect(stepEvent.stepId).toBe('prt_jkl');
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
      });

      const events = parser.feed(input + '\n');
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RUN_ERROR');
      const errorEvent = events[0] as RunErrorEvent;
      expect(errorEvent.error.name).toBe('APIError');
      expect(errorEvent.error.message).toBe('Rate limit exceeded');
    });
  });

  describe('buffer handling', () => {
    it('should handle multiple events in one chunk', () => {
      const input = 
        '{"type":"step_start","timestamp":1,"sessionID":"s1","part":{"id":"p1","sessionID":"s1","messageID":"m1","type":"step-start","snapshot":"abc"}}\n' +
        '{"type":"text","timestamp":2,"sessionID":"s1","part":{"id":"p2","sessionID":"s1","messageID":"m1","type":"text","text":"hello"}}\n';

      const events = parser.feed(input);
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('STEP_STARTED');
      expect(events[1].type).toBe('TEXT_MESSAGE_CONTENT');
    });

    it('should handle incomplete JSON in buffer', () => {
      const input = '{"type":"step_start","timestamp":1';

      const events = parser.feed(input);
      
      expect(events).toHaveLength(0);
      expect(parser.getBuffer()).toBe(input);
    });

    it('should handle empty lines', () => {
      const input = '{"type":"step_start","timestamp":1,"sessionID":"s1","part":{"id":"p1","sessionID":"s1","messageID":"m1","type":"step-start","snapshot":"abc"}}\n\n\n';

      const events = parser.feed(input);
      
      expect(events).toHaveLength(1);
    });
  });

  describe('raw events', () => {
    it('should emit raw event for non-JSON input', () => {
      const input = 'This is not JSON output\n';

      const events = parser.feed(input);
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RAW');
    });
  });
});

describe('mapAGUIToActivityEvent', () => {
  describe('tool call mapping', () => {
    it('should map Edit tool to file_edited', () => {
      const event: ToolCallStartEvent = {
        type: 'TOOL_CALL_START',
        timestamp: 1234567890,
        runId: 'ses_123',
        threadId: 'ses_123',
        toolCallId: 'call_1',
        toolName: 'Edit',
        input: { file_path: 'src/main.ts' }
      };

      const result = mapAGUIToActivityEvent(event, 'test-session');

      expect(result.type).toBe('file_edited');
      expect(result.icon).toBe('✏️');
      expect(result.details?.filePath).toBe('src/main.ts');
    });

    it('should map Bash tool to command_run', () => {
      const event: ToolCallStartEvent = {
        type: 'TOOL_CALL_START',
        timestamp: 1234567890,
        runId: 'ses_123',
        threadId: 'ses_123',
        toolCallId: 'call_2',
        toolName: 'Bash',
        input: { command: 'npm test' }
      };

      const result = mapAGUIToActivityEvent(event, 'test-session');

      expect(result.type).toBe('command_run');
      expect(result.icon).toBe('⚡');
      expect(result.details?.command).toBe('npm test');
    });

    it('should map Write tool to file_created', () => {
      const event: ToolCallStartEvent = {
        type: 'TOOL_CALL_START',
        timestamp: 1234567890,
        runId: 'ses_123',
        threadId: 'ses_123',
        toolCallId: 'call_3',
        toolName: 'Write',
        input: { file_path: 'src/new.ts', content: '...' }
      };

      const result = mapAGUIToActivityEvent(event, 'test-session');

      expect(result.type).toBe('file_created');
      expect(result.icon).toBe('📄');
      expect(result.details?.filePath).toBe('src/new.ts');
    });

    it('should map Delete tool to file_deleted', () => {
      const event: ToolCallStartEvent = {
        type: 'TOOL_CALL_START',
        timestamp: 1234567890,
        runId: 'ses_123',
        threadId: 'ses_123',
        toolCallId: 'call_4',
        toolName: 'Delete',
        input: { file_path: 'src/old.ts' }
      };

      const result = mapAGUIToActivityEvent(event, 'test-session');

      expect(result.type).toBe('file_deleted');
      expect(result.icon).toBe('🗑️');
    });

    it('should map Read tool to agent_message', () => {
      const event: ToolCallStartEvent = {
        type: 'TOOL_CALL_START',
        timestamp: 1234567890,
        runId: 'ses_123',
        threadId: 'ses_123',
        toolCallId: 'call_5',
        toolName: 'Read',
        input: { file_path: 'src/main.ts' }
      };

      const result = mapAGUIToActivityEvent(event, 'test-session');

      expect(result.type).toBe('agent_message');
      expect(result.icon).toBe('📖');
    });
  });

  describe('text mapping', () => {
    it('should map text content to agent_message', () => {
      const event: TextMessageContentEvent = {
        type: 'TEXT_MESSAGE_CONTENT',
        timestamp: 1234567890,
        runId: 'ses_123',
        threadId: 'ses_123',
        messageId: 'msg_1',
        delta: 'I will create a new file for you.'
      };

      const result = mapAGUIToActivityEvent(event, 'test-session');

      expect(result.type).toBe('agent_message');
      expect(result.summary).toBe('I will create a new file for you.');
      expect(result.icon).toBe('💬');
    });

    it('should truncate long text', () => {
      const longText = 'a'.repeat(200);
      const event: TextMessageContentEvent = {
        type: 'TEXT_MESSAGE_CONTENT',
        timestamp: 1234567890,
        runId: 'ses_123',
        threadId: 'ses_123',
        messageId: 'msg_1',
        delta: longText
      };

      const result = mapAGUIToActivityEvent(event, 'test-session');

      expect(result.summary.length).toBeLessThanOrEqual(103); // 100 + '...'
    });
  });

  describe('error mapping', () => {
    it('should map error to error type', () => {
      const event: RunErrorEvent = {
        type: 'RUN_ERROR',
        timestamp: 1234567890,
        runId: 'ses_123',
        threadId: 'ses_123',
        error: {
          name: 'APIError',
          message: 'Rate limit exceeded'
        }
      };

      const result = mapAGUIToActivityEvent(event, 'test-session');

      expect(result.type).toBe('error');
      expect(result.icon).toBe('🔴');
      expect(result.summary).toBe('Rate limit exceeded');
    });
  });

  describe('step mapping', () => {
    it('should map step started to agent_message', () => {
      const event: StepStartedEvent = {
        type: 'STEP_STARTED',
        timestamp: 1234567890,
        runId: 'ses_123',
        threadId: 'ses_123',
        stepId: 'step_1',
        stepName: 'Planning'
      };

      const result = mapAGUIToActivityEvent(event, 'test-session');

      expect(result.type).toBe('agent_message');
      expect(result.icon).toBe('🤔');
      expect(result.summary).toContain('Planning');
    });
  });
});

describe('isApprovalEvent', () => {
  it('should detect pending approval event', () => {
    const event: ToolCallStartEvent = {
      type: 'TOOL_CALL_START',
      timestamp: 1234567890,
      runId: 'ses_123',
      threadId: 'ses_123',
      toolCallId: 'call_1',
      toolName: 'Bash',
      input: { command: 'rm -rf /', _pendingApproval: true }
    };

    expect(isApprovalEvent(event)).toBe(true);
  });

  it('should not detect normal tool call as approval', () => {
    const event: ToolCallStartEvent = {
      type: 'TOOL_CALL_START',
      timestamp: 1234567890,
      runId: 'ses_123',
      threadId: 'ses_123',
      toolCallId: 'call_1',
      toolName: 'Bash',
      input: { command: 'ls' }
    };

    expect(isApprovalEvent(event)).toBe(false);
  });

  it('should not detect text events as approval', () => {
    const event: TextMessageContentEvent = {
      type: 'TEXT_MESSAGE_CONTENT',
      timestamp: 1234567890,
      runId: 'ses_123',
      threadId: 'ses_123',
      messageId: 'msg_1',
      delta: 'Do you want to proceed?'
    };

    expect(isApprovalEvent(event)).toBe(false);
  });
});

describe('extractCommandFromApproval', () => {
  it('should extract command from approval event', () => {
    const event: ToolCallStartEvent = {
      type: 'TOOL_CALL_START',
      timestamp: 1234567890,
      runId: 'ses_123',
      threadId: 'ses_123',
      toolCallId: 'call_1',
      toolName: 'Bash',
      input: { command: 'rm -rf node_modules' }
    };

    expect(extractCommandFromApproval(event)).toBe('rm -rf node_modules');
  });

  it('should return null for non-approval event', () => {
    const event: TextMessageContentEvent = {
      type: 'TEXT_MESSAGE_CONTENT',
      timestamp: 1234567890,
      runId: 'ses_123',
      threadId: 'ses_123',
      messageId: 'msg_1',
      delta: 'Hello'
    };

    expect(extractCommandFromApproval(event)).toBe(null);
  });
});
