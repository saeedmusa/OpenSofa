/**
 * OpenSofa - Aider Agent Adapter
 *
 * Adapts Aider's --json output to AG-UI events.
 * Aider emits JSON events for various operations.
 */
import { createLogger } from '../../utils/logger.js';
const log = createLogger('adapter:aider');
/**
 * Aider adapter implementation
 * Parses Aider's JSON output and maps to AG-UI events
 */
export class AiderAdapter {
    agentType = 'aider';
    sessionId;
    toolCallCounter = 0;
    constructor(sessionId) {
        this.sessionId = sessionId || `session_${Date.now()}`;
    }
    /**
     * Check if this adapter supports the given agent type
     */
    supports(agentType) {
        return agentType.toLowerCase() === 'aider';
    }
    /**
     * Parse a chunk of Aider JSONL output
     * Returns normalized AG-UI events
     */
    parse(chunk) {
        const lines = chunk.split('\n').filter(line => line.trim());
        const events = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                const event = this.mapAiderEvent(parsed);
                if (event) {
                    events.push(event);
                }
            }
            catch (e) {
                log.debug('Failed to parse Aider JSON', { error: e });
            }
        }
        return events;
    }
    /**
     * Map Aider event to AG-UI event
     */
    mapAiderEvent(event) {
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
    mapToActivityEvents(aguiEvents, sessionName) {
        const { mapAGUIToActivityEvent } = require('../event-parser/mapper.js');
        return aguiEvents.map(event => mapAGUIToActivityEvent(event, sessionName));
    }
    /**
     * Parse and map in one step
     */
    parseAndMap(chunk, sessionName) {
        const aguiEvents = this.parse(chunk);
        return this.mapToActivityEvents(aguiEvents, sessionName);
    }
    /**
     * Reset adapter state
     */
    reset(sessionId) {
        this.sessionId = sessionId || `session_${Date.now()}`;
        this.toolCallCounter = 0;
    }
}
/**
 * Factory function to create Aider adapter
 */
export function createAiderAdapter(sessionId) {
    return new AiderAdapter(sessionId);
}
/**
 * Register Aider adapter with a registry
 */
export function registerAiderAdapter(registry) {
    registry.register(new AiderAdapter());
}
//# sourceMappingURL=aider-adapter.js.map