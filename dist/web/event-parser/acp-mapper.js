/**
 * OpenSofa - ACP to AG-UI Mapper
 *
 * Maps ACP (Agent Client Protocol) events to AG-UI (Agent-User Interaction) events.
 * Reference: docs/AG-UI-ACP-ARCHITECTURE.md Section 6.3
 */
let eventCounter = 0;
function generateId() {
    return `evt_${Date.now()}_${++eventCounter}`;
}
function generateMessageId() {
    return `msg_${Date.now()}_${++eventCounter}`;
}
function generateToolCallId() {
    return `tool_${Date.now()}_${++eventCounter}`;
}
/**
 * Maps ACP AgentMessageChunk to AG-UI TextMessageContentEvent
 *
 * ACP Schema:
 *   SessionUpdate.AgentMessageChunk.Content.Text.Text
 *
 * AG-UI Output:
 *   TextMessageContentEvent with delta text
 */
export function mapACPTextToAGUI(chunk) {
    const text = chunk.Content?.Text?.Text ?? '';
    return {
        type: 'TEXT_MESSAGE_CONTENT',
        timestamp: Date.now(),
        messageId: generateMessageId(),
        delta: text,
    };
}
/**
 * Maps ACP ToolCall to AG-UI ToolCallStartEvent
 *
 * ACP Schema:
 *   SessionUpdate.ToolCall { Kind: string, Title: string }
 *
 * AG-UI Output:
 *   ToolCallStartEvent with Kind as toolName
 */
export function mapACPToolCallToAGUI(tool) {
    return {
        type: 'TOOL_CALL_START',
        timestamp: Date.now(),
        toolCallId: generateToolCallId(),
        toolName: tool.Kind ?? 'unknown',
        input: tool.Title ? { title: tool.Title } : undefined,
    };
}
/**
 * Maps ACP ToolCallUpdate status to AG-UI ToolCallResultEvent
 *
 * ACP Schema:
 *   SessionUpdate.ToolCallUpdate.Status = "completed" | "failed"
 *
 * AG-UI Output:
 *   ToolCallResultEvent with output or error based on status
 */
export function mapACPToolResultToAGUI(status, toolName, toolCallId) {
    const isCompleted = status === 'completed';
    return {
        type: 'TOOL_CALL_RESULT',
        timestamp: Date.now(),
        toolCallId: toolCallId ?? generateToolCallId(),
        toolName,
        result: {
            output: isCompleted ? 'completed' : undefined,
            error: isCompleted ? undefined : `Tool failed: ${status}`,
        },
    };
}
//# sourceMappingURL=acp-mapper.js.map