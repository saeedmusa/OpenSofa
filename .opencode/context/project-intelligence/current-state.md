---
title: Current Project State
category: project-intelligence
type: concept
version: 1.0
created: 2026-03-21
updated: 2026-03-21
tags: [status, gaps, roadmap, priorities, mvp]
related: [architecture.md, tech-stack.md]
codebase_references:
  - path: docs/ARCHITECTURAL_GAP_ANALYSIS.md
    lines: 1-768
    description: Full gap analysis and architectural audit
  - path: docs/USER_STORIES_V2.md
    lines: 1-1114
    description: Complete user stories and implementation plan
---

# Current Project State

## What's Built ✅

### Core Infrastructure
- **Session Management** — Create, list, switch, stop sessions
- **AgentAPI Integration** — SSE events, message sending, file upload
- **WebSocket Broadcaster** — Real-time updates to PWA frontend
- **SQLite Database** — Session persistence
- **Hono Web Server** — REST API + static file serving

### Agent Interaction
- **Send prompts** to agents via POST /message
- **Stream responses** via SSE message_update events
- **Stop/interrupt** agent (Ctrl+C)
- **Multi-line input** support
- **Voice input** capability
- **Quick command palette**

### File Operations
- **File browser** — Browse directory tree
- **File viewer** — Read files with syntax highlighting
- **Git diff viewer** — See changes

### Network Resilience
- **Auto-reconnect WebSocket** — Handles connection drops
- **Page visibility detection** — Syncs on app resume
- **Offline message queue** — Queues messages when offline
- **Session state recovery** — Restores state after reconnect

### Mobile PWA
- **Installable** — Add to home screen
- **Push notifications** — VAPID-based alerts
- **Terminal controls** — Mobile-optimized keyboard
- **Pull-to-refresh** — Gesture support

## What's Partial ⚠️

### Permission Detection
- **Current:** 60+ regex patterns in `PermissionClassifier`
- **Problem:** Fragile, breaks when agents update output format
- **Target:** State machine using AgentAPI signals (zero regex)

### Model Discovery
- **Current:** Only Claude Code + OpenCode adapters
- **Missing:** Aider, Goose, Gemini, Codex adapters
- **Target:** All installed agents' models discoverable

### ACP Event Parsing
- **Current:** Captures Kind, Title, Status from ToolCall
- **Missing:** toolCallId, content, locations, rawInput/rawOutput
- **Limitation:** AgentAPI v0.12.1 doesn't expose full ACP schema yet

## What's Missing ❌

### Critical Gaps (P0)

| Gap | Impact | Fix Effort |
|-----|--------|------------|
| **GET /messages ignored** | No conversation history | 20 lines |
| **No project auto-discovery** | Manual directory browsing | Medium |
| **No MCP server discovery** | Zero MCP awareness | Medium |
| **Regex permission detection** | Fragile, high maintenance | Large (state machine) |

### Significant Gaps (P1)

| Gap | Impact | Fix Effort |
|-----|--------|------------|
| **No conversation persistence** | History lost on stop | Medium |
| **No crash recovery** | Sessions die silently | Medium |
| **No files-changed view** | Can't see session edits | Small |
| **No session restart UI** | Backend exists, no route | Small |

### Future Gaps (P2)

| Gap | Impact | Fix Effort |
|-----|--------|------------|
| **No MCP management** | Can't add/remove servers | Medium |
| **No session templates** | Repetitive setup | Small |
| **No model switching UI** | Backend supports, no frontend | Small |
| **No conversation search** | Can't find past sessions | Large |

## Implementation Roadmap

### Sprint 0: Quick Wins (6 points, 2-3 days)
- Wire `/messages` endpoint (20-line fix → conversation history)
- Session restart API + UI
- Handle `agent_error` SSE events

### Sprint 1: Foundation (20 points)
- Replace destructive patterns with token matching
- Extend ACP parser for full schema
- Build state machine for permission detection
- Project auto-discovery
- MCP server auto-discovery

### Sprint 2: Experience (12 points)
- Use ACP Kind for activity mapping
- Conversation history display
- Complete model discovery
- Environment variable status display

### Sprint 3-6: Features & Polish (53 points)
- MCP display and tool discovery
- Conversation persistence
- Files changed view
- Crash recovery
- Session templates
- Mobile enhancements

## Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **Requirements met** | 15/44 (34%) | 44/44 (100%) |
| **Regex patterns** | 76+ (3 files) | 0 (zero regex) |
| **Agent adapters** | 2/12 | 12/12 |
| **MCP awareness** | 0% | 100% |
| **Conversation persistence** | None | SQLite |

## Architecture Principles

1. **Zero regex** — State machines + `String.includes()` token matching
2. **Zero setup** — Auto-discover everything from laptop
3. **ACP-first** — Structured protocol events over terminal parsing
4. **MCP-native** — MCP servers as first-class entities
5. **Conversation-aware** — Persistent history across sessions

## Next Steps

**Immediate (this week):**
1. Add `getMessages()` to `agentapi-client.ts` — highest impact, lowest effort
2. Wire conversation history route in `sessions.ts`
3. Build basic conversation display in frontend

**Short-term (next 2 weeks):**
1. Implement project auto-discovery
2. Implement MCP config reading (read-only)
3. Replace regex permission detection with state machine

**Reference:** See `docs/USER_STORIES_V2.md` for complete story breakdown and dependency graph.
