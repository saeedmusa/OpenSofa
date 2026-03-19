# WhatsApp Coding Interface Architecture Tasks

Created: 2026-02-10

## Overview

This task breakdown follows the systematic architecture approach you requested:
1. **Functional Requirements** - What the system must do
2. **Non-Functional Requirements** - How the system must perform
3. **Nanobot Deep Review** - What exists vs what to build
4. **Requirements Mapping** - How solution meets requirements
5. **Architectural Design** - Complete system design
6. **Key Elements Identification** - What to build from scratch

## Task List

| Seq | Task | Status | Dependencies | Parallel |
|------|--------|---------|------------|
| 01 | Document Functional Requirements | ❌ None | ✅ Yes |
| 02 | Document Non-Functional Requirements | ❌ None | ✅ Yes |
| 03 | Deep Review of Nanobot Capabilities | ❌ None | ✅ Yes |
| 04 | Map Requirements to Solution Components | ❌ 01, 02, 03 | ❌ No |
| 05 | Architectural Design | ❌ 04 | ❌ No |
| 06 | Identify Key Elements to Build | ❌ 03, 05 | ❌ No |

## Task Details

### Task 01: Document Functional Requirements
**Goal:** List everything the user wants to do from WhatsApp
**Deliverable:** `docs/requirements/functional.md`
**Key Questions:**
- What file operations are needed? (read, write, edit, search, list)
- What terminal features are needed? (execute commands, stream output, persistent sessions)
- What git operations are needed? (status, commit, push, pull, branch, diff)
- What project navigation is needed? (tree view, file search, symbol search)
- What "screen viewing" means? (terminal output streaming, screenshots, or both?)

### Task 02: Document Non-Functional Requirements
**Goal:** Define system quality attributes
**Deliverable:** `docs/requirements/non-functional.md`
**Key Areas:**
- Performance: Response time, latency, throughput
- Security: Authentication, authorization, workspace isolation
- Reliability: Error recovery, reconnection, data integrity
- Usability: WhatsApp message formatting, clear errors
- Scalability: Concurrent users, resource limits
- Maintainability: Logging, monitoring, debugging

### Task 03: Deep Review of Nanobot Capabilities
**Goal:** Understand what exists vs what to build
**Deliverable:** `docs/review/nanobot-capabilities.md`
**Focus Areas:**

**What to review in nanobot:**
1. **Agent Tools** (`nanobot/agent/tools/`)
   - `filesystem.py` - What file ops exist?
   - `shell.py` - What shell capabilities exist?
   - `web.py` - Any remote capabilities?
   - `spawn.py` - Background task handling?

2. **Channels** (`nanobot/channels/`)
   - `whatsapp.py` - How does WhatsApp work?
   - `base.py` - Channel interface?
   - `manager.py` - Channel lifecycle?

3. **Agent Core** (`nanobot/agent/`)
   - `loop.py` - How do tools get invoked?
   - `memory.py` - State management?
   - `context.py` - Prompt building?

4. **WhatsApp Bridge** (`nanobot/bridge/src/`)
   - `whatsapp.ts` - Baileys integration?
   - `server.ts` - WebSocket interface?
   - Communication protocol to nanobot?

5. **Message Bus** (`nanobot/bus/`)
   - `queue.py` - Async message handling?
   - `events.py` - Event types?

**Output should answer:**
- ✅ What can we REUSE as-is?
- ✅ What can we EXTEND with minimal changes?
- ❌ What must we BUILD from scratch?
- ✅ Where are the integration points?

### Task 04: Map Requirements to Solution Components
**Goal:** Create traceability matrix
**Deliverables:**
- `docs/architecture/requirements-mapping.md`
- `docs/architecture/gap-analysis.md`

**Mapping Matrix:**
```
| Requirement | Met by Nanobot? | Met by Middleware? | Met by Coding Env? | Gap? |
|-------------|-------------------|----------------------|---------------------|---------|
| Read file   | ✅ (filesystem.py) | ✅ (API layer)    | ✅ (workspace)      | No      |
| Terminal    | ✅ (shell.py)    | ✅ (WebSocket)      | ✅ (tmux)           | No      |
| Stream output | ❌ (no streaming) | ✅ (WebSocket)       | ✅ (xterm.js/tmux)  | ✅      |
```

### Task 05: Architectural Design
**Goal:** Complete system specification
**Deliverables:**
- `docs/architecture/system-architecture.md`
- `docs/architecture/component-boundaries.md`
- `docs/architecture/data-flows.md`
- `docs/architecture/api-contracts.md`

**Architecture Diagram:**
```
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 1: User Interface (WhatsApp)                                 │
│ ┌────────────────────────────────────────────────────────────────────┐   │
│ │ Nanobot (Separate Codebase)                                  │   │
│ │ ├─ WhatsApp Bridge (Node.js + Baileys)                       │   │
│ │ ├─ Channel Manager                                             │   │
│ │ ├─ Agent Loop (LLM + Tools)                                   │   │
│ │ └─ Tools: filesystem, shell, web, spawn (EXISTING)           │   │
│ │                                                               │   │
│ │ NEW: coding_env tool (HTTP/WebSocket client to middleware)         │   │
│ └────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬───────────────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Middleware (New - FastAPI)                              │
│ ┌────────────────────────────────────────────────────────────────────┐   │
│ │ REST API                                                     │   │
│ │ ├─ POST /api/code/write                                       │   │
│ │ ├─ GET  /api/code/read                                        │   │
│ │ ├─ POST /api/code/edit                                        │   │
│ │ ├─ POST /api/code/search                                       │   │
│ │ ├─ GET  /api/project/tree                                      │   │
│ │ └─ POST /api/git/*                                           │   │
│ │                                                               │   │
│ │ WebSocket API                                                  │   │
│ │ └─ WS /ws/terminal/{session_id} (bidirectional I/O)         │   │
│ │                                                               │   │
│ │ Services                                                      │   │
│ │ ├─ Workspace Manager (path validation, sandboxing)              │   │
│ │ ├─ Terminal Manager (tmux sessions, I/O routing)              │   │
│ │ └─ Session Manager (state, cleanup)                           │   │
│ └────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬───────────────────────────────────────────────┘
                         │ File operations, terminal commands
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Coding Environment (New - Lightweight)                       │
│ ┌────────────────────────────────────────────────────────────────────┐   │
│ │ Workspace Directory                                             │   │
│ │ └─ /Users/saeed/dev/workspace (user's projects)           │   │
│ │                                                               │   │
│ │ Code Editor (Headless)                                         │   │
│ │ └─ Monaco Editor API (line-based operations)                      │   │
│ │                                                               │   │
│ │ Terminal Sessions                                                │   │
│ │ └─ Tmux sessions (persistent, attachable)                      │   │
│ └────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### Task 06: Identify Key Elements to Build
**Goal:** Master build plan
**Deliverables:**
- `docs/architecture/key-elements.md`
- `docs/architecture/build-priority.md`
- `docs/architecture/technology-choices.md`

**Output Structure:**
```markdown
# Key Elements to Build

## 🟢 Reuse from Nanobot (0 dev effort)
- [x] WhatsApp Bridge (Baileys + WebSocket)
- [x] Channel Manager
- [x] Agent Loop (LLM + tool invocation)
- [x] Tool Registry
- [x] Filesystem tools (read/write)
- [x] Shell tools (exec commands)
- [x] Memory/Session management

## 🟡 Extend in Nanobot (Low dev effort)
- [ ] Add `coding_env.py` tool (HTTP/WebSocket client)
- [ ] Update WhatsApp channel for terminal streaming
- [ ] Add WhatsApp formatting helpers

## 🟠 Build: Middleware (Medium dev effort)
- [ ] FastAPI REST API (code operations)
- [ ] FastAPI WebSocket (terminal streaming)
- [ ] Workspace service (path sandboxing)
- [ ] Terminal service (tmux integration)
- [ ] Session manager (state, cleanup)
- [ ] Git service (git operations)

## 🔴 Build: Coding Environment (Medium dev effort)
- [ ] Workspace setup
- [ ] Monaco editor integration (headless)
- [ ] Tmux session manager
- [ ] Output capture service

## 🟡 Integrate: Third-party (Research effort)
- [ ] Monaco Editor (npm package)
- [ ] Tmux (system tool)
- [ ] Xterm.js (if terminal streaming needed)
```

## Next Steps

**Start with Task 01:**
```bash
# View tasks
ls .tmp/tasks/whatsapp-coding-architecture/

# Mark task 01 as in progress
# (Manual edit of subtask_01.json)

# Start working
# Create docs/requirements/functional.md
```

**When Task 01 is complete:**
```bash
# Update task status
# (Manual edit of subtask_01.json to set status: "completed" and add completion_summary)
```

**View all tasks:**
```bash
cat .tmp/tasks/whatsapp-coding-architecture/task.json
for f in .tmp/tasks/whatsapp-coding-architecture/subtask_*.json; do
  echo "---"
  cat "$f" | jq '.title, .status'
done
```
