/**
 * Tests for ACP to AG-UI Mapper
 * 
 * Tests mapping of ACP (Agent Client Protocol) events to AG-UI (Agent-User Interaction) events.
 * Reference: src/web/event-parser/acp-mapper.ts
 */

import { describe, it, expect } from 'vitest';
import {
  mapACPTextToAGUI,
  mapACPToolCallToAGUI,
  mapACPToolResultToAGUI,
} from '../../src/web/event-parser/acp-mapper.js';
import {
  TextMessageContentEventSchema,
  ToolCallStartEventSchema,
  ToolCallResultEventSchema,
} from '../../src/web/ag-ui-events.js';

describe('ACP Mapper', () => {
  describe('mapACPTextToAGUI', () => {
    it('should map ACP text_chunk to AG-UI TextMessageContent', () => {
      const acpChunk = {
        Content: {
          Text: {
            Text: 'Hello from ACP'
          }
        }
      };

      const result = mapACPTextToAGUI(acpChunk);

      expect(result.type).toBe('TEXT_MESSAGE_CONTENT');
      expect(result.delta).toBe('Hello from ACP');
      expect(result.messageId).toMatch(/^msg_/);
      expect(result.timestamp).toBeDefined();
    });

    it('should map ACP text_chunk with correct schema', () => {
      const acpChunk = {
        Content: {
          Text: {
            Text: 'Test message'
          }
        }
      };

      const result = mapACPTextToAGUI(acpChunk);

      const parsed = TextMessageContentEventSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should handle missing optional fields gracefully', () => {
      const acpChunk = {
        Content: {}
      };

      const result = mapACPTextToAGUI(acpChunk);

      expect(result.type).toBe('TEXT_MESSAGE_CONTENT');
      expect(result.delta).toBe('');
    });

    it('should handle completely empty input', () => {
      const acpChunk = {};

      const result = mapACPTextToAGUI(acpChunk);

      expect(result.type).toBe('TEXT_MESSAGE_CONTENT');
      expect(result.delta).toBe('');
    });

    it('should handle missing Text field', () => {
      const acpChunk = {
        Content: {
          Text: {}
        }
      };

      const result = mapACPTextToAGUI(acpChunk);

      expect(result.delta).toBe('');
    });

    it('should generate unique messageIds for each call', () => {
      const acpChunk = {
        Content: {
          Text: { Text: 'Test' }
        }
      };

      const result1 = mapACPTextToAGUI(acpChunk);
      const result2 = mapACPTextToAGUI(acpChunk);

      expect(result1.messageId).not.toBe(result2.messageId);
    });
  });

  describe('mapACPToolCallToAGUI', () => {
    it('should map ACP tool_call to AG-UI ToolCallStart', () => {
      const acpToolCall = {
        Kind: 'Bash',
        Title: 'Run npm test'
      };

      const result = mapACPToolCallToAGUI(acpToolCall);

      expect(result.type).toBe('TOOL_CALL_START');
      expect(result.toolName).toBe('Bash');
      expect(result.toolCallId).toMatch(/^tool_/);
      expect(result.input).toEqual({ title: 'Run npm test' });
    });

    it('should map ACP tool_call with correct schema', () => {
      const acpToolCall = {
        Kind: 'Edit',
        Title: 'Edit file'
      };

      const result = mapACPToolCallToAGUI(acpToolCall);

      const parsed = ToolCallStartEventSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should handle missing optional fields', () => {
      const acpToolCall = {
        Kind: 'Bash'
      };

      const result = mapACPToolCallToAGUI(acpToolCall);

      expect(result.type).toBe('TOOL_CALL_START');
      expect(result.toolName).toBe('Bash');
      expect(result.input).toBeUndefined();
    });

    it('should handle missing Title field', () => {
      const acpToolCall = {
        Kind: 'Read'
      };

      const result = mapACPToolCallToAGUI(acpToolCall);

      expect(result.input).toBeUndefined();
    });

    it('should default Kind to unknown when missing', () => {
      const acpToolCall = {
        Title: 'Some tool'
      };

      const result = mapACPToolCallToAGUI(acpToolCall);

      expect(result.toolName).toBe('unknown');
    });

    it('should generate unique toolCallIds for each call', () => {
      const acpToolCall = {
        Kind: 'Bash',
        Title: 'Test'
      };

      const result1 = mapACPToolCallToAGUI(acpToolCall);
      const result2 = mapACPToolCallToAGUI(acpToolCall);

      expect(result1.toolCallId).not.toBe(result2.toolCallId);
    });

    it('should include timestamp in output', () => {
      const acpToolCall = {
        Kind: 'Write',
        Title: 'Write file'
      };

      const result = mapACPToolCallToAGUI(acpToolCall);

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
    });
  });

  describe('mapACPToolResultToAGUI', () => {
    it('should map ACP tool_result to AG-UI ToolCallResult for completed status', () => {
      const result = mapACPToolResultToAGUI('completed', 'Bash', 'tool_123');

      expect(result.type).toBe('TOOL_CALL_RESULT');
      expect(result.toolName).toBe('Bash');
      expect(result.toolCallId).toBe('tool_123');
      expect(result.result.output).toBe('completed');
      expect(result.result.error).toBeUndefined();
    });

    it('should map ACP tool_result to AG-UI ToolCallResult for failed status', () => {
      const result = mapACPToolResultToAGUI('failed', 'Bash', 'tool_456');

      expect(result.type).toBe('TOOL_CALL_RESULT');
      expect(result.toolName).toBe('Bash');
      expect(result.toolCallId).toBe('tool_456');
      expect(result.result.output).toBeUndefined();
      expect(result.result.error).toBe('Tool failed: failed');
    });

    it('should map ACP tool_result with correct schema', () => {
      const result = mapACPToolResultToAGUI('completed', 'Edit', 'tool_789');

      const parsed = ToolCallResultEventSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should generate toolCallId when not provided', () => {
      const result = mapACPToolResultToAGUI('completed', 'Bash');

      expect(result.toolCallId).toMatch(/^tool_/);
    });

    it('should handle unknown status as failed', () => {
      const result = mapACPToolResultToAGUI('unknown_status', 'Bash', 'tool_999');

      expect(result.result.error).toBe('Tool failed: unknown_status');
    });

    it('should handle empty status', () => {
      const result = mapACPToolResultToAGUI('', 'Bash', 'tool_empty');

      expect(result.result.error).toBe('Tool failed: ');
    });

    it('should handle missing optional fields', () => {
      const result = mapACPToolResultToAGUI('completed', 'Read');

      expect(result.type).toBe('TOOL_CALL_RESULT');
      expect(result.toolName).toBe('Read');
      expect(result.result.output).toBe('completed');
    });

    it('should include timestamp in output', () => {
      const result = mapACPToolResultToAGUI('completed', 'Bash', 'tool_time');

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
    });

    it('should use provided toolCallId over generated one', () => {
      const result = mapACPToolResultToAGUI('completed', 'Bash', 'custom_tool_id');

      expect(result.toolCallId).toBe('custom_tool_id');
    });
  });

  describe('integration scenarios', () => {
    it('should map text followed by tool call', () => {
      const textChunk = {
        Content: { Text: { Text: 'Running command...' } }
      };

      const toolCall = {
        Kind: 'Bash',
        Title: 'npm install'
      };

      const textResult = mapACPTextToAGUI(textChunk);
      const toolResult = mapACPToolCallToAGUI(toolCall);

      expect(textResult.type).toBe('TEXT_MESSAGE_CONTENT');
      expect(toolResult.type).toBe('TOOL_CALL_START');
      expect(toolResult.toolName).toBe('Bash');
    });

    it('should map tool call followed by result', () => {
      const toolCall = {
        Kind: 'Edit',
        Title: 'Edit file'
      };

      const toolResult = mapACPToolResultToAGUI('completed', 'Edit', 'tool_edit');

      expect(toolCall.Kind).toBe('Edit');
      expect(toolResult.result.output).toBe('completed');
    });
  });
});
