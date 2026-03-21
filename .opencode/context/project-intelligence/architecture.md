---
title: Sandwich Architecture
category: project-intelligence
type: architecture
version: 1.0
created: 2026-03-21
updated: 2026-03-21
tags: [architecture, data-flow, modules, agentapi, acp, websocket]
related: [tech-stack.md, current-state.md, code-quality.md]
codebase_references:
  - path: src/
    description: Backend source code
  - path: src/web/frontend/
    description: React PWA frontend
  - path: docs/ARCHITECTURAL_GAP_ANALYSIS.md
    lines: 140-206
    description: Current architecture audit and data flow
---

# Sandwich Architecture

## Core Principle

**Phone = Display/Input, Laptop = Compute**

OpenSofa is a mobile PWA that remotely controls AI coding agents running on a user's laptop. The "sandwich" layers:

```
┌─────────────────────────────────────┐
│         Mobile PWA (React)          │  ← Display & Input
├─────────────────────────────────────┤
│      WebSocket + HTTP Bridge        │  ← Communication
├─────────────────────────────────────┤
│    OpenSofa Backend (Hono/Node)     │  ← Orchestration
├─────────────────────────────────────┤
│  AgentAPI (tmux + HTTP, localhost)  │  ← Agent Management
├─────────────────────────────────────┤
│    AI Agents (Claude/Code/etc)      │  ← Compute
└─────────────────────────────────────┘
```

## Data Flow (Current)

```
Agent (claude/opencode/aider)
  │
  ▼
AgentAPI (tmux + HTTP server, localhost:3284+N)
  │
  ├── GET /events (SSE)
  │     ├── event: "message_update"  → { id, message, role, time }
  │     ├── event: "status_change"   → { agent_type, status }
  │     └── event: "SessionUpdate"   → { AgentMessageChunk, ToolCall, ToolCallUpdate }
  │
  ├── GET /messages → { messages: [{ id, content, role, time }] }
  │
  ├── POST /message → { ok: true }
  │
  └── POST /upload → { filePath, ok }
  │
  ▼
OpenSofa Backend
  │
  ├── FeedbackController (SSE listener)
  │     ├── Handles "message_update" → extracts text delta
  │     ├── Handles "status_change" → updates agent status
  │     └── Handles "SessionUpdate" → parses ACP events
  │
  ├── ACPEventParser
  │     ├── Parses SessionUpdate.AgentMessageChunk → emits 'text_chunk'
  │     ├── Parses SessionUpdate.ToolCall → emits 'tool_call'
  │     └── Parses SessionUpdate.ToolCallUpdate → emits 'tool_call_update'
  │
  ├── AgentStateMachine (NEW - replaces regex)
  │     ├── States: IDLE → WORKING → ANALYZING → AWAITING_INPUT/COMPLETED
  │     └── Driven by: status_change + GET /messages + String.includes()
  │
  └── WebSocket Broadcaster → PWA Frontend
```

## Key Modules

### Backend (`src/`)

| Module | Purpose | Key Files |
|--------|---------|-----------|
| **SessionManager** | Agent lifecycle, session CRUD | `session-manager.ts` |
| **FeedbackController** | SSE listener, event routing | `feedback-controller.ts` |
| **ACPEventParser** | Parse ACP structured events | `web/event-parser/acp-parser.ts` |
| **AgentStateMachine** | Permission detection (no regex) | `agent-state-machine.ts` (NEW) |
| **Discovery** | Auto-discover agents/projects/MCP | `discovery/` (NEW) |
| **Database** | SQLite persistence | `db.ts` |
| **WebSocket** | Real-time updates to PWA | `web/broadcaster.ts` |

### Frontend (`src/web/frontend/`)

| Module | Purpose | Key Files |
|--------|---------|-----------|
| **Views** | Page-level components | `views/HomeView.tsx`, `SessionView.tsx` |
| **Components** | Reusable UI | `components/ActivityFeed.tsx`, `Terminal.tsx` |
| **Providers** | Context/state | `providers/WebSocketProvider.tsx` |
| **Hooks** | Custom React hooks | `hooks/usePullToRefresh.ts` |

## Communication Patterns

### Backend → Frontend
- **WebSocket** for real-time events (activity, status, messages)
- **REST API** for CRUD operations (sessions, files, settings)
- **SSE** from AgentAPI → Backend (not directly to frontend)

### Frontend → Backend
- **REST API** for actions (create session, send message, approve)
- **WebSocket** for sync (reconnect, missed events)

## State Management

### Backend State
- **Sessions:** In-memory Map + SQLite persistence
- **Events:** Ring buffer in Broadcaster (last 1000 events)
- **Conversations:** SQLite (NEW - currently not persisted)

### Frontend State
- **Zustand stores** for client-side state
- **React Query** for server state (sessions, files)
- **WebSocket context** for real-time updates

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Hono over Express** | Lightweight, TypeScript-first, edge-ready |
| **SQLite over Postgres** | Zero-config, embedded, perfect for single-user |
| **WebSocket over polling** | Real-time updates, lower latency |
| **State machine over regex** | Deterministic, maintainable, works for any agent |
| **ACP-first, PTY-fallback** | Structured data when available, terminal as backup |
