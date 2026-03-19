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
/**
 * ACP SessionUpdate notification structure from agentapi
 */
export interface ACPSessionUpdate {
    AgentMessageChunk?: {
        Content?: {
            Text?: {
                Text?: string;
            };
        };
    };
    ToolCall?: {
        Kind?: string;
        Title?: string;
    };
    ToolCallUpdate?: {
        Status?: string;
    };
}
/**
 * ACP StatusChange notification structure from agentapi
 */
export interface ACPStatusChange {
    Status?: 'running' | 'stable';
    AgentType?: string;
}
/**
 * Raw ACP event envelope from SSE data
 */
interface ACPEventEnvelope {
    type?: string;
    method?: string;
    params?: {
        SessionUpdate?: ACPSessionUpdate;
        StatusChange?: ACPStatusChange;
    };
}
/**
 * ACP Event Parser
 *
 * Parses ACP SSE events and emits typed events for consumption:
 * - 'tool_call' - When a ToolCall is received
 * - 'text_chunk' - When an AgentMessageChunk is received
 * - 'status_change' - When agent status changes
 */
export declare class ACPEventParser extends EventEmitter {
    /**
     * Track the last seen tool name for correlation with tool_call_update events.
     * ACP sends ToolCall and ToolCallUpdate as separate events in the same SessionUpdate.
     */
    private lastToolName;
    /**
     * Parse a raw SSE data line containing JSON
     * Handles both SessionUpdate and StatusChange event types
     */
    parseSSELine(data: string): void;
    /**
     * Parse an ACP event envelope and emit appropriate events
     */
    parseACPEvent(event: ACPEventEnvelope): void;
    /**
     * Parse a SessionUpdate notification
     */
    parseSessionUpdate(update: ACPSessionUpdate): void;
    /**
     * Parse a StatusChange notification
     */
    parseStatusChange(change: ACPStatusChange): void;
}
/**
 * Create a new ACPEventParser instance
 */
export declare function createACPEventParser(): ACPEventParser;
export {};
//# sourceMappingURL=acp-parser.d.ts.map