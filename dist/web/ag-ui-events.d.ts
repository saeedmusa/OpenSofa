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
/**
 * Base event structure that all AG-UI events extend
 */
export declare const BaseEventSchema: z.ZodObject<{
    type: z.ZodString;
    timestamp: z.ZodOptional<z.ZodNumber>;
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type BaseEvent = z.infer<typeof BaseEventSchema>;
/**
 * Signals the start of an agent run
 */
export declare const RunStartedEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"RUN_STARTED">;
    timestamp: z.ZodNumber;
}, z.core.$strip>;
export type RunStartedEvent = z.infer<typeof RunStartedEventSchema>;
/**
 * Signals successful completion of a run
 */
export declare const RunFinishedEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"RUN_FINISHED">;
    timestamp: z.ZodNumber;
    result: z.ZodOptional<z.ZodObject<{
        output: z.ZodOptional<z.ZodString>;
        usage: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RunFinishedEvent = z.infer<typeof RunFinishedEventSchema>;
/**
 * Signals a failure during the run
 */
export declare const RunErrorEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"RUN_ERROR">;
    timestamp: z.ZodNumber;
    error: z.ZodObject<{
        name: z.ZodString;
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type RunErrorEvent = z.infer<typeof RunErrorEventSchema>;
/**
 * Signals the start of a sub-task within a run
 */
export declare const StepStartedEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"STEP_STARTED">;
    timestamp: z.ZodNumber;
    stepId: z.ZodString;
    stepName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type StepStartedEvent = z.infer<typeof StepStartedEventSchema>;
/**
 * Marks the completion of a sub-task
 */
export declare const StepFinishedEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"STEP_FINISHED">;
    timestamp: z.ZodNumber;
    stepId: z.ZodString;
    stepName: z.ZodOptional<z.ZodString>;
    result: z.ZodOptional<z.ZodObject<{
        output: z.ZodOptional<z.ZodString>;
        usage: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type StepFinishedEvent = z.infer<typeof StepFinishedEventSchema>;
/**
 * Signals the start of a new message
 */
export declare const TextMessageStartEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TEXT_MESSAGE_START">;
    timestamp: z.ZodNumber;
    messageId: z.ZodString;
    role: z.ZodEnum<{
        user: "user";
        system: "system";
        assistant: "assistant";
        tool: "tool";
    }>;
}, z.core.$strip>;
export type TextMessageStartEvent = z.infer<typeof TextMessageStartEventSchema>;
/**
 * Carries a chunk of text as it's generated
 */
export declare const TextMessageContentEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TEXT_MESSAGE_CONTENT">;
    timestamp: z.ZodNumber;
    messageId: z.ZodString;
    delta: z.ZodString;
}, z.core.$strip>;
export type TextMessageContentEvent = z.infer<typeof TextMessageContentEventSchema>;
/**
 * Signals the end of the message
 */
export declare const TextMessageEndEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TEXT_MESSAGE_END">;
    timestamp: z.ZodNumber;
    messageId: z.ZodString;
}, z.core.$strip>;
export type TextMessageEndEvent = z.infer<typeof TextMessageEndEventSchema>;
/**
 * Emitted when the agent begins calling a tool
 */
export declare const ToolCallStartEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TOOL_CALL_START">;
    timestamp: z.ZodNumber;
    toolCallId: z.ZodString;
    toolName: z.ZodString;
    input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type ToolCallStartEvent = z.infer<typeof ToolCallStartEventSchema>;
/**
 * Optionally emitted if the tool's arguments are streamed in parts
 */
export declare const ToolCallArgsEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TOOL_CALL_ARGS">;
    timestamp: z.ZodNumber;
    toolCallId: z.ZodString;
    delta: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type ToolCallArgsEvent = z.infer<typeof ToolCallArgsEventSchema>;
/**
 * Signals the end of the tool call
 */
export declare const ToolCallEndEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TOOL_CALL_END">;
    timestamp: z.ZodNumber;
    toolCallId: z.ZodString;
}, z.core.$strip>;
export type ToolCallEndEvent = z.infer<typeof ToolCallEndEventSchema>;
/**
 * Carries the final output returned by the tool
 */
export declare const ToolCallResultEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TOOL_CALL_RESULT">;
    timestamp: z.ZodNumber;
    toolCallId: z.ZodString;
    toolName: z.ZodString;
    result: z.ZodObject<{
        output: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ToolCallResultEvent = z.infer<typeof ToolCallResultEventSchema>;
/**
 * Sends a full JSON snapshot of the current state
 */
export declare const StateSnapshotEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"STATE_SNAPSHOT">;
    timestamp: z.ZodNumber;
    snapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type StateSnapshotEvent = z.infer<typeof StateSnapshotEventSchema>;
/**
 * Sends incremental changes as a JSON Patch diff
 */
export declare const StateDeltaEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"STATE_DELTA">;
    timestamp: z.ZodNumber;
    delta: z.ZodArray<z.ZodObject<{
        op: z.ZodEnum<{
            replace: "replace";
            copy: "copy";
            remove: "remove";
            add: "add";
            move: "move";
        }>;
        path: z.ZodString;
        value: z.ZodOptional<z.ZodUnknown>;
        from: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type StateDeltaEvent = z.infer<typeof StateDeltaEventSchema>;
/**
 * Used to pass through events from external systems
 */
export declare const RawEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"RAW">;
    timestamp: z.ZodNumber;
    event: z.ZodUnknown;
    source: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RawEvent = z.infer<typeof RawEventSchema>;
/**
 * Used for application-specific events not covered by standard types
 */
export declare const CustomEventSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"CUSTOM">;
    timestamp: z.ZodNumber;
    name: z.ZodString;
    value: z.ZodUnknown;
}, z.core.$strip>;
export type CustomEvent = z.infer<typeof CustomEventSchema>;
/**
 * All AG-UI event types
 */
export declare const AGUIEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"RUN_STARTED">;
    timestamp: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"RUN_FINISHED">;
    timestamp: z.ZodNumber;
    result: z.ZodOptional<z.ZodObject<{
        output: z.ZodOptional<z.ZodString>;
        usage: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"RUN_ERROR">;
    timestamp: z.ZodNumber;
    error: z.ZodObject<{
        name: z.ZodString;
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"STEP_STARTED">;
    timestamp: z.ZodNumber;
    stepId: z.ZodString;
    stepName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"STEP_FINISHED">;
    timestamp: z.ZodNumber;
    stepId: z.ZodString;
    stepName: z.ZodOptional<z.ZodString>;
    result: z.ZodOptional<z.ZodObject<{
        output: z.ZodOptional<z.ZodString>;
        usage: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TEXT_MESSAGE_START">;
    timestamp: z.ZodNumber;
    messageId: z.ZodString;
    role: z.ZodEnum<{
        user: "user";
        system: "system";
        assistant: "assistant";
        tool: "tool";
    }>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TEXT_MESSAGE_CONTENT">;
    timestamp: z.ZodNumber;
    messageId: z.ZodString;
    delta: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TEXT_MESSAGE_END">;
    timestamp: z.ZodNumber;
    messageId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TOOL_CALL_START">;
    timestamp: z.ZodNumber;
    toolCallId: z.ZodString;
    toolName: z.ZodString;
    input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TOOL_CALL_ARGS">;
    timestamp: z.ZodNumber;
    toolCallId: z.ZodString;
    delta: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TOOL_CALL_END">;
    timestamp: z.ZodNumber;
    toolCallId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"TOOL_CALL_RESULT">;
    timestamp: z.ZodNumber;
    toolCallId: z.ZodString;
    toolName: z.ZodString;
    result: z.ZodObject<{
        output: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"STATE_SNAPSHOT">;
    timestamp: z.ZodNumber;
    snapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"STATE_DELTA">;
    timestamp: z.ZodNumber;
    delta: z.ZodArray<z.ZodObject<{
        op: z.ZodEnum<{
            replace: "replace";
            copy: "copy";
            remove: "remove";
            add: "add";
            move: "move";
        }>;
        path: z.ZodString;
        value: z.ZodOptional<z.ZodUnknown>;
        from: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"RAW">;
    timestamp: z.ZodNumber;
    event: z.ZodUnknown;
    source: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    threadId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"CUSTOM">;
    timestamp: z.ZodNumber;
    name: z.ZodString;
    value: z.ZodUnknown;
}, z.core.$strip>], "type">;
export type AGUIEvent = z.infer<typeof AGUIEventSchema>;
/**
 * OpenCode step_start event
 */
export declare const OpenCodeStepStartSchema: z.ZodObject<{
    type: z.ZodLiteral<"step_start">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    part: z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        messageID: z.ZodString;
        type: z.ZodLiteral<"step-start">;
        snapshot: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type OpenCodeStepStart = z.infer<typeof OpenCodeStepStartSchema>;
/**
 * OpenCode step_finish event
 */
export declare const OpenCodeStepFinishSchema: z.ZodObject<{
    type: z.ZodLiteral<"step_finish">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    part: z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        messageID: z.ZodString;
        type: z.ZodLiteral<"step-finish">;
        reason: z.ZodOptional<z.ZodEnum<{
            stop: "stop";
            "tool-calls": "tool-calls";
        }>>;
        snapshot: z.ZodString;
        cost: z.ZodOptional<z.ZodNumber>;
        tokens: z.ZodOptional<z.ZodObject<{
            input: z.ZodNumber;
            output: z.ZodNumber;
            reasoning: z.ZodOptional<z.ZodNumber>;
            cache: z.ZodOptional<z.ZodObject<{
                read: z.ZodNumber;
                write: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type OpenCodeStepFinish = z.infer<typeof OpenCodeStepFinishSchema>;
/**
 * OpenCode tool_use event
 */
export declare const OpenCodeToolUseSchema: z.ZodObject<{
    type: z.ZodLiteral<"tool_use">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    part: z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        messageID: z.ZodString;
        type: z.ZodLiteral<"tool">;
        callID: z.ZodString;
        tool: z.ZodString;
        state: z.ZodObject<{
            status: z.ZodEnum<{
                failed: "failed";
                completed: "completed";
                in_progress: "in_progress";
                pending_approval: "pending_approval";
            }>;
            input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            output: z.ZodOptional<z.ZodString>;
            title: z.ZodOptional<z.ZodString>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            time: z.ZodOptional<z.ZodObject<{
                start: z.ZodNumber;
                end: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type OpenCodeToolUse = z.infer<typeof OpenCodeToolUseSchema>;
/**
 * OpenCode text event
 */
export declare const OpenCodeTextSchema: z.ZodObject<{
    type: z.ZodLiteral<"text">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    part: z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        messageID: z.ZodString;
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
        time: z.ZodOptional<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type OpenCodeText = z.infer<typeof OpenCodeTextSchema>;
/**
 * OpenCode error event
 */
export declare const OpenCodeErrorSchema: z.ZodObject<{
    type: z.ZodLiteral<"error">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    error: z.ZodObject<{
        name: z.ZodString;
        data: z.ZodObject<{
            message: z.ZodString;
            statusCode: z.ZodOptional<z.ZodNumber>;
            isRetryable: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type OpenCodeError = z.infer<typeof OpenCodeErrorSchema>;
/**
 * All OpenCode event types
 */
export declare const OpenCodeEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"step_start">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    part: z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        messageID: z.ZodString;
        type: z.ZodLiteral<"step-start">;
        snapshot: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"step_finish">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    part: z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        messageID: z.ZodString;
        type: z.ZodLiteral<"step-finish">;
        reason: z.ZodOptional<z.ZodEnum<{
            stop: "stop";
            "tool-calls": "tool-calls";
        }>>;
        snapshot: z.ZodString;
        cost: z.ZodOptional<z.ZodNumber>;
        tokens: z.ZodOptional<z.ZodObject<{
            input: z.ZodNumber;
            output: z.ZodNumber;
            reasoning: z.ZodOptional<z.ZodNumber>;
            cache: z.ZodOptional<z.ZodObject<{
                read: z.ZodNumber;
                write: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"tool_use">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    part: z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        messageID: z.ZodString;
        type: z.ZodLiteral<"tool">;
        callID: z.ZodString;
        tool: z.ZodString;
        state: z.ZodObject<{
            status: z.ZodEnum<{
                failed: "failed";
                completed: "completed";
                in_progress: "in_progress";
                pending_approval: "pending_approval";
            }>;
            input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            output: z.ZodOptional<z.ZodString>;
            title: z.ZodOptional<z.ZodString>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            time: z.ZodOptional<z.ZodObject<{
                start: z.ZodNumber;
                end: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"text">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    part: z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        messageID: z.ZodString;
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
        time: z.ZodOptional<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"error">;
    timestamp: z.ZodNumber;
    sessionID: z.ZodString;
    error: z.ZodObject<{
        name: z.ZodString;
        data: z.ZodObject<{
            message: z.ZodString;
            statusCode: z.ZodOptional<z.ZodNumber>;
            isRetryable: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>], "type">;
export type OpenCodeEvent = z.infer<typeof OpenCodeEventSchema>;
/**
 * Validate raw input against AG-UI schema
 */
export declare function validateAGUIEvent(data: unknown): AGUIEvent | null;
/**
 * Validate raw input against OpenCode schema
 */
export declare function validateOpenCodeEvent(data: unknown): OpenCodeEvent | null;
//# sourceMappingURL=ag-ui-events.d.ts.map