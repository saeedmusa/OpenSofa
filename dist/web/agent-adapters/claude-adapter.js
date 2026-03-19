/**
 * OpenSofa - Claude Agent Adapter
 *
 * Adapts Claude Code's stream-json output to AG-UI events.
 * Claude emits events as newline-delimited JSON with these types:
 * - message_start, message_delta, message_stop
 * - content_block_start, content_block_delta, content_block_stop
 * - tool_use_start, tool_use_delta, tool_use_stop
 * - tool_result
 */
import { createLogger } from '../../utils/logger.js';
const log = createLogger('adapter:claude');
/**
 * Claude adapter implementation
 * Parses Claude's stream-json output and maps to AG-UI events
 */
export class ClaudeAdapter {
    agentType = 'claude';
    sessionId;
    messageId = null;
    currentToolUse = null;
    events = [];
    constructor(sessionId) {
        this.sessionId = sessionId || `session_${Date.now()}`;
    }
    /**
     * Check if this adapter supports the given agent type
     */
    supports(agentType) {
        return agentType.toLowerCase() === 'claude';
    }
    /**
     * Parse a chunk of Claude JSONL output
     * Returns normalized AG-UI events
     */
    parse(chunk) {
        const lines = chunk.split('\n').filter(line => line.trim());
        const events = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                const event = this.mapClaudeEvent(parsed);
                if (event) {
                    events.push(event);
                }
            }
            catch (e) {
                log.debug('Failed to parse Claude JSON', { error: e });
            }
        }
        return events;
    }
    /**
     * Map Claude event to AG-UI event
     */
    mapClaudeEvent(event) {
        switch (event.type) {
            case 'message_start':
                this.messageId = event.message.id;
                return {
                    type: 'RUN_STARTED',
                    timestamp: Date.now(),
                    runId: this.sessionId,
                    threadId: this.sessionId,
                };
            case 'message_delta':
                if (event.delta.stop_reason === 'end_turn' || event.delta.stop_reason === 'max_tokens') {
                    return {
                        type: 'RUN_FINISHED',
                        timestamp: Date.now(),
                        runId: this.sessionId,
                        threadId: this.sessionId,
                        result: {
                            output: undefined,
                            usage: {
                                output_tokens: event.usage?.output_tokens || 0,
                            },
                        },
                    };
                }
                return null;
            case 'content_block_start':
                if (event.content_block.type === 'tool_use') {
                    const toolUse = event.content_block;
                    this.currentToolUse = {
                        id: toolUse.id,
                        name: toolUse.name,
                        input: '',
                    };
                    return {
                        type: 'TOOL_CALL_START',
                        timestamp: Date.now(),
                        runId: this.sessionId,
                        threadId: this.sessionId,
                        toolCallId: toolUse.id,
                        toolName: toolUse.name,
                        input: toolUse.input,
                    };
                }
                return null;
            case 'content_block_delta':
                if (this.currentToolUse && event.delta.type === 'input_json_delta') {
                    this.currentToolUse.input += event.delta.partial_json || '';
                    // Emit as ToolCallArgs for streaming
                    return {
                        type: 'TOOL_CALL_ARGS',
                        timestamp: Date.now(),
                        runId: this.sessionId,
                        threadId: this.sessionId,
                        toolCallId: this.currentToolUse.id,
                        delta: { partial_json: event.delta.partial_json },
                    };
                }
                if (event.delta.type === 'text_delta') {
                    return {
                        type: 'TEXT_MESSAGE_CONTENT',
                        timestamp: Date.now(),
                        runId: this.sessionId,
                        threadId: this.sessionId,
                        messageId: this.messageId || 'unknown',
                        delta: event.delta.text || '',
                    };
                }
                return null;
            case 'content_block_stop':
                if (this.currentToolUse) {
                    let input = {};
                    try {
                        input = JSON.parse(this.currentToolUse.input) || {};
                    }
                    catch {
                        // Keep empty if parse fails
                    }
                    const toolEvent = {
                        type: 'TOOL_CALL_END',
                        timestamp: Date.now(),
                        runId: this.sessionId,
                        threadId: this.sessionId,
                        toolCallId: this.currentToolUse.id,
                    };
                    this.currentToolUse = null;
                    return toolEvent;
                }
                return null;
            default:
                return null;
        }
    }
    /**
     * Map AG-UI events to OpenSofa ActivityEvents
     */
    mapToActivityEvents(aguiEvents, sessionName) {
        // Import here to avoid circular deps
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
        this.messageId = null;
        this.currentToolUse = null;
        this.events = [];
    }
}
/**
 * Factory function to create Claude adapter
 */
export function createClaudeAdapter(sessionId) {
    return new ClaudeAdapter(sessionId);
}
/**
 * Register Claude adapter with a registry
 */
export function registerClaudeAdapter(registry) {
    registry.register(new ClaudeAdapter());
}
//# sourceMappingURL=claude-adapter.js.map