/**
 * OpenSofa - AG-UI to ActivityEvent Mapper
 *
 * Maps AG-UI events to OpenSofa ActivityEvent format
 * for frontend consumption.
 */
import { createLogger } from '../../utils/logger.js';
const log = createLogger('event-parser:mapper');
let eventCounter = 0;
function generateId() {
    return `evt_${Date.now()}_${++eventCounter}`;
}
/** Map ACP ToolCall.Kind to activity event properties */
const KIND_ACTIVITY_MAP = {
    read: { type: 'agent_message', icon: '📖', summaryPrefix: 'Reading' },
    edit: { type: 'file_edited', icon: '✏️', summaryPrefix: 'Editing' },
    delete: { type: 'file_deleted', icon: '🗑️', summaryPrefix: 'Deleting' },
    execute: { type: 'command_run', icon: '⚡', summaryPrefix: 'Running' },
    search: { type: 'agent_message', icon: '🔍', summaryPrefix: 'Searching' },
    think: { type: 'agent_message', icon: '🤔', summaryPrefix: 'Thinking' },
    fetch: { type: 'agent_message', icon: '🌐', summaryPrefix: 'Fetching' },
};
/** Normalize ACP Kind to lowercase for lookup */
const normalizeKind = (kind) => kind.toLowerCase();
/** Determine ACP tool kind from a tool name string */
function resolveToolKind(toolName) {
    const normalized = normalizeKind(toolName);
    if (normalized in KIND_ACTIVITY_MAP)
        return normalized;
    // Fallback: infer kind from common tool names (for non-ACP agents)
    if (TOOL_NAME_TO_KIND[normalized])
        return TOOL_NAME_TO_KIND[normalized];
    return 'other';
}
/** Fallback mapping from common tool names to ACP kinds (non-ACP agents) */
const TOOL_NAME_TO_KIND = {
    bash: 'execute', shell: 'execute', command: 'execute', cmd: 'execute',
    write: 'edit', create: 'edit', new_file: 'edit', create_file: 'edit',
    replace: 'edit', modify: 'edit', str_replace_editor: 'edit',
    remove: 'delete', rm: 'delete', unlink: 'delete',
    read: 'read', read_file: 'read', cat: 'read',
    glob: 'search', grep: 'search', find: 'search',
    webfetch: 'fetch', websearch: 'fetch',
    test: 'execute', pytest: 'execute', jest: 'execute', vitest: 'execute',
    build: 'execute', compile: 'execute', run: 'execute', install: 'execute',
};
/** Tool names that represent file creation (not editing) */
const FILE_CREATION_TOOLS = new Set(['write', 'create', 'new_file', 'create_file']);
// ──────────────────────────────────────
// Helper functions
// ──────────────────────────────────────
/**
 * Check if a tool call is pending approval
 */
function isPendingApproval(event) {
    return event.input !== undefined &&
        '_pendingApproval' in event.input;
}
/**
 * Extract command from approval request
 */
function extractApprovalCommand(event) {
    const input = event.input;
    if (!input)
        return null;
    // Try common command fields
    const command = input.command ||
        input.cmd ||
        input.script;
    return command || null;
}
/**
 * Extract file path from tool call input
 */
function extractFilePath(input) {
    if (!input)
        return undefined;
    return input.file_path ||
        input.path ||
        input.file ||
        undefined;
}
/**
 * Maps a tool call start to ActivityEvent using ACP Kind as primary categorization.
 * Falls back to tool name matching for non-ACP agents.
 */
function mapToolCallStart(event, sessionName) {
    const isApproval = isPendingApproval(event);
    const command = extractApprovalCommand(event);
    const toolLower = event.toolName.toLowerCase();
    const kind = resolveToolKind(toolLower);
    const mapping = KIND_ACTIVITY_MAP[kind] ?? { type: 'command_run', icon: '🔧', summaryPrefix: 'Tool' };
    const filePath = extractFilePath(event.input);
    // File creation tools (write, create) should be file_created, not file_edited
    const isFileCreation = FILE_CREATION_TOOLS.has(toolLower);
    const activityType = isApproval ? 'approval_needed'
        : isFileCreation ? 'file_created'
            : mapping.type;
    const icon = isApproval ? '⚠️'
        : isFileCreation ? '📄'
            : mapping.icon;
    // Build summary from Kind + title/context
    const contextLabel = filePath ?? command ?? event.input?.title ?? event.toolName;
    const summaryPrefix = isFileCreation ? 'Creating' : mapping.summaryPrefix;
    const summary = isApproval
        ? `Needs approval: ${command?.slice(0, 50) || 'command'}`
        : `${summaryPrefix}: ${String(contextLabel).slice(0, 50)}`;
    return {
        id: generateId(),
        type: activityType,
        timestamp: event.timestamp,
        sessionName,
        summary,
        icon,
        toolKind: kind,
        details: {
            command: command ?? undefined,
            filePath,
            toolCallId: event.toolCallId,
            input: event.input,
        },
        actionable: isApproval,
    };
}
/**
 * Maps a tool call result to ActivityEvent
 */
function mapToolResult(event, sessionName) {
    const tool = event.toolName.toLowerCase();
    const output = event.result.output;
    const error = event.result.error;
    // If there's an error
    if (error) {
        return {
            id: generateId(),
            type: 'error',
            timestamp: event.timestamp,
            sessionName,
            summary: `Error in ${event.toolName}: ${error.slice(0, 100)}`,
            icon: '🔴',
            details: {
                errorStack: error,
                toolCallId: event.toolCallId,
                output,
            },
        };
    }
    // Check for test results
    if (tool === 'test' || tool === 'pytest' || tool === 'jest' || tool === 'vitest') {
        const hasFailed = output?.toLowerCase().includes('fail') ||
            output?.toLowerCase().includes('error');
        return {
            id: generateId(),
            type: 'test_result',
            timestamp: event.timestamp,
            sessionName,
            summary: hasFailed ? `Tests failed` : `Tests passed`,
            icon: hasFailed ? '❌' : '✅',
            details: {
                command: output?.slice(0, 200),
                toolCallId: event.toolCallId,
            },
        };
    }
    // Check for build results
    if (tool === 'build' || tool === 'compile' || tool === 'install') {
        const hasFailed = output?.toLowerCase().includes('fail') ||
            output?.toLowerCase().includes('error');
        return {
            id: generateId(),
            type: 'build_result',
            timestamp: event.timestamp,
            sessionName,
            summary: hasFailed ? `Build failed` : `Build succeeded`,
            icon: hasFailed ? '❌' : '✅',
            details: {
                command: output?.slice(0, 200),
                toolCallId: event.toolCallId,
            },
        };
    }
    // Default - no specific action needed for results
    // The start event already created the activity
    return {
        id: generateId(),
        type: 'agent_message',
        timestamp: event.timestamp,
        sessionName,
        summary: `Completed: ${event.toolName}`,
        icon: '✅',
        details: {
            toolCallId: event.toolCallId,
            output: output?.slice(0, 100),
        },
    };
}
/**
 * Map AG-UI event to OpenSofa ActivityEvent
 */
export function mapAGUIToActivityEvent(aguiEvent, sessionName) {
    switch (aguiEvent.type) {
        case 'RUN_STARTED':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: 'Agent started',
                icon: '🤖',
            };
        case 'RUN_FINISHED':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: 'Agent finished',
                icon: '✅',
            };
        case 'RUN_ERROR':
            return {
                id: generateId(),
                type: 'error',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: aguiEvent.error.message?.slice(0, 100) || 'Unknown error',
                icon: '🔴',
                details: {
                    errorStack: aguiEvent.error.message,
                },
            };
        case 'STEP_STARTED':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: `Thinking: ${aguiEvent.stepName || aguiEvent.stepId}`,
                icon: '🤔',
            };
        case 'STEP_FINISHED':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: 'Step completed',
                icon: '✅',
                details: aguiEvent.result?.usage ? {
                    command: JSON.stringify(aguiEvent.result.usage).slice(0, 100),
                } : undefined,
            };
        case 'TEXT_MESSAGE_START':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: `Message from ${aguiEvent.role}`,
                icon: '💬',
            };
        case 'TEXT_MESSAGE_CONTENT':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: aguiEvent.delta.slice(0, 100),
                icon: '💬',
            };
        case 'TEXT_MESSAGE_END':
            // Don't emit for message end - content already sent
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: 'Message complete',
                icon: '✅',
            };
        case 'TOOL_CALL_START':
            return mapToolCallStart(aguiEvent, sessionName);
        case 'TOOL_CALL_ARGS':
            // Args streaming - typically handled by start event
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: `Tool args: ${aguiEvent.toolCallId.slice(0, 20)}`,
                icon: '⚙️',
            };
        case 'TOOL_CALL_END':
            // Call ended - result should follow
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: 'Tool call ended',
                icon: '⚙️',
            };
        case 'TOOL_CALL_RESULT':
            return mapToolResult(aguiEvent, sessionName);
        case 'STATE_SNAPSHOT':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: 'State updated',
                icon: '📊',
            };
        case 'STATE_DELTA':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: `State changed: ${aguiEvent.delta.length} updates`,
                icon: '📊',
            };
        case 'RAW':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: 'Raw output',
                icon: '📝',
                details: {
                    errorStack: JSON.stringify(aguiEvent.event).slice(0, 200),
                },
            };
        case 'CUSTOM':
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: aguiEvent.timestamp,
                sessionName,
                summary: `Custom: ${aguiEvent.name}`,
                icon: '🔧',
                details: {
                    command: JSON.stringify(aguiEvent.value).slice(0, 100),
                },
            };
        default:
            // Handle unknown event types
            log.warn('Unknown AG-UI event type', { type: aguiEvent.type });
            return {
                id: generateId(),
                type: 'agent_message',
                timestamp: Date.now(),
                sessionName,
                summary: 'Unknown event',
                icon: '❓',
            };
    }
}
/**
 * Check if an AG-UI event represents an approval request
 */
export function isApprovalEvent(event) {
    if (event.type === 'TOOL_CALL_START') {
        return isPendingApproval(event);
    }
    return false;
}
/**
 * Extract approval command from an approval event
 */
export function extractCommandFromApproval(event) {
    if (event.type === 'TOOL_CALL_START') {
        return extractApprovalCommand(event);
    }
    return null;
}
//# sourceMappingURL=mapper.js.map