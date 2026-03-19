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
import type { AGUIEvent } from '../ag-ui-events.js';
import type { ActivityEvent } from '../activity-parser.js';
import { type ActivityAdapter, type AdapterRegistry } from './mod.js';
/**
 * Claude adapter implementation
 * Parses Claude's stream-json output and maps to AG-UI events
 */
export declare class ClaudeAdapter implements ActivityAdapter {
    readonly agentType = "claude";
    private sessionId;
    private messageId;
    private currentToolUse;
    private events;
    constructor(sessionId?: string);
    /**
     * Check if this adapter supports the given agent type
     */
    supports(agentType: string): boolean;
    /**
     * Parse a chunk of Claude JSONL output
     * Returns normalized AG-UI events
     */
    parse(chunk: string): AGUIEvent[];
    /**
     * Map Claude event to AG-UI event
     */
    private mapClaudeEvent;
    /**
     * Map AG-UI events to OpenSofa ActivityEvents
     */
    mapToActivityEvents(aguiEvents: AGUIEvent[], sessionName: string): ActivityEvent[];
    /**
     * Parse and map in one step
     */
    parseAndMap(chunk: string, sessionName: string): ActivityEvent[];
    /**
     * Reset adapter state
     */
    reset(sessionId?: string): void;
}
/**
 * Factory function to create Claude adapter
 */
export declare function createClaudeAdapter(sessionId?: string): ClaudeAdapter;
/**
 * Register Claude adapter with a registry
 */
export declare function registerClaudeAdapter(registry: AdapterRegistry): void;
//# sourceMappingURL=claude-adapter.d.ts.map