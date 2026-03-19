/**
 * OpenSofa - Aider Agent Adapter
 * 
 * Adapts Aider's --json output to AG-UI events.
 * Aider emits JSON events for various operations.
 */

import { createLogger } from '../../utils/logger.js';
import type { AGUIEvent } from '../ag-ui-events.js';
import type { ActivityEvent } from '../activity-parser.js';
import { 
  type AgentAdapter,
  type ActivityAdapter,
  type AdapterRegistry,
} from './mod.js';

const log = createLogger('adapter:aider');

/**
 * Aider event types from --json output
 */
interface AiderInit {
  type: 'init';
  model: string;
  editor_model: string;
  io_mode: string;
}

interface AiderChatStart {
  type: 'chat_start';
  conversation_id: string;
}

interface AiderChatDone {
  type: 'chat_done';
  total_cost: number;
  tokens_in: number;
  tokens_out: number;
  duration: number;
}

interface AiderToolCalls {
  type: 'tool_calls';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_call_id: string;
}

interface AiderToolResult {
  type: 'tool_result';
  tool_name: string;
  tool_call_id: string;
  output: string;
  result: string;
}

interface AiderFileEdited {
  type: 'file_edited' | 'file_created' | 'file_deleted';
  file: string;
  diff?: string;
  errors?: string[];
}

interface AiderError {
  type: 'error';
  message: string;
  traceback?: string;
}

type AiderEvent = 
  | AiderInit 
  | AiderChatStart 
  | AiderChatDone 
  | AiderToolCalls 
  | AiderToolResult 
  | AiderFileEdited 
  | AiderError;

/**
 * Aider adapter implementation
 * Parses Aider's JSON output and maps to AG-UI events
 */
export class AiderAdapter implements ActivityAdapter {
  readonly agentType = 'aider';
  
  private sessionId: string;
  private toolCallCounter = 0;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`;
  }

  /**
   * Check if this adapter supports the given agent type
   */
  supports(agentType: string): boolean {
    return agentType.toLowerCase() === 'aider';
  }

  /**
   * Parse a chunk of Aider JSONL output
   * Returns normalized AG-UI events
   */
  parse(chunk: string): AGUIEvent[] {
    const lines = chunk.split('\n').filter(line => line.trim());
    const events: AGUIEvent[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as AiderEvent;
        const event = this.mapAiderEvent(parsed);
        if (event) {
          events.push(event);
        }
      } catch (e) {
        log.debug('Failed to parse Aider JSON', { error: e });
      }
    }

    return events;
  }

  /**
   * Map Aider event to AG-UI event
   */
  private mapAiderEvent(event: AiderEvent): AGUIEvent | null {
    const timestamp = Date.now();
    const baseEvent = {
      runId: this.sessionId,
      threadId: this.sessionId,
    };

    switch (event.type) {
      case 'init':
      case 'chat_start':
        return {
          type: 'RUN_STARTED',
          timestamp,
          ...baseEvent,
        };

      case 'chat_done':
        return {
          type: 'RUN_FINISHED',
          timestamp,
          ...baseEvent,
          result: {
            output: undefined,
            usage: {
              input_tokens: event.tokens_in,
              output_tokens: event.tokens_out,
            },
          },
        };

      case 'tool_calls':
        const toolCallId = event.tool_call_id || `call_${++this.toolCallCounter}`;
        return {
          type: 'TOOL_CALL_START',
          timestamp,
          ...baseEvent,
          toolCallId,
          toolName: event.tool_name,
          input: event.tool_input,
        };

      case 'tool_result':
        const resultToolCallId = event.tool_call_id || `call_${this.toolCallCounter}`;
        return {
          type: 'TOOL_CALL_RESULT',
          timestamp,
          ...baseEvent,
          toolCallId: resultToolCallId,
          toolName: event.tool_name,
          result: {
            output: event.output,
          },
        };

      case 'file_edited':
        const editToolCallId = `call_${++this.toolCallCounter}`;
        return {
          type: 'TOOL_CALL_START',
          timestamp,
          ...baseEvent,
          toolCallId: editToolCallId,
          toolName: 'Edit',
          input: { file_path: event.file, diff: event.diff },
        };

      case 'file_created':
        const createToolCallId = `call_${++this.toolCallCounter}`;
        return {
          type: 'TOOL_CALL_START',
          timestamp,
          ...baseEvent,
          toolCallId: createToolCallId,
          toolName: 'Write',
          input: { file_path: event.file },
        };

      case 'file_deleted':
        const deleteToolCallId = `call_${++this.toolCallCounter}`;
        return {
          type: 'TOOL_CALL_START',
          timestamp,
          ...baseEvent,
          toolCallId: deleteToolCallId,
          toolName: 'Delete',
          input: { file_path: event.file },
        };

      case 'error':
        return {
          type: 'RUN_ERROR',
          timestamp,
          ...baseEvent,
          error: {
            name: 'AiderError',
            message: event.message,
            stack: event.traceback,
          },
        };

      default:
        return null;
    }
  }

  /**
   * Map AG-UI events to OpenSofa ActivityEvents
   */
  mapToActivityEvents(aguiEvents: AGUIEvent[], sessionName: string): ActivityEvent[] {
    const { mapAGUIToActivityEvent } = require('../event-parser/mapper.js');
    return aguiEvents.map(event => mapAGUIToActivityEvent(event, sessionName));
  }

  /**
   * Parse and map in one step
   */
  parseAndMap(chunk: string, sessionName: string): ActivityEvent[] {
    const aguiEvents = this.parse(chunk);
    return this.mapToActivityEvents(aguiEvents, sessionName);
  }

  /**
   * Reset adapter state
   */
  reset(sessionId?: string): void {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.toolCallCounter = 0;
  }
}

/**
 * Factory function to create Aider adapter
 */
export function createAiderAdapter(sessionId?: string): AiderAdapter {
  return new AiderAdapter(sessionId);
}

/**
 * Register Aider adapter with a registry
 */
export function registerAiderAdapter(registry: AdapterRegistry): void {
  registry.register(new AiderAdapter());
}
