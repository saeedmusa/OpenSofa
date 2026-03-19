# OpenSofa Architecture: AG-UI with ACP Transport

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-18 | 1.0 | Initial document - ACP transport + AG-UI architecture |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background and Context](#2-background-and-context)
3. [Current Architecture and Problems](#3-current-architecture-and-problems)
4. [Research Findings](#4-research-findings)
5. [Proposed Architecture](#5-proposed-architecture)
6. [AG-UI Infrastructure](#6-ag-ui-infrastructure)
7. [Implementation Plan](#7-implementation-plan)
8. [File Changes](#8-file-changes)
9. [Testing Strategy](#9-testing-strategy)
10. [Future Roadmap](#10-future-roadmap)

---

## 1. Executive Summary

### 1.1 Goal

Replace the fragile regex-based terminal parsing with structured AG-UI events using AgentAPI's ACP (Agent Client Protocol) transport, while maintaining live terminal display and permission handling.

### 1.2 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary transport | **ACP** | Structured events, all agents supported |
| Fallback | **PTY** | agentapi auto-switches if ACP fails |
| Terminal display | **PTY text logs** | Sufficient for PWA (read-only) |
| Interactive shell | **filebrowser terminal** | WebSocket-based terminal |
| Permissions | **Auto-approve (MVP)** | Sandbox isolates risk |
| Priority order | **OpenCode first** | Then Claude Code, Codex, Aider |

### 1.3 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     User's Machine                               │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ agentapi (auto-detects ACP vs PTY)                       │   │
│  │                                                           │   │
│  │   If agent supports ACP ──► ACP transport               │   │
│  │       └── Structured events: tool_call, chunk, etc.      │   │
│  │       └── Via SSE /events endpoint                      │   │
│  │                                                           │   │
│  │   If ACP unavailable ──► PTY transport                  │   │
│  │       └── Raw terminal text via tmux pipe-pane          │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              OpenSofa Backend                              │   │
│  │                                                            │   │
│  │  ACP events ────────┐                                      │   │
│  │  (structured)       │                                      │   │
│  │                     ├──► Unified Event Pipeline ───────►   │   │
│  │  PTY text ──────────┤     Activity Feed + Terminal View   │   │
│  │  (raw logs)         │                                      │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    PWA Frontend                            │   │
│  │   ActivityFeed (cards)  │  Terminal View (xterm.js)         │   │
│  │   filebrowser Terminal (interactive shell)                 │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Background and Context

### 2.1 Original Problem

OpenSofa uses AgentAPI to spawn coding agents (OpenCode, Claude Code, Codex, Aider) and display their activity in a mobile-friendly PWA. The original implementation used **regex parsing** of terminal output to reconstruct agent events.

### 2.2 Why Regex Was Problematic

| Issue | Impact |
|-------|-------|
| **Brittle patterns** | 60+ regex patterns across 3 files |
| **Agent-specific** | Different patterns per agent type |
| **Double parsing** | AgentAPI parses terminal → OpenSofa parses again |
| **No structured data** | Can't distinguish tool input/output |
| **Race conditions** | Timing-dependent regex matching for approvals |

### 2.3 AG-UI Protocol

AG-UI (Agent-User Interaction Protocol) is an open, event-based protocol that standardizes real-time communication between AI agents and user-facing applications.

**Key features:**
- 17 defined event types covering full agent lifecycle
- Streaming JSON over SSE or WebSocket
- Framework-agnostic
- Well-defined Zod schemas

### 2.4 Prior Discovered Infrastructure

OpenSofa already has **built but unwired** AG-UI infrastructure:

| Component | Location | Status |
|-----------|----------|--------|
| Zod Schemas | `src/web/ag-ui-events.ts` | ✅ Complete (436 lines) |
| JSONL Parser | `src/web/event-parser/jsonl-parser.ts` | ✅ Complete (242 lines) |
| Event Mapper | `src/web/event-parser/mapper.ts` | ✅ Complete (512 lines) |
| Adapter Registry | `src/web/agent-adapters/mod.ts` | ✅ Complete (98 lines) |
| OpenCode Adapter | `src/web/agent-adapters/opencode-adapter.ts` | ✅ Complete (123 lines) |
| Claude Adapter | `src/web/agent-adapters/claude-adapter.ts` | ✅ Complete (306 lines) |
| Aider Adapter | `src/web/agent-adapters/aider-adapter.ts` | ✅ Complete (267 lines) |

**Problem**: This infrastructure was never connected to actual agent output.

### 2.5 Phase 1 Completed

Before this architecture work, Phase 1 fixed immediate build/test failures:
- Frontend build error (missing `eventId`) - Fixed
- TabBar test failure - Fixed
- E2E rate limiting failures - Fixed
- E2E tests: 24 passed, 9 skipped

---

## 3. Current Architecture and Problems

### 3.1 Current Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CURRENT ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐      ┌─────────────┐      ┌─────────────────────────────┐
  │   Agent     │      │  AgentAPI   │      │     OpenSofa Backend       │
  │ (OpenCode,  │      │  (tmux +    │      │                            │
  │  Claude,    │─────▶│  HTTP       │─────▶│  ┌─────────────────────┐  │
  │  Aider...)  │      │  Server)    │      │  │ ActivityParser      │  │
  │             │      │             │      │  │ (REGEX PATTERNS!)  │  │
  └─────────────┘      └─────────────┘      │  └──────────┬──────────┘  │
                                              │             │             │
                                              │   ┌────────▼────────┐   │
                                              │   │ Permission      │   │
                                              │   │ Classifier      │   │
                                              │   │ (REGEX!)        │   │
                                              │   └────────┬────────┘   │
                                              └─────────────┼───────────┘
                                                            │
                                                            ▼
                                              ┌─────────────────────────────┐
                                              │   WebSocket Broadcaster     │
                                              └─────────────┬───────────────┘
                                                            │
                                                            ▼
                                              ┌─────────────────────────────┐
                                              │       PWA Frontend          │
                                              │  ┌───────────────────────┐  │
                                              │  │    ActivityFeed      │  │
                                              │  │  (ActivityCard)     │  │
                                              │  └───────────────────────┘  │
                                              └─────────────────────────────┘
```

### 3.2 Current Event Flow Problems

1. **Agent outputs to PTY** → AgentAPI captures terminal output
2. **AgentAPI parses terminal into messages** → via diff-based splitting
3. **OpenSofa receives SSE events** → raw terminal text
4. **OpenSofa parses text with REGEX** → tries to reconstruct events
5. **Information loss at step 2-3** → AG-UI infrastructure unused

### 3.3 AgentAPI Limitations

AgentAPI has **5 endpoints only**:

| Endpoint | What it does |
|---|---|
| `GET /status` | Returns `running` or `stable` + agent type + transport (`pty` or `acp`) |
| `GET /messages` | Full conversation history (role, content, timestamp, ID) |
| `POST /message` | Send a `user` message or `raw` keystrokes to the terminal |
| `GET /events` | SSE stream: `message_update`, `status_change`, `agent_error` |
| `POST /upload` | Upload a file to the agent's working directory |

**Key insight**: In PTY mode, `message_update` contains **terminal-formatted text** (80-char lines), not structured events.

### 3.4 ACP Transport Mode

AgentAPI supports an **experimental ACP (Agent Client Protocol)** transport:

| Mode | How it works | Structured events? |
|------|--------------|-------------------|
| **PTY (default)** | Terminal emulator + diff-based message parsing | ❌ No - just text diffs |
| **ACP (experimental)** | Direct stdio with ACP protocol | 🟡 Partial - chunks + formatted tool calls as text |

ACP is a JSON-RPC protocol for structured agent-IDE communication:
- Permissions, tools, file context, MCP integration
- Native to Claude Code, OpenCode, etc.
- AgentAPI auto-switches: ACP if agent supports it, PTY fallback

---

## 4. Research Findings

### 4.1 Agent Structured Output Capabilities

| Agent | JSON Output Mode | Structured Tool Calls | Notes |
|-------|----------------|----------------------|-------|
| **OpenCode** | `--format json` | ✅ Full JSONL | Native JSONL to stdout |
| **Claude Code** | `--print --output-format=stream-json` | 🟡 Streaming JSON | Anthropic API format |
| **Codex** | `--json` | ✅ `item.*` events | File changes included |
| **Aider** | `--json` (undocumented) | ✅ `tool_calls`, `tool_result` | File ops included |

### 4.2 Sandbox Agent SDK Evaluation

**Claimed benefits:**
- Universal TypeScript SDK
- Single interface for all agents
- Runs inside sandbox (E2B/Daytona/Docker)

**Reality:**
- Still parses terminal internally
- Requires sandbox provider account + API keys
- Overkill for local execution

**Decision**: Not adopted. Current agentapi + ACP approach is sufficient.

### 4.3 Key Technical Constraints

1. **When agent runs inside PTY, output goes through terminal emulator**
   - JSONL from OpenCode gets "terminalized" before we see it
   - We cannot recover structured form from PTY output

2. **ACP auto-approves permissions by default**
   - MVP acceptable (sandbox isolates risk)
   - Production could add granular control

3. **Terminal display requires PTY or log capture**
   - ACP doesn't handle terminal display
   - Need separate mechanism for live terminal

---

## 5. Proposed Architecture

### 5.1 ACP Primary + PTY Fallback

```
┌─────────────────────────────────────────────────────────────────┐
│                     User's Machine                               │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ agentapi server (ACP transport)                           │   │
│  │                                                           │   │
│  │   ┌─────────────────────────────────────────────────┐    │   │
│  │   │ ACP Protocol (JSON-RPC over stdio)              │    │   │
│  │   │                                                 │    │   │
│  │   │  Events:                                        │    │   │
│  │   │  - SessionUpdate (chunks, tool calls)            │    │   │
│  │   │  - AgentMessage (formatted as text)             │    │   │
│  │   │  - StatusChange (running/stable)               │    │   │
│  │   │                                                 │    │   │
│  │   └─────────────────────────────────────────────────┘    │   │
│  │                          │                               │   │
│  └──────────────────────────┼───────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              OpenSofa Backend                              │   │
│  │                                                            │   │
│  │  ┌────────────────┐    ┌────────────────────────────────┐ │   │
│  │  │ ACP Event      │    │ ACP Message Parser             │ │   │
│  │  │ Parser         │    │ (chunks → structured events)   │ │   │
│  │  └───────┬────────┘    └────────────┬───────────────────┘ │   │
│  │          │                           │                      │   │
│  │          └─────────┬─────────────────┘                      │   │
│  │                    ▼                                        │   │
│  │          ┌─────────────────────┐                           │   │
│  │          │ ACP → AG-UI Mapper   │                           │   │
│  │          │                     │                           │   │
│  │          │ ToolCall → Activity │                           │   │
│  │          │ TextChunk → Message  │                           │   │
│  │          └──────────┬──────────┘                           │   │
│  │                     │                                        │   │
│  │                     ▼                                        │   │
│  │          ┌─────────────────────┐                           │   │
│  │          │ ActivityEvent[]      │                           │   │
│  │          │ (unified events)     │                           │   │
│  │          └──────────┬──────────┘                           │   │
│  │                     │                                        │   │
│  │          ┌──────────▼──────────┐                           │   │
│  │          │ WebSocket Broadcaster │                          │   │
│  │          └──────────┬──────────┘                           │   │
│  └─────────────────────┼────────────────────────────────────────┘   │
│                        │                                              │
│                        ▼                                              │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    PWA Frontend                            │   │
│  │   ActivityFeed (cards)  │  filebrowser Terminal (shell)   │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

### 5.2 Terminal Display Path

For live terminal display, we use **tmux pipe-pane** separately from agentapi:

```
┌────────────────────────────────────────────────────────────┐
│  tmux session (separate from agentapi)                     │
│                                                            │
│  ┌──────────────────────┐   ┌───────────────────────────┐  │
│  │ opencode (PTY mode)  │──▶│ tmux pipe-pane           │  │
│  │ for terminal display │   │ → /tmp/terminal-{port}.log│  │
│  └──────────────────────┘   └───────────┬───────────────┘  │
│                                         │                   │
└─────────────────────────────────────────┼───────────────────┘
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │ terminal-stream.ts            │
                          │ (reads log file)              │
                          │                               │
                          │ Sends to frontend via WS      │
                          └───────────────────────────────┘
```

### 5.3 Event Flow Comparison

| Phase | Current (PTY) | Proposed (ACP) |
|-------|--------------|----------------|
| Agent output | Terminal text | Structured JSON-RPC |
| Capture | PTY emulator | ACP stdio |
| Parse | REGEX | ACP parser |
| Map to AG-UI | ❌ | ✅ |
| Map to Activity | REGEX | ACP → AG-UI Mapper |
| Terminal | tmux pipe-pane | tmux pipe-pane |

### 5.4 Features Maintained

| Feature | Status | Notes |
|---------|--------|-------|
| Live terminal display | ✅ | Via tmux pipe-pane |
| Permission handling | ✅ | Auto-approved in ACP (MVP) |
| Agent lifecycle (start/stop) | ✅ | Via agentapi |
| Session persistence | ❌ | ACP limitation |
| Interactive shell | ✅ | filebrowser terminal |
| All 4 agents | ✅ | ACP supported |

### 5.5 Features Lost (vs Regex Parser)

| Feature | Status | Notes |
|---------|--------|-------|
| Regex-based approval detection | ❌ | Auto-approve in MVP |
| State persistence | ❌ | ACP doesn't support |

---

## 6. AG-UI Infrastructure

### 6.1 Existing Files (Built, Not Wired)

```
src/web/
├── ag-ui-events.ts          # Zod schemas (16+ event types, 436 lines)
├── event-parser/
│   ├── mod.ts               # Exports (jsonl-parser, mapper)
│   ├── jsonl-parser.ts      # JSONL parsing (242 lines)
│   └── mapper.ts            # AG-UI → ActivityEvent mapping (512 lines)
└── agent-adapters/
    ├── mod.ts               # Adapter registry (98 lines)
    ├── opencode-adapter.ts  # OpenCode → AG-UI (123 lines)
    ├── claude-adapter.ts    # Claude → AG-UI (306 lines)
    └── aider-adapter.ts     # Aider → AG-UI (267 lines)
```

### 6.2 AG-UI Event Types

```typescript
// Core event types
type AGUIEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | StepStartedEvent
  | StepFinishedEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | StateSnapshotEvent
  | StateDeltaEvent
  | PermissionRequestEvent
  | CustomEvent;
```

### 6.3 Mapping: ACP → AG-UI → ActivityEvent

| ACP Event | AG-UI Event | ActivityEvent |
|-----------|-------------|---------------|
| `SessionUpdate.AgentMessageChunk` | `TextMessageContent` | `agent_message` |
| `SessionUpdate.ToolCall` | `ToolCallStart` | `command_run` |
| `SessionUpdate.ToolCallUpdate.Status` | `ToolCallResult` | varies |
| `StatusChange` | `RunStarted`/`RunFinished` | status change |

### 6.4 ACP Event Schema (from agentapi)

```go
// ACP SessionUpdate notification
type SessionUpdate struct {
    AgentMessageChunk *AgentMessageChunk `json:"agentMessageChunk,omitempty"`
    ToolCall          *ToolCall          `json:"toolCall,omitempty"`
    ToolCallUpdate    *ToolCallUpdate    `json:"toolCallUpdate,omitempty"`
}

type AgentMessageChunk struct {
    Content struct {
        Text *struct {
            Text string `json:"text,omitempty"`
        } `json:"text,omitempty"`
    } `json:"content,omitempty"`
}

type ToolCall struct {
    Kind   string `json:"kind"`
    Title  string `json:"title"`
}

type ToolCallUpdate struct {
    Status *string `json:"status,omitempty"` // "completed", "failed"
}
```

---

## 7. Implementation Plan

### Phase 1: Enable ACP + Wire Events (OpenCode Only)

**Goal**: Get structured events flowing for OpenCode

#### Step 1.1: Add ACP Flag to AgentAPI Spawn

**File**: `src/agent-registry.ts`

```typescript
// In buildSpawnArgs(), add experimental_acp flag
const args = [
  'server',
  `--port=${port}`,
  `--type=${def.agentApiType}`,
  '--experimental-acp',  // NEW: Enable ACP transport
  `--term-width=${termWidth}`,
  `--term-height=${termHeight}`,
  '--',
  def.binary,
];
```

#### Step 1.2: Create ACP Event Parser

**File**: `src/web/event-parser/acp-parser.ts` (NEW, ~80 lines)

```typescript
import { EventEmitter } from 'events';

interface ACPSessionUpdate {
  AgentMessageChunk?: {
    Content: { Text?: { Text?: string } };
  };
  ToolCall?: { Kind: string; Title: string };
  ToolCallUpdate?: { Status?: string };
}

interface ACPStatusChange {
  Status: 'running' | 'stable';
  AgentType: string;
}

export class ACPEventParser extends EventEmitter {
  parseSessionUpdate(update: ACPSessionUpdate): void;
  parseStatusChange(change: ACPStatusChange): void;
}
```

#### Step 1.3: Wire ACP Events to Activity Feed

**File**: `src/web/server.ts`

```typescript
// In wireSessionEvents(), handle ACP transport
if (session.transport === 'acp') {
  // Parse ACP events directly
  const acpParser = new ACPEventParser();
  acpParser.on('tool_call', (tool) => {
    const activity = mapToolCallToActivity(tool, session.name);
    broadcaster.broadcast(createEvent('activity', { sessionName: session.name, events: [activity] }));
  });
  acpParser.on('text_chunk', (chunk) => {
    const activity = mapTextChunkToActivity(chunk, session.name);
    broadcaster.broadcast(createEvent('activity', { sessionName: session.name, events: [activity] }));
  });
}
```

#### Step 1.4: Test with OpenCode

- Start session with OpenCode
- Verify structured tool calls appear in activity feed
- Verify text streaming works
- Verify terminal display still works

### Phase 2: Delete Regex Parser

**Goal**: Remove fragile code

#### Step 2.1: Identify Regex Parser Usage

```bash
grep -r "parseTerminalOutput" src/
# Output:
# src/web/server.ts:209
```

#### Step 2.2: Remove Regex Parser

**File**: `src/web/activity-parser.ts`

- Delete `parseTerminalOutput()` function
- Remove regex patterns
- Keep types/interfaces if still needed

#### Step 2.3: Update References

**File**: `src/web/server.ts`

```typescript
// BEFORE (line 209):
const events = parseTerminalOutput(output, session.name, session.agentType as AgentType);

// AFTER:
const events = []; // Events come from ACP parser, not terminal
```

### Phase 3: Add PTY Fallback

**Goal**: Ensure terminal works when ACP unavailable

#### Step 3.1: Keep Terminal Stream

No changes needed - `terminal-stream.ts` already handles this.

#### Step 3.2: Verify Fallback

- Disable ACP (remove `--experimental-acp` flag)
- Verify PTY mode kicks in
- Verify terminal still displays

### Phase 4: Verify All Agents

**Goal**: ACP works across all 4 agents

| Agent | Test Sequence | Expected |
|-------|--------------|----------|
| OpenCode | 1. Start session | ACP events + terminal |
| Claude Code | 2. Start session | ACP events + terminal |
| Codex | 3. Start session | ACP events + terminal |
| Aider | 4. Start session | ACP events + terminal |

---

## 8. File Changes

### 8.1 New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/web/event-parser/acp-parser.ts` | ~80 | Parse ACP SSE events |
| `src/web/event-parser/acp-mapper.ts` | ~60 | ACP → AG-UI mapping |

### 8.2 Modified Files

| File | Change | Lines |
|------|--------|-------|
| `src/agent-registry.ts` | Add `--experimental-acp` flag | ~5 |
| `src/web/server.ts` | Wire ACP events to activity feed | ~30 |
| `src/web/activity-parser.ts` | Delete regex parser | ~200 deleted |

### 8.3 Deleted Files

None.

### 8.4 Files Ready to Use (Already Built)

| File | Status |
|------|--------|
| `src/web/ag-ui-events.ts` | ✅ Ready - Zod schemas |
| `src/web/event-parser/jsonl-parser.ts` | ✅ Ready - JSONL parsing |
| `src/web/event-parser/mapper.ts` | ✅ Ready - AG-UI mapping |
| `src/web/agent-adapters/opencode-adapter.ts` | ✅ Ready - OpenCode adapter |

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Component | Test |
|-----------|------|
| ACP Event Parser | Parse sample SessionUpdate JSON |
| ACP → AG-UI Mapper | Map tool_call to ActivityEvent |
| ACP → ActivityEvent Mapper | Full event transformation |

### 9.2 Integration Tests

| Test | Steps |
|------|-------|
| OpenCode session with ACP | 1. Start OpenCode session |
| | 2. Send message |
| | 3. Verify structured events in activity feed |
| | 4. Verify terminal display works |
| PTY fallback | 1. Disable ACP |
| | 2. Start session |
| | 3. Verify PTY activates |
| | 4. Verify terminal works |

### 9.3 E2E Tests

| Test | Purpose |
|------|---------|
| Full session flow | Start → Message → Activity → Terminal |
| Multiple agents | Test all 4 agents |

---

## 10. Future Roadmap

### 10.1 Phase 2 (Future): Claude Code

- Enable ACP for Claude Code
- Verify stream-json events map correctly
- Handle Claude-specific permission requests

### 10.2 Phase 3 (Future): Codex + Aider

- Enable ACP for Codex
- Enable ACP for Aider
- Verify tool_call events

### 10.3 Phase 4 (Future): Granular Permissions

- Add `canUseTool` callback for ACP
- Implement permission approval UI
- Add permission audit log

### 10.4 Phase 5 (Future): Session Persistence

- Investigate state persistence for ACP
- Consider agent-native state APIs
- Add session resume functionality

---

## Appendix A: Key References

- [AgentAPI GitHub](https://github.com/coder/agentapi)
- [ACP Protocol Spec](https://agentclientprotocol.com/protocol/transports)
- [AG-UI Protocol](https://github.com/rivet-dev/ag-ui)
- [OpenCode Docs](https://opencode.ai/docs/)

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| ACP | Agent Client Protocol - JSON-RPC protocol for agent-IDE communication |
| AG-UI | Agent-User Interaction Protocol - Standardized event protocol |
| PTY | Pseudo-Terminal - Terminal emulator |
| JSONL | JSON Lines - One JSON object per line |
| SSE | Server-Sent Events - HTTP streaming protocol |

---

*Document created: 2026-03-18*
