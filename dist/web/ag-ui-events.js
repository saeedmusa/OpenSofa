/**
 * OpenSofa - AG-UI Event Schemas
 *
 * Zod schemas for AG-UI (Agent-User Interaction) Protocol events.
 * Reference: https://docs.ag-ui.com
 *
 * These schemas validate incoming events from agents and normalize them
 * to the AG-UI event format.
 */
import { z } from 'zod';
// ============================================================================
// Base Types
// ============================================================================
/**
 * Base event structure that all AG-UI events extend
 */
export const BaseEventSchema = z.object({
    type: z.string(),
    timestamp: z.number().optional(),
    runId: z.string().optional(),
    threadId: z.string().optional(),
});
// ============================================================================
// Lifecycle Events
// ============================================================================
/**
 * Signals the start of an agent run
 */
export const RunStartedEventSchema = BaseEventSchema.extend({
    type: z.literal('RUN_STARTED'),
    timestamp: z.number(),
});
/**
 * Signals successful completion of a run
 */
export const RunFinishedEventSchema = BaseEventSchema.extend({
    type: z.literal('RUN_FINISHED'),
    timestamp: z.number(),
    result: z.object({
        output: z.string().optional(),
        usage: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
});
/**
 * Signals a failure during the run
 */
export const RunErrorEventSchema = BaseEventSchema.extend({
    type: z.literal('RUN_ERROR'),
    timestamp: z.number(),
    error: z.object({
        name: z.string(),
        message: z.string(),
        stack: z.string().optional(),
    }),
});
/**
 * Signals the start of a sub-task within a run
 */
export const StepStartedEventSchema = BaseEventSchema.extend({
    type: z.literal('STEP_STARTED'),
    timestamp: z.number(),
    stepId: z.string(),
    stepName: z.string().optional(),
});
/**
 * Marks the completion of a sub-task
 */
export const StepFinishedEventSchema = BaseEventSchema.extend({
    type: z.literal('STEP_FINISHED'),
    timestamp: z.number(),
    stepId: z.string(),
    stepName: z.string().optional(),
    result: z.object({
        output: z.string().optional(),
        usage: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
});
// ============================================================================
// Text Message Events
// ============================================================================
/**
 * Signals the start of a new message
 */
export const TextMessageStartEventSchema = BaseEventSchema.extend({
    type: z.literal('TEXT_MESSAGE_START'),
    timestamp: z.number(),
    messageId: z.string(),
    role: z.enum(['system', 'user', 'assistant', 'tool']),
});
/**
 * Carries a chunk of text as it's generated
 */
export const TextMessageContentEventSchema = BaseEventSchema.extend({
    type: z.literal('TEXT_MESSAGE_CONTENT'),
    timestamp: z.number(),
    messageId: z.string(),
    delta: z.string(),
});
/**
 * Signals the end of the message
 */
export const TextMessageEndEventSchema = BaseEventSchema.extend({
    type: z.literal('TEXT_MESSAGE_END'),
    timestamp: z.number(),
    messageId: z.string(),
});
// ============================================================================
// Tool Call Events
// ============================================================================
/**
 * Emitted when the agent begins calling a tool
 */
export const ToolCallStartEventSchema = BaseEventSchema.extend({
    type: z.literal('TOOL_CALL_START'),
    timestamp: z.number(),
    toolCallId: z.string(),
    toolName: z.string(),
    input: z.record(z.string(), z.unknown()).optional(),
});
/**
 * Optionally emitted if the tool's arguments are streamed in parts
 */
export const ToolCallArgsEventSchema = BaseEventSchema.extend({
    type: z.literal('TOOL_CALL_ARGS'),
    timestamp: z.number(),
    toolCallId: z.string(),
    delta: z.record(z.string(), z.unknown()),
});
/**
 * Signals the end of the tool call
 */
export const ToolCallEndEventSchema = BaseEventSchema.extend({
    type: z.literal('TOOL_CALL_END'),
    timestamp: z.number(),
    toolCallId: z.string(),
});
/**
 * Carries the final output returned by the tool
 */
export const ToolCallResultEventSchema = BaseEventSchema.extend({
    type: z.literal('TOOL_CALL_RESULT'),
    timestamp: z.number(),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.object({
        output: z.string().optional(),
        error: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
    }),
});
// ============================================================================
// State Management Events
// ============================================================================
/**
 * Sends a full JSON snapshot of the current state
 */
export const StateSnapshotEventSchema = BaseEventSchema.extend({
    type: z.literal('STATE_SNAPSHOT'),
    timestamp: z.number(),
    snapshot: z.record(z.string(), z.unknown()),
});
/**
 * Sends incremental changes as a JSON Patch diff
 */
export const StateDeltaEventSchema = BaseEventSchema.extend({
    type: z.literal('STATE_DELTA'),
    timestamp: z.number(),
    delta: z.array(z.object({
        op: z.enum(['add', 'remove', 'replace', 'move', 'copy']),
        path: z.string(),
        value: z.unknown().optional(),
        from: z.string().optional(),
    })),
});
// ============================================================================
// Special Events
// ============================================================================
/**
 * Used to pass through events from external systems
 */
export const RawEventSchema = BaseEventSchema.extend({
    type: z.literal('RAW'),
    timestamp: z.number(),
    event: z.unknown(),
    source: z.string().optional(),
});
/**
 * Used for application-specific events not covered by standard types
 */
export const CustomEventSchema = BaseEventSchema.extend({
    type: z.literal('CUSTOM'),
    timestamp: z.number(),
    name: z.string(),
    value: z.unknown(),
});
// ============================================================================
// Union Type
// ============================================================================
/**
 * All AG-UI event types
 */
export const AGUIEventSchema = z.discriminatedUnion('type', [
    RunStartedEventSchema,
    RunFinishedEventSchema,
    RunErrorEventSchema,
    StepStartedEventSchema,
    StepFinishedEventSchema,
    TextMessageStartEventSchema,
    TextMessageContentEventSchema,
    TextMessageEndEventSchema,
    ToolCallStartEventSchema,
    ToolCallArgsEventSchema,
    ToolCallEndEventSchema,
    ToolCallResultEventSchema,
    StateSnapshotEventSchema,
    StateDeltaEventSchema,
    RawEventSchema,
    CustomEventSchema,
]);
// ============================================================================
// Agent-Specific Event Schemas (OpenCode, Claude, etc.)
// ============================================================================
/**
 * OpenCode step_start event
 */
export const OpenCodeStepStartSchema = z.object({
    type: z.literal('step_start'),
    timestamp: z.number(),
    sessionID: z.string(),
    part: z.object({
        id: z.string(),
        sessionID: z.string(),
        messageID: z.string(),
        type: z.literal('step-start'),
        snapshot: z.string(),
    }),
});
/**
 * OpenCode step_finish event
 */
export const OpenCodeStepFinishSchema = z.object({
    type: z.literal('step_finish'),
    timestamp: z.number(),
    sessionID: z.string(),
    part: z.object({
        id: z.string(),
        sessionID: z.string(),
        messageID: z.string(),
        type: z.literal('step-finish'),
        reason: z.enum(['stop', 'tool-calls']).optional(),
        snapshot: z.string(),
        cost: z.number().optional(),
        tokens: z.object({
            input: z.number(),
            output: z.number(),
            reasoning: z.number().optional(),
            cache: z.object({
                read: z.number(),
                write: z.number(),
            }).optional(),
        }).optional(),
    }),
});
/**
 * OpenCode tool_use event
 */
export const OpenCodeToolUseSchema = z.object({
    type: z.literal('tool_use'),
    timestamp: z.number(),
    sessionID: z.string(),
    part: z.object({
        id: z.string(),
        sessionID: z.string(),
        messageID: z.string(),
        type: z.literal('tool'),
        callID: z.string(),
        tool: z.string(),
        state: z.object({
            status: z.enum(['completed', 'in_progress', 'pending_approval', 'failed']),
            input: z.record(z.string(), z.unknown()).optional(),
            output: z.string().optional(),
            title: z.string().optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
            time: z.object({
                start: z.number(),
                end: z.number(),
            }).optional(),
        }),
    }),
});
/**
 * OpenCode text event
 */
export const OpenCodeTextSchema = z.object({
    type: z.literal('text'),
    timestamp: z.number(),
    sessionID: z.string(),
    part: z.object({
        id: z.string(),
        sessionID: z.string(),
        messageID: z.string(),
        type: z.literal('text'),
        text: z.string(),
        time: z.object({
            start: z.number(),
            end: z.number(),
        }).optional(),
    }),
});
/**
 * OpenCode error event
 */
export const OpenCodeErrorSchema = z.object({
    type: z.literal('error'),
    timestamp: z.number(),
    sessionID: z.string(),
    error: z.object({
        name: z.string(),
        data: z.object({
            message: z.string(),
            statusCode: z.number().optional(),
            isRetryable: z.boolean().optional(),
        }),
    }),
});
/**
 * All OpenCode event types
 */
export const OpenCodeEventSchema = z.discriminatedUnion('type', [
    OpenCodeStepStartSchema,
    OpenCodeStepFinishSchema,
    OpenCodeToolUseSchema,
    OpenCodeTextSchema,
    OpenCodeErrorSchema,
]);
// ============================================================================
// Validation Helpers
// ============================================================================
/**
 * Validate raw input against AG-UI schema
 */
export function validateAGUIEvent(data) {
    const result = AGUIEventSchema.safeParse(data);
    return result.success ? result.data : null;
}
/**
 * Validate raw input against OpenCode schema
 */
export function validateOpenCodeEvent(data) {
    const result = OpenCodeEventSchema.safeParse(data);
    return result.success ? result.data : null;
}
//# sourceMappingURL=ag-ui-events.js.map