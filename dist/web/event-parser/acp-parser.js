/**
 * OpenSofa - ACP Event Parser
 *
 * Parses ACP (Agent Client Protocol) SSE events from agentapi's /events endpoint.
 * Handles SessionUpdate JSON-RPC messages containing AgentMessageChunk, ToolCall,
 * and ToolCallUpdate structures.
 *
 * Reference: docs/AG-UI-ACP-ARCHITECTURE.md
 */
import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';
const log = createLogger('event-parser:acp');
/**
 * ACP Event Parser
 *
 * Parses ACP SSE events and emits typed events for consumption:
 * - 'tool_call' - When a ToolCall is received
 * - 'text_chunk' - When an AgentMessageChunk is received
 * - 'status_change' - When agent status changes
 */
export class ACPEventParser extends EventEmitter {
    /**
     * Track the last seen tool name for correlation with tool_call_update events.
     * ACP sends ToolCall and ToolCallUpdate as separate events in the same SessionUpdate.
     */
    lastToolName;
    /**
     * Parse a raw SSE data line containing JSON
     * Handles both SessionUpdate and StatusChange event types
     */
    parseSSELine(data) {
        const trimmed = data.trim();
        if (!trimmed)
            return;
        try {
            const parsed = JSON.parse(trimmed);
            this.parseACPEvent(parsed);
        }
        catch (e) {
            log.warn('Failed to parse ACP event JSON', { data: trimmed.slice(0, 100) });
        }
    }
    /**
     * Parse an ACP event envelope and emit appropriate events
     */
    parseACPEvent(event) {
        // Handle SessionUpdate
        if (event.params?.SessionUpdate) {
            this.parseSessionUpdate(event.params.SessionUpdate);
            return;
        }
        // Handle StatusChange
        if (event.params?.StatusChange) {
            this.parseStatusChange(event.params.StatusChange);
            return;
        }
        // Legacy support: direct SessionUpdate at top level
        if ('AgentMessageChunk' in event || 'ToolCall' in event || 'ToolCallUpdate' in event) {
            this.parseSessionUpdate(event);
        }
    }
    /**
     * Parse a SessionUpdate notification
     */
    parseSessionUpdate(update) {
        // Emit AgentMessageChunk as text_chunk
        if (update.AgentMessageChunk?.Content?.Text?.Text !== undefined) {
            const text = update.AgentMessageChunk.Content.Text.Text;
            log.debug('Emitting text_chunk', { length: text.length });
            this.emit('text_chunk', text);
        }
        // Emit ToolCall with all available fields
        if (update.ToolCall?.Kind && update.ToolCall?.Title) {
            const kind = update.ToolCall.Kind;
            const title = update.ToolCall.Title;
            const event = {
                kind,
                title,
                // Capture future fields when available
                toolCallId: update.ToolCall.toolCallId,
                content: update.ToolCall.Content,
                locations: update.ToolCall.Locations,
                rawInput: update.ToolCall.RawInput,
            };
            log.debug('Emitting tool_call', { kind: event.kind, title: event.title });
            // Store tool name for correlation with subsequent tool_call_update
            this.lastToolName = title;
            this.emit('tool_call', event);
        }
        // Emit ToolCallUpdate status (with last seen tool name for correlation)
        if (update.ToolCallUpdate?.Status) {
            const updateEvent = {
                status: update.ToolCallUpdate.Status,
                toolName: this.lastToolName,
                toolCallId: update.ToolCallUpdate.toolCallId,
                content: update.ToolCallUpdate.Content,
            };
            log.debug('Emitting tool_call_update', { status: updateEvent.status, toolName: updateEvent.toolName });
            this.emit('tool_call_update', updateEvent);
        }
    }
    /**
     * Parse a StatusChange notification
     */
    parseStatusChange(change) {
        if (change.Status) {
            log.debug('Emitting status_change', {
                status: change.Status,
                agentType: change.AgentType
            });
            this.emit('status_change', {
                status: change.Status,
                agentType: change.AgentType,
            });
        }
    }
}
/**
 * Create a new ACPEventParser instance
 */
export function createACPEventParser() {
    return new ACPEventParser();
}
//# sourceMappingURL=acp-parser.js.map