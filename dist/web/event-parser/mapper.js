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
 * Maps a tool call start to ActivityEvent
 */
function mapToolCallStart(event, sessionName) {
    const isApproval = isPendingApproval(event);
    const tool = event.toolName.toLowerCase();
    const command = extractApprovalCommand(event);
    // Check if it's a bash/command tool
    if (tool === 'bash' || tool === 'shell' || tool === 'command' || tool === 'cmd') {
        return {
            id: generateId(),
            type: isApproval ? 'approval_needed' : 'command_run',
            timestamp: event.timestamp,
            sessionName,
            summary: isApproval
                ? `Needs approval: ${command?.slice(0, 50) || 'command'}`
                : `Running: ${command?.slice(0, 50) || 'command'}`,
            icon: isApproval ? '⚠️' : '⚡',
            details: {
                command: command || undefined,
                toolCallId: event.toolCallId,
                input: event.input,
            },
            actionable: isApproval,
        };
    }
    // File operations
    if (tool === 'write' || tool === 'create' || tool === 'new_file' || tool === 'create_file') {
        const filePath = event.input?.file_path ||
            event.input?.path ||
            event.input?.file;
        return {
            id: generateId(),
            type: 'file_created',
            timestamp: event.timestamp,
            sessionName,
            summary: `Creating: ${filePath || 'file'}`,
            icon: '📄',
            details: {
                filePath: filePath || undefined,
                toolCallId: event.toolCallId,
                input: event.input,
            },
        };
    }
    if (tool === 'edit' || tool === 'replace' || tool === 'modify' || tool === 'str_replace_editor') {
        const filePath = event.input?.file_path ||
            event.input?.path ||
            event.input?.file;
        return {
            id: generateId(),
            type: 'file_edited',
            timestamp: event.timestamp,
            sessionName,
            summary: `Editing: ${filePath || 'file'}`,
            icon: '✏️',
            details: {
                filePath: filePath || undefined,
                toolCallId: event.toolCallId,
                input: event.input,
            },
        };
    }
    if (tool === 'delete' || tool === 'remove' || tool === 'rm' || tool === 'unlink') {
        const filePath = event.input?.file_path ||
            event.input?.path;
        return {
            id: generateId(),
            type: 'file_deleted',
            timestamp: event.timestamp,
            sessionName,
            summary: `Deleting: ${filePath || 'file'}`,
            icon: '🗑️',
            details: {
                filePath: filePath || undefined,
                toolCallId: event.toolCallId,
                input: event.input,
            },
        };
    }
    // Glob/search tools
    if (tool === 'glob' || tool === 'grep' || tool === 'search' || tool === 'find') {
        return {
            id: generateId(),
            type: 'agent_message',
            timestamp: event.timestamp,
            sessionName,
            summary: `Searching: ${JSON.stringify(event.input).slice(0, 50)}`,
            icon: '🔍',
            details: {
                toolCallId: event.toolCallId,
                input: event.input,
            },
        };
    }
    // Read tool
    if (tool === 'read' || tool === 'read_file' || tool === 'cat') {
        const filePath = event.input?.file_path ||
            event.input?.path;
        return {
            id: generateId(),
            type: 'agent_message',
            timestamp: event.timestamp,
            sessionName,
            summary: `Reading: ${filePath || 'file'}`,
            icon: '📖',
            details: {
                filePath: filePath || undefined,
                toolCallId: event.toolCallId,
                input: event.input,
            },
        };
    }
    // Web tools
    if (tool === 'webfetch' || tool === 'websearch' || tool === 'fetch' || tool === 'search') {
        const query = event.input?.query ||
            event.input?.url ||
            event.input?.query;
        return {
            id: generateId(),
            type: 'agent_message',
            timestamp: event.timestamp,
            sessionName,
            summary: `Web: ${query?.slice(0, 50) || 'fetching'}`,
            icon: '🌐',
            details: {
                toolCallId: event.toolCallId,
                input: event.input,
            },
        };
    }
    // Test tools
    if (tool === 'test' || tool === 'pytest' || tool === 'jest' || tool === 'vitest') {
        return {
            id: generateId(),
            type: 'command_run',
            timestamp: event.timestamp,
            sessionName,
            summary: `Running tests`,
            icon: '🧪',
            details: {
                toolCallId: event.toolCallId,
                input: event.input,
            },
        };
    }
    // Build tools
    if (tool === 'build' || tool === 'compile' || tool === 'run' || tool === 'install') {
        return {
            id: generateId(),
            type: 'command_run',
            timestamp: event.timestamp,
            sessionName,
            summary: `Building: ${event.toolName}`,
            icon: '🔨',
            details: {
                toolCallId: event.toolCallId,
                input: event.input,
            },
        };
    }
    // Default fallback
    return {
        id: generateId(),
        type: 'command_run',
        timestamp: event.timestamp,
        sessionName,
        summary: `Tool: ${event.toolName}`,
        icon: '🔧',
        details: {
            toolCallId: event.toolCallId,
            input: event.input,
        },
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