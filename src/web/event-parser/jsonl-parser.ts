/**
 * OpenSofa - JSONL Parser
 * 
 * Parses JSONL (newline-delimited JSON) from agent stdout.
 * Each line is a complete JSON object representing an event.
 */

import { createLogger } from '../../utils/logger.js';
import {
  AGUIEvent,
  AGUIEventSchema,
  OpenCodeEvent,
  OpenCodeEventSchema,
  type OpenCodeStepStart,
  type OpenCodeStepFinish,
  type OpenCodeToolUse,
  type OpenCodeText,
  type OpenCodeError,
} from '../ag-ui-events.js';
import { z } from 'zod';

const log = createLogger('event-parser:jsonl');

let eventCounter = 0;

function generateEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

/**
 * Maps OpenCode events to AG-UI events
 */
function mapOpenCodeToAGUI(event: OpenCodeEvent): AGUIEvent {
  switch (event.type) {
    case 'step_start':
      return mapStepStart(event);
    case 'step_finish':
      return mapStepFinish(event);
    case 'tool_use':
      return mapToolUse(event);
    case 'text':
      return mapText(event);
    case 'error':
      return mapError(event);
    default: {
      // Handle unknown event types - use type assertion for safety
      const unknownEvent = event as unknown as { timestamp?: number };
      return {
        type: 'RAW',
        timestamp: unknownEvent.timestamp ?? Date.now(),
        event: event,
      };
    }
  }
}

function mapStepStart(event: OpenCodeStepStart): AGUIEvent {
  return {
    type: 'STEP_STARTED',
    timestamp: event.timestamp,
    runId: event.sessionID,
    threadId: event.sessionID,
    stepId: event.part.id,
    stepName: undefined,
  };
}

function mapStepFinish(event: OpenCodeStepFinish): AGUIEvent {
  return {
    type: 'STEP_FINISHED',
    timestamp: event.timestamp,
    runId: event.sessionID,
    threadId: event.sessionID,
    stepId: event.part.id,
    stepName: undefined,
    result: event.part.reason ? {
      output: undefined,
      usage: event.part.tokens ? {
        input_tokens: event.part.tokens.input,
        output_tokens: event.part.tokens.output,
        reasoning_tokens: event.part.tokens.reasoning,
        cache_read_tokens: event.part.tokens.cache?.read,
        cache_write_tokens: event.part.tokens.cache?.write,
      } : undefined,
    } : undefined,
  };
}

function mapToolUse(event: OpenCodeToolUse): AGUIEvent {
  // If status is pending_approval, emit as ToolCallStart with special marker
  if (event.part.state.status === 'pending_approval') {
    return {
      type: 'TOOL_CALL_START',
      timestamp: event.timestamp,
      runId: event.sessionID,
      threadId: event.sessionID,
      toolCallId: event.part.callID,
      toolName: event.part.tool,
      input: {
        ...event.part.state.input,
        _pendingApproval: true,
      },
    };
  }

  // If completed, emit ToolCallStart followed by ToolCallResult
  // For now, emit ToolCallStart with the complete info
  return {
    type: 'TOOL_CALL_START',
    timestamp: event.timestamp,
    runId: event.sessionID,
    threadId: event.sessionID,
    toolCallId: event.part.callID,
    toolName: event.part.tool,
    input: event.part.state.input,
  };
}

function mapText(event: OpenCodeText): AGUIEvent {
  return {
    type: 'TEXT_MESSAGE_CONTENT',
    timestamp: event.timestamp,
    runId: event.sessionID,
    threadId: event.sessionID,
    messageId: event.part.id,
    delta: event.part.text,
  };
}

function mapError(event: OpenCodeError): AGUIEvent {
  return {
    type: 'RUN_ERROR',
    timestamp: event.timestamp,
    runId: event.sessionID,
    threadId: event.sessionID,
    error: {
      name: event.error.name,
      message: event.error.data.message,
    },
  };
}

/**
 * JSONL Parser class
 * Handles streaming JSONL input from agents
 */
export class JsonlParser {
  private buffer: string = '';
  
  /**
   * Feed a chunk of data and get parsed events
   */
  feed(chunk: string): AGUIEvent[] {
    this.buffer += chunk;
    const events: AGUIEvent[] = [];
    
    // Split by newlines, keeping incomplete lines in buffer
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parsed = this.parseLine(line);
      if (parsed) {
        events.push(parsed);
      }
    }
    
    return events;
  }
  
  /**
   * Parse a single line of JSONL
   */
  private parseLine(line: string): AGUIEvent | null {
    try {
      const parsed = JSON.parse(line);
      
      // First, try to parse as AG-UI event
      const aguiResult = AGUIEventSchema.safeParse(parsed);
      if (aguiResult.success) {
        return aguiResult.data;
      }
      
      // Try to parse as OpenCode event
      const opencodeResult = OpenCodeEventSchema.safeParse(parsed);
      if (opencodeResult.success) {
        return mapOpenCodeToAGUI(opencodeResult.data);
      }
      
      // Log warning about invalid schema but still emit as raw
      log.debug('Unknown event structure', { 
        type: parsed.type,
        hasType: 'type' in parsed 
      });
      
      // Return as raw event
      return {
        type: 'RAW',
        timestamp: Date.now(),
        event: parsed,
      };
      
    } catch (e) {
      // Not valid JSON - emit as raw event
      log.debug('Failed to parse JSON', { line: line.slice(0, 100) });
      return {
        type: 'RAW',
        timestamp: Date.now(),
        event: { raw: line },
      };
    }
  }
  
  /**
   * Get the current buffer (for debugging)
   */
  getBuffer(): string {
    return this.buffer;
  }
  
  /**
   * Clear the buffer
   */
  reset(): void {
    this.buffer = '';
  }
}

/**
 * Parse a single JSONL line (standalone function)
 */
export function parseJsonlLine(line: string): AGUIEvent | null {
  const parser = new JsonlParser();
  return parser.feed(line + '\n')[0] || null;
}

/**
 * Generate a unique event ID
 */
export { generateEventId };
