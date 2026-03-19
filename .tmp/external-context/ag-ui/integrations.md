---
source: Official AG-UI Documentation (docs.ag-ui.com)
library: AG-UI Protocol
package: ag-ui
topic: integrations
fetched: 2026-03-18T00:00:00Z
official_docs: https://docs.ag-ui.com
---

# AG-UI Integrations Reference

## Supported Integrations Overview

AG-UI was born from CopilotKit's partnership with LangGraph and CrewAI, bringing agent-user-interactivity to the wider ecosystem.

## Agent Frameworks - 1st Party

| Framework | Status | Resources |
|----------|--------|-----------|
| Microsoft Agent Framework | Supported | [Docs](https://docs.copilotkit.ai/microsoft-agent-framework) |
| Google ADK | Supported | [Docs](https://docs.copilotkit.ai/adk) |
| AWS Strands Agents | Supported | [Docs](https://docs.copilotkit.ai/aws-strands) |
| Mastra | Supported | [Docs](https://docs.copilotkit.ai/mastra/) |
| Pydantic AI | Supported | [Docs](https://docs.copilotkit.ai/pydantic-ai/) |
| Agno | Supported | [Docs](https://docs.copilotkit.ai/agno/) |
| LlamaIndex | Supported | [Docs](https://docs.copilotkit.ai/llamaindex/) |
| AG2 | Supported | [Docs](https://docs.copilotkit.ai/ag2/) |
| AWS Bedrock Agents | In Progress | - |

## Agent Frameworks - Partnerships

| Framework | Status | Resources |
|----------|--------|-----------|
| LangGraph | Supported | [Docs](https://docs.copilotkit.ai/langgraph/), [Demos](https://dojo.ag-ui.com/langgraph-fastapi/feature/shared_state) |
| CrewAI | Supported | [Docs](https://docs.copilotkit.ai/crewai-flows), [Demos](https://dojo.ag-ui.com/crewai/feature/shared_state) |

## Agent Frameworks - Community

| Framework | Status | Resources |
|----------|--------|-----------|
| OpenAI Agent SDK | In Progress | - |
| Cloudflare Agents | In Progress | - |

## Agent Interaction Protocols

| Protocol | Status | Resources | Integrations |
|----------|--------|-----------|--------------|
| A2A Middleware | Supported | [Docs](https://docs.copilotkit.ai/a2a-protocol) | Partnership |

## Infrastructure / Deployment

| Platform | Status | Resources | Integrations |
|----------|--------|-----------|--------------|
| Amazon Bedrock AgentCore | Supported | [Docs](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-agui.html) | 1st Party |

## Specification

| Framework | Status | Resources |
|-----------|--------|-----------|
| Oracle Agent Spec | Supported | [Docs](https://go.copilotkit.ai/copilotkit-oracle-docs) |

## SDKs

| SDK | Language | Status | Resources |
|-----|----------|--------|-----------|
| @ag-ui/client | TypeScript/JS | Core | Main client SDK |
| @ag-ui/core | TypeScript/JS | Core | Core event types |
| @ag-ui/mastra | TypeScript/JS | Core | Mastra integration |
| Kotlin SDK | Kotlin | Supported | [GitHub](https://github.com/ag-ui-protocol/ag-ui/blob/main/docs/sdk/kotlin/overview.mdx) |
| Golang SDK | Go | Supported | [GitHub](https://github.com/ag-ui-protocol/ag-ui/blob/main/docs/sdk/go/overview.mdx) |
| Dart SDK | Dart | Supported | [GitHub](https://github.com/ag-ui-protocol/ag-ui/tree/main/sdks/community/dart) |
| Java SDK | Java | Supported | [GitHub](https://github.com/ag-ui-protocol/ag-ui/blob/main/docs/sdk/java/overview.mdx) |
| Rust SDK | Rust | Supported | [GitHub](https://github.com/ag-ui-protocol/ag-ui/tree/main/sdks/community/rust/crates/ag-ui-client) |
| .NET SDK | C# | In Progress | [PR](https://github.com/ag-ui-protocol/ag-ui/pull/38) |
| Nim SDK | Nim | In Progress | [PR](https://github.com/ag-ui-protocol/ag-ui/pull/29) |
| Flowise | - | In Progress | [GitHub](https://github.com/ag-ui-protocol/ag-ui/issues/367) |
| Langflow | - | In Progress | [GitHub](https://github.com/ag-ui-protocol/ag-ui/issues/366) |

## Clients

| Client | Status | Resources |
|--------|--------|-----------|
| CopilotKit | Supported | [Getting Started](https://docs.copilotkit.ai/direct-to-llm/guides/quickstart) |
| Terminal + Agent | Supported | [Getting Started](https://docs.ag-ui.com/quickstart/clients) |
| React Native | Help Wanted | [GitHub](https://github.com/ag-ui-protocol/ag-ui/issues/510) |

## Direct to LLM

| Framework | Status | Resources |
|-----------|--------|-----------|
| Direct to LLM | Supported | [Docs](https://docs.copilotkit.ai/direct-to-llm) |

## Quick Start with CopilotKit

CopilotKit is the primary frontend SDK for AG-UI:

```bash
npx create-ag-ui-app@latest
```

### Example: TypeScript Client

```typescript
import { HttpAgent } from "@ag-ui/client"
import { EventType } from "@ag-ui/core"

const agent = new HttpAgent({
  url: "https://your-agent-endpoint.com/agent",
  agentId: "unique-agent-id",
  threadId: "conversation-thread"
})

agent.runAgent({
  tools: [...],
  context: [...]
}).subscribe({
  next: (event) => {
    switch(event.type) {
      case EventType.TEXT_MESSAGE_CONTENT:
        // Update UI with new content
        break
      case EventType.TOOL_CALL_START:
        // Show tool call notification
        break
      case EventType.STATE_SNAPSHOT:
        // Update state
        break
    }
  },
  error: (error) => console.error("Agent error:", error),
  complete: () => console.log("Agent run complete")
})
```

## Building Custom Clients

### CLI Client Example (Mastra)

```typescript
import { MastraAgent } from "@ag-ui/mastra"
import { Agent } from "@mastra/core/agent"

const agent = new MastraAgent({
  resourceId: "cliExample",
  agent: new Agent({
    id: "ag-ui-assistant",
    name: "AG-UI Assistant",
    instructions: "You are a helpful AI assistant...",
    model: "openai/gpt-4o",
  }),
  threadId: "main-conversation",
})

// Run with event handlers
await agent.runAgent(
  {},
  {
    onTextMessageStartEvent() {
      process.stdout.write("Assistant: ")
    },
    onTextMessageContentEvent({ event }) {
      process.stdout.write(event.delta)
    },
    onTextMessageEndEvent() {
      console.log("\n")
    },
    onToolCallStartEvent({ event }) {
      console.log("Tool call:", event.toolCallName)
    },
    onToolCallResultEvent({ event }) {
      console.log("Result:", event.content)
    },
  }
)
```

## AG-UI Dojo

The [AG-UI Dojo](https://dojo.ag-ui.com/) provides interactive demos:
- Streaming chat
- Multimodality
- Generative UI (static & declarative)
- Shared state
- Tool rendering
- Human-in-the-loop interrupts
- Sub-agents
- Agent steering

Each demo shows both the user-visible interaction and underlying code.

## Comparison with Alternatives

### AG-UI vs Direct Integration

**AG-UI Advantages:**
- Standardized event types
- Transport agnostic (SSE, WebSockets, HTTP)
- Built-in state management
- Tool call support
- Reasoning visibility
- Generative UI support
- Interoperability between frameworks

**Direct Integration:**
- Simpler for single-framework use
- May have lower latency
- No protocol overhead

### AG-UI vs CopilotKit

CopilotKit is a frontend SDK that uses AG-UI internally. For building agentic applications with rich UIs, CopilotKit provides:
- Pre-built UI components
- React hooks
- State management
- Session handling

For raw AG-UI protocol access, use `@ag-ui/client` directly.

## Integration Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend   │────▶│ AG-UI Client │────▶│ Agent       │
│  (App/UI)   │◀────│ (HttpAgent)  │◀────│ (LangGraph, │
└─────────────┘     └──────────────┘     │ Mastra,etc) │
                                         └─────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
               ┌────▼────┐   ┌─────────┐   ┌────▼────┐   ┌─────────┐
               │   MCP   │   │   A2A   │   │  Tools  │   │ Memory  │
               │(Tools)  │   │(Agents) │   │         │   │         │
               └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

## Resources

- Official Docs: https://docs.ag-ui.com
- AG-UI Dojo: https://dojo.ag-ui.com
- GitHub: https://github.com/ag-ui-protocol/ag-ui
- Discord: https://discord.gg/Jd3FzfdJa8
- CopilotKit Docs: https://docs.copilotkit.ai
