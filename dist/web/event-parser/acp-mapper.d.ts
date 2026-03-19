/**
 * OpenSofa - ACP to AG-UI Mapper
 *
 * Maps ACP (Agent Client Protocol) events to AG-UI (Agent-User Interaction) events.
 * Reference: docs/AG-UI-ACP-ARCHITECTURE.md Section 6.3
 */
import type { TextMessageContentEvent, ToolCallStartEvent, ToolCallResultEvent } from '../ag-ui-events.js';
/**
 * Maps ACP AgentMessageChunk to AG-UI TextMessageContentEvent
 *
 * ACP Schema:
 *   SessionUpdate.AgentMessageChunk.Content.Text.Text
 *
 * AG-UI Output:
 *   TextMessageContentEvent with delta text
 */
export declare function mapACPTextToAGUI(chunk: {
    Content?: {
        Text?: {
            Text?: string;
        };
    };
}): TextMessageContentEvent;
/**
 * Maps ACP ToolCall to AG-UI ToolCallStartEvent
 *
 * ACP Schema:
 *   SessionUpdate.ToolCall { Kind: string, Title: string }
 *
 * AG-UI Output:
 *   ToolCallStartEvent with Kind as toolName
 */
export declare function mapACPToolCallToAGUI(tool: {
    Kind?: string;
    Title?: string;
}): ToolCallStartEvent;
/**
 * Maps ACP ToolCallUpdate status to AG-UI ToolCallResultEvent
 *
 * ACP Schema:
 *   SessionUpdate.ToolCallUpdate.Status = "completed" | "failed"
 *
 * AG-UI Output:
 *   ToolCallResultEvent with output or error based on status
 */
export declare function mapACPToolResultToAGUI(status: string, toolName: string, toolCallId?: string): ToolCallResultEvent;
//# sourceMappingURL=acp-mapper.d.ts.map