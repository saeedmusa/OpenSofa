---
source: Official AG-UI Documentation (docs.ag-ui.com)
library: AG-UI Protocol
package: ag-ui
topic: practical-patterns
fetched: 2026-03-18T00:00:00Z
official_docs: https://docs.ag-ui.com
---

# AG-UI Practical Patterns & Use Cases

## Primary Use Cases

### 1. Conversational AI / Chat Interfaces

AG-UI excels at streaming chat interfaces:

```typescript
// Streaming text response
agent.runAgent({}, {
  onTextMessageStartEvent({ event }) {
    // Create new message bubble
    createMessage(event.messageId, event.role)
  },
  onTextMessageContentEvent({ event }) {
    // Append streaming content
    appendToMessage(event.messageId, event.delta)
  },
  onTextMessageEndEvent({ event }) {
    // Finalize message
    finalizeMessage(event.messageId)
  }
})
```

**vs SSE**: AG-UI provides typed events vs raw SSE data
**vs WebSockets**: AG-UI handles message framing and sequencing

### 2. Agentic Workflows with Tools

Real-time tool execution visualization:

```typescript
// Tool call streaming
onToolCallStartEvent({ event }) {
  showToolNotification(event.toolCallName, event.toolCallId)
}

onToolCallArgsEvent({ event }) {
  // Arguments stream in as JSON fragments
  appendToolArgs(event.toolCallId, event.delta)
}

onToolCallResultEvent({ event }) {
  displayToolResult(event.toolCallId, event.content)
}
```

**Benefits**:
- Live visibility into what tools are being called
- Arguments visible as they're generated
- Results displayed immediately

### 3. Long-Running Task Progress

```typescript
// Lifecycle tracking
onRunStartedEvent({ event }) {
  initializeProgress(event.runId)
  if (event.parentRunId) {
    // Branching - show lineage
    showBranchIndicator(event.parentRunId)
  }
}

onStepStartedEvent({ event }) {
  updateProgress(`Starting: ${event.stepName}`)
}

onStepFinishedEvent({ event }) {
  markStepComplete(event.stepName)
}

onRunFinishedEvent({ event }) {
  finalizeProgress(event.runId)
  if (event.result) {
    displayResult(event.result)
  }
}

onRunErrorEvent({ event }) {
  showError(event.message, event.code)
}
```

### 4. State Synchronization

Shared state between agent and UI:

```typescript
// Initial state snapshot
onStateSnapshotEvent({ event }) {
  replaceApplicationState(event.snapshot)
}

// Incremental updates
onStateDeltaEvent({ event }) {
  applyJSONPatch(event.delta)  // RFC 6902
}
```

**vs Redux/WebRedux**: AG-UI state events are agent-driven, bidirectional
**vs Server-Sent Updates**: AG-UI provides typed delta format

### 5. Reasoning Visibility

```typescript
// Chain-of-thought display
onReasoningStartEvent({ event }) {
  showThinkingIndicator()
}

onReasoningMessageContentEvent({ event }) {
  appendReasoning(event.delta)
}

onReasoningEndEvent({ event }) {
  hideThinkingIndicator()
}

// Encrypted reasoning for state continuity
onReasoningEncryptedValueEvent({ event }) {
  // Store for later - opaque to client
  storeEncryptedReasoning(event.entityId, event.encryptedValue)
}
```

### 6. Human-in-the-Loop / Interrupts

Draft events for pause-approve-edit flows:

```typescript
// Interrupt handling (draft)
onRunFinishedEvent({ event }) {
  if (event.outcome === "interrupt") {
    showApprovalDialog(event.interrupt)
  }
}

// Resume after user action
await agent.runAgent({
  resumeFrom: { runId: event.runId, interruptId: event.interrupt.id },
  userAction: "approve" | "edit" | "retry"
})
```

### 7. Activity Updates (e.g., Progress Planning)

```typescript
// Planning activity
onActivitySnapshotEvent({ event }) {
  if (event.activityType === "PLAN") {
    initializePlanView(event.messageId, event.content)
  }
}

onActivityDeltaEvent({ event }) {
  // Incrementally update plan as agent thinks
  patchPlanView(event.messageId, event.patch)
}
```

## Comparison Matrix

| Feature | AG-UI | SSE | WebSockets | REST | GraphQL |
|---------|-------|-----|------------|------|---------|
| Streaming text | ✅ | ✅ | ✅ | ❌ | ❌ |
| Typed events | ✅ | ❌ | ❌ | ❌ | ❌ |
| State management | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tool call support | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bidirectional | ✅ | ❌ | ✅ | ❌ | ❌ |
| Transport agnostic | ✅ | ❌ | ❌ | ❌ | ❌ |
| Open standard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Agent-native | ✅ | ❌ | ❌ | ❌ | ❌ |

## Integration Patterns

### Pattern 1: Simple Chat (Direct to LLM)

```typescript
const agent = new HttpAgent({ url: "/api/agent" })

agent.runAgent({
  messages: [{ role: "user", content: "Hello" }]
}).subscribe({
  next: (event) => {
    if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
      appendMessage(event.delta)
    }
  }
})
```

### Pattern 2: Tool-Rich Agent

```typescript
agent.runAgent({
  tools: [
    {
      id: "weather",
      name: "getWeather",
      description: "Get weather for location",
      inputSchema: { location: "string" }
    }
  ],
  context: { userId: "123" }
}, {
  onToolCallStartEvent: handleToolStart,
  onToolCallArgsEvent: handleToolArgs,
  onToolCallResultEvent: handleToolResult
})
```

### Pattern 3: With Memory/History

```typescript
agent.runAgent({
  tools: [...],
  context: {
    memory: {
      threadId: "conversation-123",
      runId: "run-456"
    }
  }
})

// Client handles messages snapshot to restore history
onMessagesSnapshotEvent({ event }) {
  restoreConversationHistory(event.messages)
}
```

### Pattern 4: Multi-Agent Orchestration

```typescript
// Parent agent coordinates sub-agents via A2A
agent.runAgent({
  agents: [
    { id: "researcher", endpoint: "/agents/researcher" },
    { id: "writer", endpoint: "/agents/writer" }
  ]
}, {
  onAgentHandoffEvent: ({ agentId, context }) => {
    showAgentTransition(agentId)
    updateContext(context)
  }
})
```

## When to Use AG-UI

### ✅ Use AG-UI when:
- Building agentic applications with LLM-powered experiences
- Need real-time streaming with structured events
- Building tools that agents can call with live feedback
- Need state synchronization between agent and UI
- Building collaborative AI-human workflows
- Need reasoning visibility for transparency
- Requiring privacy-compliant reasoning (ZDR)

### ❌ Consider alternatives when:
- Simple request-response with no streaming needed → REST
- Server needs to push updates to clients → SSE
- Ultra-low latency gaming/trading → WebSockets
- Building with a framework that has native support → Use that first

## Architecture Decision Tree

```
Do you need agentic features?
│
├─ No → REST/GraphQL
│
└─ Yes → Do you need streaming?
          │
          ├─ No → Consider agent SDK directly
          │
          └─ Yes → Do you need typed events?
                   │
                   ├─ No → SSE or WebSockets
                   │
                   └─ Yes → AG-UI
```

## Working Alongside Existing Solutions

### AG-UI + REST APIs

```typescript
// AG-UI for agent interactions
// REST for CRUD operations
const agent = new HttpAgent({ url: "/api/agent" })
const api = new RESTClient({ baseUrl: "/api" })

// Agent action triggers REST
onToolCallResultEvent({ event }) {
  if (event.toolCallName === "createOrder") {
    api.orders.create(JSON.parse(event.content))
  }
}
```

### AG-UI + MCP

```
┌─────────────┐
│   AG-UI     │ ← User interaction
│  (Frontend) │
└──────┬──────┘
       │ AG-UI events
       ▼
┌─────────────┐
│   Agent     │
└──────┬──────┘
       │ MCP
       ▼
┌─────────────┐
│   Tools     │
│  (Database, │
│   APIs,etc) │
└─────────────┘
```

### AG-UI + A2A (Multi-Agent)

```
┌─────────────┐
│   AG-UI     │ ← User interaction
│  (Frontend) │
└──────┬──────┘
       │ AG-UI events
       ▼
┌─────────────┐
│ Orchestrator│
│   Agent     │
└──────┬──────┘
       │ A2A
   ┌───┴───┐
   ▼       ▼
┌──────┐ ┌──────┐
│ Sub  │ │ Sub  │
│Agent1│ │Agent2│
└──────┘ └──────┘
```

## Best Practices

1. **Handle all event types**: Implement handlers for lifecycle, text, tools, state
2. **Use convenience events**: `TextMessageChunk` reduces boilerplate
3. **Implement reconnection**: Store `threadId` and `runId` for resume
4. **Use snapshots for initialization**: Load history with `MessagesSnapshot`
5. **Apply deltas efficiently**: Use JSON Patch operations in order
6. **Store encrypted reasoning**: Forward `encryptedValue` opaquely
7. **Debug with Dojo**: Use AG-UI Dojo to verify implementations

## Common Pitfalls

1. **Ignoring error events**: Always handle `RunError`
2. **Not closing message streams**: Ensure `TextMessageEnd` is handled
3. **Missing reconnection logic**: Agent runs may be long-lived
4. **Overlooking tool call results**: Display results to users
5. **Not compacting stored events**: Use `compactEvents()` for history

## Resources

- AG-UI Dojo: https://dojo.ag-ui.com (interactive examples)
- Debugging Guide: https://docs.ag-ui.com/tutorials/debugging
- Event Reference: https://docs.ag-ui.com/concepts/events
- CopilotKit: https://docs.copilotkit.ai (React frontend SDK)
