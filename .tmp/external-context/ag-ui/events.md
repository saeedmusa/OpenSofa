---
source: Official AG-UI Documentation (docs.ag-ui.com)
library: AG-UI Protocol
package: ag-ui
topic: events
fetched: 2026-03-18T00:00:00Z
official_docs: https://docs.ag-ui.com/concepts/events
---

# AG-UI Events Reference

> Understanding events in the Agent User Interaction Protocol

## Event Types Overview

Events are categorized by purpose:

| Category | Description |
|----------|-------------|
| Lifecycle Events | Monitor progression of agent runs |
| Text Message Events | Handle streaming textual content |
| Tool Call Events | Manage tool executions by agents |
| State Management Events | Synchronize state between agents and UI |
| Activity Events | Represent ongoing activity progress |
| Reasoning Events | LLM reasoning visibility and continuity |
| Special Events | Custom functionality |
| Draft Events | Proposed events under development |

## Base Event Properties

All events share:

| Property | Description |
|----------|-------------|
| `type` | The specific event type identifier |
| `timestamp` | Optional timestamp when event was created |
| `rawEvent` | Optional original event data if transformed |

## Lifecycle Events

### RunStarted

Signals the start of an agent run.

```typescript
{
  type: "RUN_STARTED",
  threadId: string,        // Conversation thread ID
  runId: string,           // Agent run ID
  parentRunId?: string,    // For branching/time travel
  input?: AgentInput       // Exact agent input payload
}
```

### RunFinished

Signals successful completion.

```typescript
{
  type: "RUN_FINISHED",
  threadId: string,
  runId: string,
  result?: any             // Optional output data
}
```

### RunError

Signals an error during the run.

```typescript
{
  type: "RUN_ERROR",
  message: string,
  code?: string            // Optional error code
}
```

### StepStarted / StepFinished

Optional events for granular progress tracking.

```typescript
{ type: "STEP_STARTED", stepName: string }
{ type: "STEP_FINISHED", stepName: string }
```

### Lifecycle Flow

```
RUN_STARTED → [STEP_STARTED → STEP_FINISHED]* → RUN_FINISHED
                                              or
                                           RUN_ERROR
```

## Text Message Events

### TextMessageStart

Signals start of a text message.

```typescript
{
  type: "TEXT_MESSAGE_START",
  messageId: string,
  role: "developer" | "system" | "assistant" | "user" | "tool"
}
```

### TextMessageContent

Streaming content chunk.

```typescript
{
  type: "TEXT_MESSAGE_CONTENT",
  messageId: string,      // Matches TextMessageStart
  delta: string           // Non-empty text chunk
}
```

### TextMessageEnd

Signals message completion.

```typescript
{ type: "TEXT_MESSAGE_END", messageId: string }
```

### TextMessageChunk

Convenience event that auto-expands to Start → Content → End.

```typescript
{
  type: "TEXT_MESSAGE_CHUNK",
  messageId?: string,     // Required on first chunk
  role?: string,          // Defaults to "assistant"
  delta?: string           // Empty closes message
}
```

### Text Message Flow

```
TEXT_MESSAGE_START → [TEXT_MESSAGE_CONTENT]+ → TEXT_MESSAGE_END
```

## Tool Call Events

### ToolCallStart

Signals start of a tool call.

```typescript
{
  type: "TOOL_CALL_START",
  toolCallId: string,
  toolCallName: string,
  parentMessageId?: string
}
```

### ToolCallArgs

Streaming arguments.

```typescript
{
  type: "TOOL_CALL_ARGS",
  toolCallId: string,     // Matches ToolCallStart
  delta: string           // Argument data chunk (often JSON)
}
```

### ToolCallEnd

Signals tool call specification complete.

```typescript
{ type: "TOOL_CALL_END", toolCallId: string }
```

### ToolCallResult

Tool execution result.

```typescript
{
  type: "TOOL_CALL_RESULT",
  messageId: string,
  toolCallId: string,
  content: any,           // Tool output
  role?: "tool"
}
```

### ToolCallChunk

Convenience event auto-expanding to Start → Args → End.

```typescript
{
  type: "TOOL_CALL_CHUNK",
  toolCallId?: string,
  toolCallName?: string,
  parentMessageId?: string,
  delta?: string
}
```

### Tool Call Flow

```
TOOL_CALL_START → [TOOL_CALL_ARGS]+ → TOOL_CALL_END → TOOL_CALL_RESULT
```

## State Management Events

### StateSnapshot

Complete state representation.

```typescript
{
  type: "STATE_SNAPSHOT",
  snapshot: any            // Full state object
}
```

### StateDelta

Incremental update using JSON Patch (RFC 6902).

```typescript
{
  type: "STATE_DELTA",
  delta: Array<{
    op: "add" | "remove" | "replace" | "move" | "copy" | "test",
    path: string,
    value?: any,
    from?: string
  }>
}
```

### MessagesSnapshot

Complete conversation history.

```typescript
{
  type: "MESSAGES_SNAPSHOT",
  messages: Message[]
}
```

## Activity Events

### ActivitySnapshot

Complete activity state.

```typescript
{
  type: "ACTIVITY_SNAPSHOT",
  messageId: string,
  activityType: string,    // e.g., "PLAN", "SEARCH"
  content: any,            // Structured JSON payload
  replace?: boolean        // Default true
}
```

### ActivityDelta

Incremental update to activity.

```typescript
{
  type: "ACTIVITY_DELTA",
  messageId: string,
  activityType: string,
  patch: JSONPatch[]       // RFC 6902 operations
}
```

## Reasoning Events

### ReasoningStart

Marks beginning of reasoning.

```typescript
{
  type: "REASONING_START",
  messageId: string
}
```

### ReasoningMessageStart

Begins streaming reasoning message.

```typescript
{
  type: "REASONING_MESSAGE_START",
  messageId: string,
  role: "assistant"
}
```

### ReasoningMessageContent

Streaming reasoning content.

```typescript
{
  type: "REASONING_MESSAGE_CONTENT",
  messageId: string,
  delta: string             // Non-empty reasoning chunk
}
```

### ReasoningMessageEnd

Completes reasoning message.

```typescript
{ type: "REASONING_MESSAGE_END", messageId: string }
```

### ReasoningMessageChunk

Convenience event auto-managing lifecycle.

```typescript
{
  type: "REASONING_MESSAGE_CHUNK",
  messageId: string,       // First non-empty starts message
  delta?: string           // Empty closes message
}
```

### ReasoningEncryptedValue

Attaches encrypted chain-of-thought.

```typescript
{
  type: "REASONING_ENCRYPTED_VALUE",
  subtype: "message" | "tool-call",
  entityId: string,
  encryptedValue: string   // Encrypted CoT blob
}
```

### ReasoningEnd

Marks end of reasoning.

```typescript
{ type: "REASONING_END", messageId: string }
```

### Reasoning Flow

```
REASONING_START
  → [REASONING_MESSAGE_START → REASONING_MESSAGE_CONTENT+ → REASONING_MESSAGE_END]
  → [REASONING_ENCRYPTED_VALUE]?
REASONING_END
```

## Special Events

### Raw

Passthrough for external system events.

```typescript
{
  type: "RAW",
  event: any,              // Original event data
  source?: string           // Source system identifier
}
```

### Custom

Application-specific custom events.

```typescript
{
  type: "CUSTOM",
  name: string,             // Custom event type name
  value: any                // Associated data
}
```

## Draft Events

### MetaEvent (DRAFT)

Side-band annotation events.

```typescript
{
  type: "META_EVENT",
  metaType: string,         // e.g., "thumbs_up", "tag"
  payload: any
}
```

## Event Patterns

### 1. Start-Content-End Pattern
Used for streaming content (text, tool calls, reasoning).

### 2. Snapshot-Delta Pattern
Used for state synchronization.

### 3. Lifecycle Pattern
Used for monitoring agent runs.

## Deprecated Events

`THINKING_*` events are deprecated in favor of `REASONING_*`:
- `THINKING_START` → `REASONING_START`
- `THINKING_END` → `REASONING_END`
- `THINKING_TEXT_MESSAGE_START` → `REASONING_MESSAGE_START`
- `THINKING_TEXT_MESSAGE_CONTENT` → `REASONING_MESSAGE_CONTENT`
- `THINKING_TEXT_MESSAGE_END` → `REASONING_MESSAGE_END`

## Implementation Notes

- Process events in order received
- Events with same ID belong to same logical stream
- Be resilient to out-of-order delivery
- Follow established patterns for custom events
