/**
 * OpenSofa - AG-UI to ActivityEvent Mapper
 * 
 * Maps AG-UI events to OpenSofa ActivityEvent format
 * for frontend consumption.
 */

import { createLogger } from '../../utils/logger.js';
import type { ActivityEvent, ACPToolKind } from '../activity-parser.js';
import {
  type AGUIEvent,
  type ToolCallStartEvent,
  type ToolCallResultEvent,
  type StepStartedEvent,
  type StepFinishedEvent,
  type TextMessageContentEvent,
  type RunErrorEvent,
} from '../ag-ui-events.js';

const log = createLogger('event-parser:mapper');

let eventCounter = 0;

function generateId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

// ──────────────────────────────────────
// ACP Kind-based activity mapping
// ──────────────────────────────────────

interface KindMapping {
  type: ActivityEvent['type'];
  icon: string;
  summaryPrefix: string;
}

/** Map ACP ToolCall.Kind to activity event properties */
const KIND_ACTIVITY_MAP: Record<string, KindMapping> = {
  read:   { type: 'agent_message', icon: '📖', summaryPrefix: 'Reading' },
  edit:   { type: 'file_edited',   icon: '✏️', summaryPrefix: 'Editing' },
  delete: { type: 'file_deleted',  icon: '🗑️', summaryPrefix: 'Deleting' },
  execute:{ type: 'command_run',   icon: '⚡', summaryPrefix: 'Running' },
  search: { type: 'agent_message', icon: '🔍', summaryPrefix: 'Searching' },
  think:  { type: 'agent_message', icon: '🤔', summaryPrefix: 'Thinking' },
  fetch:  { type: 'agent_message', icon: '🌐', summaryPrefix: 'Fetching' },
};

/** Normalize ACP Kind to lowercase for lookup */
const normalizeKind = (kind: string): string => kind.toLowerCase();

/** Determine ACP tool kind from a tool name string */
function resolveToolKind(toolName: string): ACPToolKind {
  const normalized = normalizeKind(toolName);
  if (normalized in KIND_ACTIVITY_MAP) return normalized as ACPToolKind;
  
  // Fallback: infer kind from common tool names (for non-ACP agents)
  if (TOOL_NAME_TO_KIND[normalized]) return TOOL_NAME_TO_KIND[normalized];
  return 'other';
}

/** Fallback mapping from common tool names to ACP kinds (non-ACP agents) */
const TOOL_NAME_TO_KIND: Record<string, ACPToolKind> = {
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
function isPendingApproval(event: ToolCallStartEvent): boolean {
  return event.input !== undefined && 
         '_pendingApproval' in event.input;
}

/**
 * Extract command from approval request
 */
function extractApprovalCommand(event: ToolCallStartEvent): string | null {
  const input = event.input;
  if (!input) return null;
  
  // Try common command fields
  const command = (input.command as string) || 
                  (input.cmd as string) ||
                  (input.script as string);
  
  return command || null;
}

/**
 * Extract file path from tool call input
 */
function extractFilePath(input?: Record<string, unknown>): string | undefined {
  if (!input) return undefined;
  return (input.file_path as string) || 
         (input.path as string) || 
         (input.file as string) || 
         undefined;
}

/**
 * Extract diff or content from tool call input
 */
function extractDiff(input?: Record<string, unknown>): string | undefined {
  if (!input) return undefined;
  return (input.diff as string) || 
         (input.content as string) || 
         (input.replacement as string) ||
         undefined;
}

/**
 * Maps a tool call start to ActivityEvent using ACP Kind as primary categorization.
 * Falls back to tool name matching for non-ACP agents.
 */
function mapToolCallStart(event: ToolCallStartEvent, sessionName: string): ActivityEvent {
  const isApproval = isPendingApproval(event);
  const command = extractApprovalCommand(event);
  const toolLower = event.toolName.toLowerCase();
  const kind = resolveToolKind(toolLower);
  const mapping = KIND_ACTIVITY_MAP[kind] ?? { type: 'command_run' as const, icon: '🔧', summaryPrefix: 'Tool' };
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
  const contextLabel = filePath ?? command ?? event.input?.title as string ?? event.toolName;
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
      diff: extractDiff(event.input),
      toolCallId: event.toolCallId,
      input: event.input,
    },
    actionable: isApproval,
  };
}



/**
 * Maps a tool call result to ActivityEvent
 */
function mapToolResult(event: ToolCallResultEvent, sessionName: string): ActivityEvent {
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
      diff: typeof output === 'string' && output.includes('---') ? output : undefined,
    },
  };
}

/**
 * Map AG-UI event to OpenSofa ActivityEvent
 */
export function mapAGUIToActivityEvent(aguiEvent: AGUIEvent, sessionName: string): ActivityEvent {
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
      log.warn('Unknown AG-UI event type', { type: (aguiEvent as AGUIEvent).type });
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
export function isApprovalEvent(event: AGUIEvent): boolean {
  if (event.type === 'TOOL_CALL_START') {
    return isPendingApproval(event);
  }
  return false;
}

/**
 * Extract approval command from an approval event
 */
export function extractCommandFromApproval(event: AGUIEvent): string | null {
  if (event.type === 'TOOL_CALL_START') {
    return extractApprovalCommand(event);
  }
  return null;
}
