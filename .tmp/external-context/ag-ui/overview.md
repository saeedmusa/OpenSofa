---
source: Official AG-UI Documentation (docs.ag-ui.com)
library: AG-UI Protocol
package: ag-ui
topic: overview
fetched: 2026-03-18T00:00:00Z
official_docs: https://docs.ag-ui.com
---

# AG-UI (Agent-User Interaction) Protocol

## What is AG-UI?

**AG-UI** is an **open**, **lightweight**, **event-based** protocol that standardizes how AI agents connect to user-facing applications. It is designed as the general-purpose, bi-directional connection between a user-facing application and any agentic backend.

## The Problem AG-UI Solves

Agentic applications break the simple request/response model that dominated frontend-backend development:

- **Long-running & streaming**: Agents stream intermediate work across multi-turn sessions
- **Nondeterministic**: Agents can control application UI nondeterministically
- **Mixed IO**: Agents mix structured + unstructured I/O (text, voice, tool calls, state updates)
- **Complex composition**: Agents may call sub-agents recursively

Traditional REST/GraphQL APIs cannot handle these requirements effectively.

## Core Architecture

```
Frontend (Application) <--> AG-UI Client <--> Agent Backend
                                              <--> Secure Proxy
                                              <--> Other Agents
```

### Design Principles

1. **Event-Driven Communication**: Agents emit 16+ standardized event types during execution
2. **Bidirectional Interaction**: Agents accept input from users for collaborative workflows
3. **Transport Agnostic**: Supports SSE, WebSockets, Webhooks, HTTP binary
4. **Flexible Event Structure**: Events don't need exact AG-UI format - just AG-UI-compatible

### Protocol Layer

```typescript
// Core agent execution interface
type RunAgent = () => Observable<BaseEvent>

class MyAgent extends AbstractAgent {
  run(input: RunAgentInput): RunAgent {
    return () => from([
      { type: EventType.RUN_STARTED, threadId, runId },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: "Hello" },
      { type: EventType.RUN_FINISHED, threadId, runId },
    ])
  }
}
```

## Core Concepts

### 1. Events System

All communication is based on typed events. Categories include:

| Category | Events | Purpose |
|----------|--------|---------|
| **Lifecycle** | `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`, `STEP_STARTED`, `STEP_FINISHED` | Monitor agent run progression |
| **Text Messages** | `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END` | Stream textual content |
| **Tool Calls** | `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT` | Manage tool executions |
| **State Management** | `STATE_SNAPSHOT`, `STATE_DELTA`, `MESSAGES_SNAPSHOT` | Sync state between agent and UI |
| **Activity** | `ACTIVITY_SNAPSHOT`, `ACTIVITY_DELTA` | In-progress activity updates |
| **Reasoning** | `REASONING_START`, `REASONING_MESSAGE_CONTENT`, `REASONING_END`, `REASONING_ENCRYPTED_VALUE` | LLM reasoning visibility |
| **Special** | `RAW`, `CUSTOM` | Custom functionality |

### 2. Streaming Pattern

Text messages and tool calls follow a streaming pattern:
```
Start Event → Content Deltas (multiple) → End Event
```

Example for text:
```typescript
{ type: "TEXT_MESSAGE_START", messageId: "msg1", role: "assistant" }
{ type: "TEXT_MESSAGE_CONTENT", messageId: "msg1", delta: "Hello " }
{ type: "TEXT_MESSAGE_CONTENT", messageId: "msg1", delta: "world" }
{ type: "TEXT_MESSAGE_END", messageId: "msg1" }
```

### 3. State Management

Uses **snapshot-delta pattern**:
- `STATE_SNAPSHOT`: Complete state at a point in time
- `STATE_DELTA`: Incremental changes using JSON Patch (RFC 6902)
- `MESSAGES_SNAPSHOT`: Complete conversation history

### 4. Reasoning Support

AG-UI supports chain-of-thought reasoning with privacy:
- **Visible reasoning**: Stream summaries to users
- **Encrypted reasoning**: `REASONING_ENCRYPTED_VALUE` for state continuity without exposure
- **ZDR-compliant**: Zero Data Retention support for privacy-sensitive deployments

### 5. Tool Calls

Tools are passed in `runAgent` parameters and streamed:
```
TOOL_CALL_START → TOOL_CALL_ARGS → TOOL_CALL_END → TOOL_CALL_RESULT
```

### 6. Serialization & History

Supports:
- Event stream persistence for history restore
- Event compaction (merge chunks into snapshots)
- Branching via `parentRunId` (git-like append-only log)
- Time travel to any prior run

## Agentic Protocol Stack

AG-UI is one of three complementary protocols:

| Layer | Protocol | Purpose |
|-------|----------|---------|
| Agent ↔ User | **AG-UI** | Real-time, multimodal, interactive experiences |
| Agent ↔ Tools | **MCP** (Model Context Protocol) | Connect to external systems, tools, data |
| Agent ↔ Agent | **A2A** (Agent to Agent) | Coordinate distributed agentic systems |

## Comparison with Other Approaches

### vs SSE (Server-Sent Events)
- SSE is a transport mechanism only
- AG-UI provides typed events on top of SSE
- AG-UI includes state management, tool calls, reasoning

### vs WebSockets
- WebSockets are bidirectional but low-level
- AG-UI provides application-level protocol semantics
- AG-UI handles serialization, compaction, lineage

### vs REST/GraphQL
- REST/GraphQL are request-response
- AG-UI supports streaming, long-running agents
- AG-UI enables bidirectional UI control from agents

### vs AgentAPI
- AgentAPI is proprietary; AG-UI is open
- AG-UI has standardized event types
- AG-UI integrates with MCP, A2A, and generative UI specs

## Integrations

### Agent Frameworks (1st Party)
- Microsoft Agent Framework
- Google ADK
- AWS Strands Agents
- Mastra
- Pydantic AI
- Agno
- LlamaIndex
- LangGraph (partnership)
- CrewAI (partnership)

### SDKs Available
- TypeScript/JavaScript
- Kotlin (community)
- Golang (community)
- Dart (community)
- Java (community)
- Rust (community)

### Clients
- **CopilotKit** (primary frontend SDK)
- Terminal + Agent
- React Native (help wanted)

## Building Blocks

Current capabilities:
1. Streaming chat with cancel/resume
2. Multimodality (files, images, audio, transcripts)
3. Generative UI (static & declarative)
4. Shared state (read-only & read-write)
5. Thinking steps visualization
6. Frontend tool calls
7. Backend tool rendering
8. Interrupts (human in the loop)
9. Sub-agents and composition
10. Agent steering
11. Tool output streaming
12. Custom events

## Generative UI Support

AG-UI works with all generative UI specs:
- **A2UI** (Google): Declarative, JSONL-based
- **Open-JSON-UI** (OpenAI): Open standardization
- **MCP-UI** (Microsoft/Shopify): iframe-based

AG-UI provides the bi-directional runtime connection; generative UI specs define the component schemas.

## Use Cases

1. **Conversational AI**: Chat interfaces with streaming responses
2. **Agentic Apps**: Long-running tasks with real-time updates
3. **Human-in-the-Loop**: Pause, approve, edit, retry agent actions
4. **Collaborative Editing**: Shared state between agent and users
5. **Tool-Rich Interfaces**: Visualize backend tool outputs
6. **Reasoning Visualization**: Show agent thinking process

## Quick Start

```bash
npx create-ag-ui-app@latest
```

Or build custom clients using `@ag-ui/client`, `@ag-ui/core`.

## Resources

- Documentation: https://docs.ag-ui.com
- AG-UI Dojo (interactive demos): https://dojo.ag-ui.com
- GitHub: https://github.com/ag-ui-protocol/ag-ui
- Discord: https://discord.gg/Jd3FzfdJa8
