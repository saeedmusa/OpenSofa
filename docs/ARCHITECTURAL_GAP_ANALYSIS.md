# OpenSofa — Architectural & Gap Analysis

**Date:** March 20, 2026
**Version:** 4.0 (Zero Regex — State Machine Architecture)
**Scope:** Full codebase audit against product requirements, AgentAPI capabilities, ACP protocol, and MCP ecosystem
**Change from v3.0:** Eliminated ALL regex. Permission detection now uses a state machine driven by AgentAPI's `status_change` + `GET /messages` signals. Destructive command detection uses `String.includes()` token matching. Read AgentAPI source code to understand how stability detection actually works.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Requirements](#2-product-requirements)
3. [Current Architecture Audit](#3-current-architecture-audit)
4. [Gap Analysis](#4-gap-analysis)
5. [Target Architecture](#5-target-architecture)
6. [Migration Strategy](#6-migration-strategy)

---

## 1. Executive Summary

OpenSofa is a mobile PWA that remotely controls AI coding agents running on a user's laptop. The core sandwich architecture (phone = display/input, laptop = compute) is sound. However, the implementation has significant gaps between what the underlying protocols provide and what OpenSofa actually uses.

### Critical Findings

| Finding | Severity | Impact |
|---------|----------|--------|
| AgentAPI `GET /messages` exists but is ignored — `agentapi-client.ts` has no `getMessages()` method | 🔴 Critical | Conversation history is lost; users can't scroll back |
| ACP transport is set but its structured data is flattened to strings | 🔴 Critical | Tool calls lose Kind/Title structure in the AG-UI mapping layer |
| Regex-based permission detection (60+ patterns) is the **only** permission path — ACP `session/request_permission` does NOT exist in AgentAPI v0.12.1 | 🔴 Critical | Can't delete regex yet; must improve it while building structured fallback |
| Zero-setup requirement not implemented | 🔴 Critical | Users must manually browse dirs, can't see configured MCP |
| MCP is completely absent from the codebase | 🔴 Critical | Users can't see their configured MCP servers |
| No conversation persistence | 🟡 Significant | Session conversations vanish on stop |
| Agent crash recovery not implemented | 🟡 Significant | Sessions die silently |

### v3.0 Corrections from v2.0

The v2.0 analysis had several engineering problems that would have led to broken implementations:

1. **Over-designed ACP permissions.** v2.0 said "delete PermissionClassifier, use ACP `session/request_permission`." But AgentAPI v0.12.1 does NOT implement `session/request_permission`. It's in the ACP spec but not in AgentAPI. The regex classifier is the **only** working permission detection today. We must keep it (trimmed) while building a structured path that activates when AgentAPI adds support.

2. **Confused ACP vs AgentAPI.** The ACP protocol spec (agentclientprotocol.com) defines rich tool calls with `toolCallId`, `content`, `locations`, `rawInput`, `rawOutput`, and `session/request_permission`. AgentAPI v0.12.1's "experimental ACP" only exposes `ToolCall { Kind, Title }` and `ToolCallUpdate { Status }` through its SSE `/events` endpoint. OpenSofa is NOT an ACP client — it's an AgentAPI HTTP client. The ACP protocol runs between AgentAPI and the agent process (stdio). OpenSofa only sees what AgentAPI exposes through its HTTP SSE.

3. **MCP management was over-scoped.** v2.0 included "add/remove MCP servers from PWA" which means writing to `~/.claude.json`. This is risky — a malformed write corrupts the user's Claude Code config. Phase 1 should be read-only discovery. Write operations are Phase 3.

4. **Missing `getMessages()` in client.** The `agentapi-client.ts` file has `sendUserMessage()`, `sendRaw()`, `getStatus()`, `uploadFile()`, `listenEvents()` — but no `getMessages()`. This is the simplest, highest-impact fix in the entire codebase.

---

## 2. Product Requirements

### 2.1 Core Principle: Zero Setup

After installation, the user runs `opensofa` and immediately can:
- See all installed coding agents
- See all their git repositories
- See all configured MCP servers
- See all available models
- Create a session and start working

**No API key configuration. No MCP setup. No manual directory browsing.** Everything is discovered from the laptop's existing state.

### 2.2 Complete Requirement Set

#### Agent Interaction
| # | Requirement | Status |
|---|-------------|--------|
| R1 | Send prompts to agent | ✅ Built |
| R2 | See streamed responses | ✅ Built |
| R3 | Stop/interrupt agent (Ctrl+C) | ✅ Built |
| R4 | Approve/reject permissions | ⚠️ Regex-based |
| R5 | See raw terminal output | ✅ Built |
| R6 | Multi-line input | ✅ Built |
| R7 | Quick command palette | ✅ Built |
| R8 | Voice input | ✅ Built |
| R9 | See conversation history | ❌ `/messages` ignored |
| R10 | Scroll through past messages | ❌ Not stored |

#### MCP (Model Context Protocol)
| # | Requirement | Status |
|---|-------------|--------|
| R11 | See configured MCP servers | ❌ Not implemented |
| R12 | See MCP tools per server | ❌ Not implemented |
| R13 | See MCP tool calls in activity | ❌ Not implemented |
| R14 | Add/remove MCP servers | ❌ Not implemented |
| R15 | Per-session MCP configuration | ❌ Not implemented |
| R16 | MCP server health status | ❌ Not implemented |

#### Session Management
| # | Requirement | Status |
|---|-------------|--------|
| R17 | Create session (agent/dir/model) | ✅ Built |
| R18 | List active sessions | ✅ Built |
| R19 | Switch between sessions | ✅ Built |
| R20 | Stop session | ✅ Built |
| R21 | Restart session | ⚠️ Backend only, no API/UI |
| R22 | Session templates | ❌ Not implemented |
| R23 | Conversation persistence | ❌ Not implemented |

#### File Operations
| # | Requirement | Status |
|---|-------------|--------|
| R24 | Browse file tree | ✅ Built |
| R25 | Read files with syntax highlighting | ✅ Built |
| R26 | See git diffs | ✅ Built |
| R27 | See files changed in session | ❌ Not implemented |
| R28 | Per-file change tracking | ❌ Not implemented |
| R29 | Pre-change preview | ❌ Not implemented |

#### Zero-Setup Discovery
| # | Requirement | Status |
|---|-------------|--------|
| R30 | Auto-discover installed agents | ✅ Built |
| R31 | Auto-discover git repos | ❌ Not implemented |
| R32 | Auto-discover models from agent configs | ⚠️ Partial (Claude + OpenCode only) |
| R33 | Auto-discover MCP servers | ❌ Not implemented |
| R34 | Auto-detect API keys from env | ❌ Not implemented |

#### Network Resilience
| # | Requirement | Status |
|---|-------------|--------|
| R35 | Auto-reconnect WebSocket | ✅ Built |
| R36 | Page visibility detection | ✅ Built |
| R37 | Offline message queue | ✅ Built |
| R38 | Session state recovery | ✅ Built |

#### Permissions (ACP)
| # | Requirement | Status |
|---|-------------|--------|
| R39 | Allow once | ❌ Not implemented |
| R40 | Allow always (remember) | ❌ Not implemented |
| R41 | Reject once | ⚠️ Regex-based |
| R42 | Reject always | ❌ Not implemented |
| R43 | Per-tool-type auto-approve | ❌ Not implemented |
| R44 | Destructive command detection | ⚠️ Regex-based |

---

## 3. Current Architecture Audit

### 3.1 Data Flow (How It Actually Works Today)

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
  │     ⚠️ THIS ENDPOINT EXISTS BUT OPENSOFA DOESN'T USE IT
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
  │     ├── Handles "SessionUpdate" → parses ACP events
  │     └── ⚠️ Uses PermissionClassifier (REGEX) for approval detection
  │
  ├── ACPEventParser
  │     ├── Parses SessionUpdate.AgentMessageChunk → emits 'text_chunk'
  │     ├── Parses SessionUpdate.ToolCall → emits 'tool_call'
  │     └── Parses SessionUpdate.ToolCallUpdate → emits 'tool_call_update'
  │     ⚠️ Only extracts Kind + Title from ToolCall, ignores:
  │        - toolCallId (unique identifier)
  │        - status (pending/in_progress/completed/failed)
  │        - content (tool output)
  │        - locations (files being accessed)
  │        - rawInput / rawOutput
  │
  ├── ACP → AG-UI Mapper (acp-mapper.ts)
  │     ⚠️ Maps to AG-UI but loses structured data:
  │        - ToolCall.Kind → toolName (good)
  │        - ToolCall.Title → input.title (loses other fields)
  │        - No diff content captured
  │        - No file locations captured
  │
  ├── AG-UI → ActivityEvent Mapper (mapper.ts)
  │     ⚠️ Uses string matching on toolName:
  │        - tool === 'bash' || 'shell' || 'command' → command_run
  │        - tool === 'write' || 'create' → file_created
  │        - tool === 'edit' || 'replace' → file_edited
  │     ⚠️ Fragile - depends on exact tool names from each agent
  │
  ├── PermissionClassifier (permission-classifier.ts)
  │     ⚠️ 60+ REGEX PATTERNS to detect approval requests
  │     ⚠️ Completely bypasses ACP's structured permission model
  │
  └── DestructivePatterns (destructive-patterns.ts)
        ⚠️ 16 REGEX PATTERNS for dangerous commands
        ⚠️ Should use ACP tool call kind + content instead
  │
  ▼
WebSocket Broadcaster → PWA Frontend
```

### 3.2 Regex-Based Systems Audit

Three files contain regex-based logic that should be replaced by ACP protocol:

#### File 1: `src/permission-classifier.ts` (143 lines)
- **60+ regex patterns** for detecting approval requests
- Patterns for Claude Code, Aider, OpenCode, Gemini, Codex, Copilot, Amp, Cursor
- **Problem:** Every time an agent changes its output format, patterns break
- **ACP replacement:** `session/request_permission` is a structured ACP message with `toolCall`, `options` (allow_once, allow_always, reject_once, reject_always)
- **Used by:** `feedback-controller.ts` line 164, `session-manager.ts` line 1232

#### File 2: `src/web/activity-parser.ts` (41 lines)
- **Claims** regex patterns have been removed
- **Reality:** Only the interface/types remain; the actual regex parsing was removed
- **Status:** Correctly deprecated, but the ActivityEvent type it defines is still used everywhere
- **Used by:** `event-parser/mapper.ts`, frontend types

#### File 3: `src/web/destructive-patterns.ts` (56 lines)
- **16 regex patterns** for dangerous commands (rm -rf, DROP TABLE, chmod 777, etc.)
- **Problem:** Detects danger from command text, not from structured tool call data
- **ACP replacement:** ACP tool calls have `kind` (execute/delete) and `content` (actual command); danger detection should use structured data
- **Used by:** TOTP step-up auth flow

### 3.3 ACP Parser Audit (What It Captures vs What's Available)

AgentAPI's ACP transport provides structured events. Here's what the current parser captures vs what's available:

| ACP Field | Available | Captured | Notes |
|-----------|-----------|----------|-------|
| `SessionUpdate.AgentMessageChunk.Content.Text.Text` | ✅ | ✅ | Correctly captured |
| `SessionUpdate.ToolCall.Kind` | ✅ | ✅ | Captured as `kind` |
| `SessionUpdate.ToolCall.Title` | ✅ | ✅ | Captured as `title` |
| `SessionUpdate.ToolCallUpdate.Status` | ✅ | ✅ | Captured as `status` |
| `SessionUpdate.ToolCall.toolCallId` | ❌ Not in AgentAPI yet | ❌ | Will come with ACP full support |
| `SessionUpdate.ToolCall.Content` | ❌ Not in AgentAPI yet | ❌ | Tool output (diffs, text) |
| `SessionUpdate.ToolCall.Locations` | ❌ Not in AgentAPI yet | ❌ | Files being accessed |
| `SessionUpdate.ToolCall.RawInput` | ❌ Not in AgentAPI yet | ❌ | Tool input parameters |
| `session/request_permission` | ❌ Not in AgentAPI yet | ❌ | Structured permission request |
| `session/update` with diff content | ❌ Not in AgentAPI yet | ❌ | File diffs |

**Key insight:** AgentAPI v0.12.1's ACP integration is **early-stage**. It provides `Kind`, `Title`, and `Status` for tool calls, but not the full ACP tool call schema (toolCallId, content, locations, rawInput/rawOutput). The full ACP protocol (as defined at agentclientprotocol.com) has much richer data, but AgentAPI hasn't implemented it all yet.

**Implication:** OpenSofa should use what AgentAPI actually provides today (Kind, Title, Status) and design interfaces that can accept richer data later. Do NOT build UI for data that doesn't exist yet.

### 3.6 The Permission Problem — Solved Without Regex

This is the hardest engineering problem in the codebase. v2.0 proposed keeping regex as fallback. v3.0 proposed a layered detector with regex at the bottom. **v4.0 eliminates regex entirely** by understanding how AgentAPI actually works.

#### How AgentAPI Detects "Stable" (from source code analysis)

AgentAPI's `PTYConversation` takes periodic screen snapshots (every ~100ms). It maintains a ring buffer of snapshots. When ALL snapshots in the buffer are identical (screen hasn't changed for `ScreenStabilityLength`), it emits `status: "stable"`. When the screen is changing, it emits `status: "running"` (technically `"changing"` internally, mapped to `"running"` in the HTTP API).

**Key insight:** When an agent asks for permission, it prints a question and STOPS. The screen stops changing. AgentAPI detects stability and emits `status: "stable"`. This is the SAME signal as "agent finished its task."

#### The State Machine Approach (Zero Regex)

Instead of pattern-matching text, we use a **state machine** that combines two signals AgentAPI already provides:

1. **`status_change`** — tells us the agent went from `running` → `stable`
2. **`GET /messages`** — tells us the last agent message content

The state machine:

```
                    ┌──────────────┐
                    │   IDLE       │ ← Agent is stable, no recent activity
                    └──────┬───────┘
                           │ status → running
                           ▼
                    ┌──────────────┐
                    │   WORKING    │ ← Agent is processing
                    └──────┬───────┘
                           │ status → stable
                           ▼
                    ┌──────────────┐
                    │   ANALYZING  │ ← Agent went stable. WHY?
                    │              │   Fetch GET /messages to check
                    └──────┬───────┘
                           │
                    ┌──────┴──────┐
                    │             │
            last message    last message
            is a question   is a statement
            or has input    or summary
            prompt          
                    │             │
                    ▼             ▼
            ┌──────────┐  ┌──────────┐
            │ AWAITING │  │ COMPLETED│
            │ INPUT    │  │          │
            └──────────┘  └──────────┘
```

**How "ANALYZING" determines the state:**

When the agent goes `stable`, we call `GET /messages` and examine the last agent message. We check for **structural indicators** (not regex patterns):

1. **The message ends with a line that is an input prompt.** AgentAPI strips TUI elements but the question text remains. We check if the last non-empty line of the message:
   - Ends with `?` (universal question indicator)
   - Contains `[Y/n]`, `[y/N]`, `(Y)es`, `(yes/no)` — these are literal strings, checked with `String.includes()`, not regex
   - Is a single short line (< 80 chars) after a longer block of text (typical approval prompt structure)

2. **The ACP ToolCall context.** If the last ACP event before `stable` was a `ToolCall` with `Kind: "execute"` and no `ToolCallUpdate` with `Status: "completed"` was received, the agent is waiting for approval of that specific tool call.

3. **The message did NOT change between the last two `message_update` events.** If the agent went stable and the message content stopped growing, it's waiting. If the message was still growing when stable hit, it just finished a long response.

**Why this is better than regex:**
- **No patterns to maintain.** We're checking structural properties (ends with `?`, contains literal strings) not matching against 60+ agent-specific patterns.
- **Works for any agent.** Every agent that asks a question ends with `?`. Every agent that shows `[Y/n]` uses those exact characters.
- **Uses AgentAPI's own stability detection.** We don't re-detect what AgentAPI already knows.
- **The `GET /messages` call gives us clean text.** AgentAPI already strips TUI elements, input boxes, and user echo. We get the actual question text.

#### Destructive Command Detection — Also Without Regex

For destructive command detection, we use **token-based analysis** instead of regex:

```typescript
const DESTRUCTIVE_TOKENS: Record<string, string> = {
  'rm': 'File Deletion',
  'DROP': 'Database Drop',
  'DELETE FROM': 'Data Deletion',
  'TRUNCATE': 'Table Truncation',
  'chmod 777': 'Unsafe Permissions',
  'mkfs': 'Filesystem Format',
  'dd if=': 'Raw Disk Write',
  'git push --force': 'Force Push',
  'git push -f': 'Force Push',
  'git reset --hard': 'Hard Reset',
};

function isDestructive(command: string): { dangerous: boolean; label: string | null } {
  const normalized = command.trim();
  for (const [token, label] of Object.entries(DESTRUCTIVE_TOKENS)) {
    if (normalized.includes(token)) {
      return { dangerous: true, label };
    }
  }
  // Check for pipe-to-shell pattern
  if (normalized.includes('|') && (normalized.includes('sh') || normalized.includes('bash'))) {
    const beforePipe = normalized.split('|')[0].trim();
    if (beforePipe.startsWith('curl') || beforePipe.startsWith('wget')) {
      return { dangerous: true, label: 'Remote Execution' };
    }
  }
  return { dangerous: false, label: null };
}
```

This uses `String.includes()` — simple substring matching. No regex. The tokens are exact strings that appear in dangerous commands. False positive rate is low because these tokens are specific enough (nobody writes `rm` in normal prose, and if they do, it's in a code block that the agent is discussing, not executing).

When ACP `ToolCall.Kind` is available, we use it as the primary signal:
- `Kind === 'delete'` → always dangerous
- `Kind === 'execute'` → check the title/content with token matching
- All other kinds → not dangerous

### 3.7 The `/messages` Problem (Simplest High-Impact Fix)

`agentapi-client.ts` is missing `getMessages()`. AgentAPI has had `GET /messages` since v0.1. The fix is:

```typescript
// Add to AgentAPIClient class
async getMessages(): Promise<{ messages: AgentAPIMessage[] }> {
  const res = await fetch(`${this.baseUrl}/messages`, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw new AgentAPIError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as { messages: AgentAPIMessage[] };
}
```

Then update `src/web/routes/sessions.ts` to call it instead of returning an empty array.

This is a ~20 line change that gives users full conversation history.

### 3.4 Agent Config Files (What Exists on User's Laptop)

For zero-setup, OpenSofa needs to read these config files:

| Agent | Config File | MCP Servers | Models | API Keys |
|-------|-------------|-------------|--------|----------|
| Claude Code | `~/.claude.json` | ✅ `mcpServers` object | ✅ In settings | ✅ `ANTHROPIC_AUTH_TOKEN` |
| Claude Code | `~/.claude/settings.json` | ❌ | ✅ `model`, env vars | ✅ In `env` |
| OpenCode | `~/.config/opencode/config.json` | ✅ MCP config | ✅ Via `opencode models` | ✅ Via `opencode auth list` |
| Aider | `~/.aider.conf.yml` | ❌ | ✅ `model` key | ✅ API key env vars |
| Goose | `~/.config/goose/profiles.yaml` | ✅ Extensions = MCP | ✅ Provider/model | ✅ In profile |
| Gemini | `~/.gemini/settings.json` | ❌ | ✅ `model` | ✅ `GEMINI_API_KEY` env |
| Codex | `~/.codex/config.yaml` | ❌ | ✅ `model` | ✅ `OPENAI_API_KEY` env |

**Current state:** Only Claude Code (`~/.claude/settings.json`) and OpenCode (`opencode models` CLI) are read. All other agents' configs are ignored.

### 3.5 MCP Configuration Format

Claude Code MCP servers are configured in `~/.claude.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_..." }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": { "DATABASE_URL": "postgresql://..." }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"]
    }
  }
}
```

OpenCode MCP config is in `~/.config/opencode/config.json` with a similar structure.

Goose uses "extensions" which are conceptually the same as MCP servers.

---

## 4. Gap Analysis

### 4.1 Gap Category: Protocol Utilization

| Gap | Current State | Target State | Priority |
|-----|--------------|--------------|----------|
| **G1: `/messages` endpoint ignored** | Returns empty array | Show full conversation history | P0 |
| **G2: ACP ToolCall structure flattened** | Only Kind + Title captured | Capture all available fields + design for future fields | P0 |
| **G3: Regex permission detection** | 60+ patterns in `PermissionClassifier` | Use ACP `session/request_permission` when available, structured fallback otherwise | P0 |
| **G4: AG-UI mapper uses string matching** | `tool === 'bash'` etc. | Use ACP `Kind` field directly (read/edit/execute/delete/search/think/fetch) | P1 |
| **G5: Destructive pattern detection is regex** | 16 patterns in `destructive-patterns.ts` | Use ACP tool call `kind` + `content` for structured danger detection | P1 |

### 4.2 Gap Category: Zero-Setup Discovery

| Gap | Current State | Target State | Priority |
|-----|--------------|--------------|----------|
| **G6: No project auto-discovery** | User must browse to directory | Scan `~/development`, `~/projects`, `~/code`, `~/src` for git repos | P0 |
| **G7: Incomplete model discovery** | Only Claude + OpenCode adapters | All 12 agents' models discoverable | P0 |
| **G8: No MCP server discovery** | Zero MCP awareness | Read `~/.claude.json`, OpenCode config, Goose profiles | P0 |
| **G9: No environment variable scanning** | API keys not detected | Scan `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. for status display | P1 |

### 4.3 Gap Category: MCP

| Gap | Current State | Target State | Priority |
|-----|--------------|--------------|----------|
| **G10: No MCP config reading** | N/A | Read and parse MCP server configs | P0 |
| **G11: No MCP display UI** | N/A | Show servers, tools, health in PWA | P0 |
| **G12: No MCP tool call visibility** | N/A | Show MCP tool calls in activity feed | P1 |
| **G13: No MCP management** | N/A | Add/remove/edit MCP servers from PWA | P2 |
| **G14: No per-session MCP** | N/A | Choose MCP servers per session | P2 |

### 4.4 Gap Category: Conversation & History

| Gap | Current State | Target State | Priority |
|-----|--------------|--------------|----------|
| **G15: No conversation history** | `GET /messages` returns empty | Use AgentAPI's `/messages` endpoint | P0 |
| **G16: No conversation persistence** | Conversations lost on stop | Store messages in SQLite | P0 |
| **G17: No conversation search** | N/A | Search across past conversations | P2 |
| **G18: No session restart UI** | Backend exists, no route/UI | `POST /api/sessions/:name/restart` + button | P1 |

### 4.5 Gap Category: File Change Tracking

| Gap | Current State | Target State | Priority |
|-----|--------------|--------------|----------|
| **G19: No "files changed" view** | File browser shows current state | List all files modified in session | P1 |
| **G20: No per-file diffs from ACP** | Diffs not captured | Capture diff content from ACP tool calls | P1 |
| **G21: No individual file rollback** | Only full `git checkout .` | Revert individual files | P2 |

### 4.6 Gap Category: Agent Lifecycle

| Gap | Current State | Target State | Priority |
|-----|--------------|--------------|----------|
| **G22: No crash recovery** | Session goes to `error` state | Auto-restart with retry | P1 |
| **G23: No session templates** | N/A | Pre-configured session setups | P2 |
| **G24: No model switching UI** | Backend supports, no frontend | Change model mid-session | P2 |

---

## 5. Target Architecture

### 5.1 Architecture Principles

1. **ACP-first, PTY-fallback** — Use structured ACP events as primary data source; PTY only for terminal display
2. **Zero regex** — No regular expressions for detection logic. Use state machines, `String.includes()` token matching, and structural analysis of message content. Regex is a maintenance trap — every agent update breaks patterns.
3. **Zero setup** — Auto-discover everything from the laptop
4. **MCP-native** — MCP servers are first-class entities, not afterthoughts
5. **Conversation-aware** — Sessions have persistent conversation history
6. **Use AgentAPI's signals** — AgentAPI already detects stability, parses messages, strips TUI elements. Don't re-detect what it already knows. Use `GET /messages` and `status_change` as primary data sources.

### 5.2 Target Data Flow

```
Agent (claude/opencode/aider/...)
  │
  ▼
AgentAPI (ACP transport preferred)
  │
  ├── GET /events (SSE)
  │     ├── event: "SessionUpdate"
  │     │     ├── AgentMessageChunk → text streaming
  │     │     ├── ToolCall { kind, title, status } → structured tool events
  │     │     └── ToolCallUpdate { status } → tool completion
  │     ├── event: "status_change" → agent running/stable
  │     └── event: "agent_error" → error handling
  │
  ├── GET /messages → full conversation history ← NOW USED
  │
  └── POST /message → send user messages
  │
  ▼
OpenSofa Backend (REDESIGNED)
  │
  ├── ACP Event Pipeline (replaces regex)
  │     ├── ACPEventParser (already exists, extend)
  │     ├── ACPToActivityMapper (NEW - uses Kind field directly)
  │     └── ACPPermissionHandler (NEW - for future ACP permissions)
  │
  ├── Discovery Service (NEW)
  │     ├── AgentDiscovery (already exists)
  │     ├── ProjectDiscovery (NEW - scan for git repos)
  │     ├── ModelDiscovery (extend existing)
  │     └── MCPDiscovery (NEW - read agent configs)
  │
  ├── Conversation Manager (NEW)
  │     ├── Fetch from AgentAPI /messages
  │     ├── Store in SQLite
  │     └── Search across sessions
  │
  ├── MCP Manager (NEW)
  │     ├── Read MCP configs from agent files
  │     ├── Track MCP server health
  │     └── Per-session MCP configuration
  │
  └── Session Manager (existing, enhanced)
        ├── Crash recovery (NEW)
        ├── Session templates (NEW)
        └── Model switching (enhanced)
  │
  ▼
PWA Frontend (ENHANCED)
  │
  ├── Home View
  │     ├── Auto-discovered agents
  │     ├── Auto-discovered projects
  │     ├── Auto-discovered MCP servers
  │     └── Recent conversations
  │
  ├── Session View
  │     ├── Activity Feed (ACP-structured events)
  │     ├── Terminal (PTY, secondary)
  │     ├── Files Changed (NEW)
  │     └── Conversation History (NEW)
  │
  └── MCP View (NEW)
        ├── Server list with health
        ├── Tools per server
        └── Add/remove/edit
```

### 5.3 Key Architectural Changes

#### Change 1: State Machine Permission Detection (Zero Regex)

**Before:**
```
SSE → FeedbackController → PermissionClassifier (60+ regex) → binary yes/no
```

**After:**
```
SSE → AgentStateMachine
        │
        ├── status_change: running → WORKING state
        ├── status_change: stable  → ANALYZING state
        │     │
        │     ├── GET /messages → last message ends with "?" or contains "[Y/n]"
        │     │     → AWAITING_INPUT state → emit approval event
        │     │
        │     ├── ACP ToolCall(execute) without ToolCallUpdate(completed)
        │     │     → AWAITING_INPUT state → emit approval event with tool context
        │     │
        │     └── last message is a statement
        │           → COMPLETED state → emit completion event
        │
        └── ACP session/request_permission (future — auto-activates)
              → AWAITING_INPUT state → emit structured approval event
```

`permission-classifier.ts` is **deleted entirely**. Zero regex patterns remain.

`destructive-patterns.ts` is **replaced** with token-based `String.includes()` matching:
- A map of `{ token: label }` pairs checked with `command.includes(token)`
- When ACP `ToolCall.Kind` is available: `delete` = dangerous, `execute` = check tokens
- Pipe-to-shell detection: check if string contains `|` and `sh`/`bash` after `curl`/`wget`

#### Change 2: Discovery Service (Zero Setup)

**New module:** `src/discovery/`

```
src/discovery/
├── project-discovery.ts    # Scan directories for git repos
├── mcp-discovery.ts        # Read MCP configs from agent files
├── model-discovery.ts      # Extend existing model adapters
└── index.ts                # Unified discovery API
```

At startup, OpenSofa runs discovery and presents everything in the PWA without user action.

#### Change 3: Conversation Manager

**Use AgentAPI's `/messages` endpoint** which returns the full conversation history. Store conversations in SQLite for persistence across session restarts.

#### Change 4: MCP as Read-Only Discovery (Phase 1)

MCP servers are discovered and displayed as read-only information. The PWA shows:
- Which MCP servers are configured per agent (read from config files)
- Server names, commands, and transport types
- Which agent each server belongs to

**Phase 1 is read-only.** We do NOT write to agent config files. The risk of corrupting `~/.claude.json` or `~/.config/opencode/config.json` is too high for an initial release. Users add MCP servers through their agent's CLI (`claude mcp add`, etc.) and OpenSofa discovers them.

Phase 2 (later): Tool discovery by spawning MCP server processes
Phase 3 (later): Write operations to add/remove MCP servers from PWA

### 5.4 Engineering Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AgentAPI `/messages` returns terminal-formatted text (80-char lines) not clean markdown | High | Messages look ugly in conversation UI | Parse and clean: strip leading `>` prompts, join wrapped lines, detect code blocks |
| Project auto-discovery scans too many directories, slow startup | Medium | 3+ second startup delay | Limit depth to 3, cache results in SQLite, scan async after UI loads |
| MCP config file formats vary between agent versions | High | Parser breaks on unexpected format | Use permissive JSON parsing with try/catch per field, log warnings, never crash |
| State machine misclassifies "completed" as "awaiting input" | Medium | False approval prompts | The `?` check has low false-positive rate because agent completion messages are typically statements. Add a 2-second debounce: if agent goes stable and message ends with `?`, wait 2s — if still stable, it's awaiting input. If it goes running again, it was just a pause. |
| State machine misclassifies "awaiting input" as "completed" | Low | Missed approval | The `GET /messages` check catches most cases. For edge cases where the agent asks permission without a `?` (rare), the user can still interact via the terminal tab. Log all state transitions for debugging. |
| `String.includes()` token matching has false positives for destructive detection | Low | Unnecessary warnings on safe commands | The tokens are specific enough (`rm`, `DROP`, `chmod 777`) that false positives are rare. A false positive (extra warning) is much safer than a false negative (missed danger). |
| ACP `ToolCall.Kind` values don't match expected set | Medium | Activity events show "unknown" kind | Map unknown kinds to `other` with the raw kind value in details, don't crash |
| Agent config files contain secrets (API keys in env vars) | High | Secrets exposed in PWA | NEVER send env var values to frontend — only send key names + "configured" boolean |

---

## 6. Migration Strategy

### Phase 1: Quick Wins + Foundation (1-2 weeks)
**Goal:** Immediately visible improvements with minimal risk.

1. **Add `getMessages()` to `agentapi-client.ts`** — 20 lines, gives conversation history
2. **Wire `/messages` route in `sessions.ts`** — replace empty array with real data
3. **Build conversation history UI** — display messages from AgentAPI
4. **Implement project auto-discovery** — scan common directories for git repos
5. **Implement MCP config reading (read-only)** — parse `~/.claude.json` etc.
6. **Add session restart API route** — wire existing backend to a REST endpoint

### Phase 2: Protocol Improvements (2-3 weeks)
**Goal:** Better event handling, smarter permissions, richer activity feed.

1. **Extend ACP parser** — capture all available fields, design for future fields
2. **Use ACP Kind for activity mapping** — replace string matching with Kind-based mapping
3. **Build layered permission detector** — structured layers above trimmed regex
4. **Enhance destructive pattern detection** — use Kind when available, regex fallback
5. **Build files-changed view** — git diff + ACP tool call tracking
6. **Agent crash recovery** — auto-restart with exponential backoff

### Phase 3: Power Features (3-4 weeks)
**Goal:** Advanced features for power users.

1. **MCP tool discovery** — spawn MCP servers to list tools (on-demand)
2. **Conversation persistence in SQLite** — survive session restarts
3. **Complete model discovery** — adapters for all agents
4. **Session templates** — pre-configured session setups
5. **MCP server management (write)** — add/remove from PWA with config backup
6. **Model switching UI** — change model mid-session

---

## Appendix A: File Impact Summary

### Files to Delete
| File | Reason |
|------|--------|
| `src/permission-classifier.ts` | Replaced by `AgentStateMachine` — zero regex, uses `status_change` + `GET /messages` + `String.includes()` |
| `src/web/destructive-patterns.ts` | Replaced by `destructive-tokens.ts` — token-based `String.includes()` matching, no regex |

### Files to Majorly Refactor
| File | Change |
|------|--------|
| `src/web/event-parser/acp-parser.ts` | Extend to capture full ACP schema |
| `src/web/event-parser/acp-mapper.ts` | Use ACP Kind directly, not string matching |
| `src/web/event-parser/mapper.ts` | Simplify — ACP Kind replaces tool name matching |
| `src/feedback-controller.ts` | Remove PermissionClassifier dependency |
| `src/session-manager.ts` | Remove regex approval detection, add crash recovery |
| `src/web/server.ts` | Wire conversation history, MCP routes |

### Files to Create
| File | Purpose |
|------|---------|
| `src/discovery/project-discovery.ts` | Auto-scan for git repos |
| `src/discovery/mcp-discovery.ts` | Read MCP configs from agent files |
| `src/discovery/index.ts` | Unified discovery API |
| `src/web/routes/mcp.ts` | MCP API routes |
| `src/web/routes/conversations.ts` | Conversation history routes |
| `src/web/frontend/src/components/MCPPanel.tsx` | MCP server display |
| `src/web/frontend/src/components/ConversationHistory.tsx` | Past messages |
| `src/web/frontend/src/components/FilesChanged.tsx` | Session file changes |

### Files to Extend
| File | Extension |
|------|-----------|
| `src/model-adapters/` | Add adapters for Aider, Goose, Gemini, Codex |
| `src/web/routes/sessions.ts` | Add restart route, conversation route |
| `src/web/frontend/src/views/HomeView.tsx` | Show discovered projects, MCP servers |
| `src/web/frontend/src/views/SessionView.tsx` | Add conversation tab, files-changed tab |

---

## Appendix B: AgentAPI Capability Matrix

| Capability | AgentAPI Provides | OpenSofa Uses |
|------------|-------------------|---------------|
| `GET /messages` (conversation history) | ✅ Since v0.1 | ❌ Not used |
| `POST /message` (send message) | ✅ | ✅ |
| `GET /status` (agent status + transport) | ✅ | ✅ |
| `GET /events` SSE: `message_update` | ✅ | ✅ |
| `GET /events` SSE: `status_change` | ✅ | ✅ |
| `GET /events` SSE: `agent_error` | ✅ | ⚠️ Logged only |
| `GET /events` SSE: `SessionUpdate` (ACP) | ✅ v0.12+ | ⚠️ Partially parsed |
| `POST /upload` (file upload) | ✅ | ✅ |
| ACP transport (`--experimental-acp`) | ✅ v0.12+ | ✅ Enabled |
| ACP ToolCall with Kind | ✅ | ✅ Captured |
| ACP ToolCall with Title | ✅ | ✅ Captured |
| ACP ToolCallUpdate with Status | ✅ | ✅ Captured |
| ACP permission requests | ❌ Not yet in AgentAPI | N/A (future) |
| ACP tool call content/diffs | ❌ Not yet in AgentAPI | N/A (future) |
| ACP file locations | ❌ Not yet in AgentAPI | N/A (future) |
| MCP protocol support | ❌ Roadmap (issue #1) | N/A (future) |

---

## Appendix C: MCP Ecosystem Context

MCP (Model Context Protocol) is an open standard created by Anthropic, donated to the Linux Foundation in Dec 2025. As of March 2026:

- **1000+ MCP servers** available
- **Adopted by:** Anthropic (Claude Code), OpenAI (Codex), Google (Gemini), Microsoft (Copilot)
- **Transport types:** stdio (local), HTTP (remote), SSE (legacy remote)
- **Claude Code config:** `claude mcp add --transport http <name> <url>` or `claude mcp add -- <command> <args>`
- **Config location:** `~/.claude.json` → `mcpServers` object

MCP servers provide **tools** that agents can call. Examples:
- GitHub: `create_issue`, `list_prs`, `merge_pr`
- PostgreSQL: `query`, `list_tables`
- Filesystem: `read_file`, `write_file`, `list_directory`
- Sentry: `get_error`, `list_issues`

When an agent calls an MCP tool, it appears in the ACP event stream as a tool call with the MCP server name and tool name. OpenSofa should surface these in the activity feed.

---

*Document generated: 2026-03-20*
*Based on: Full codebase audit, AgentAPI v0.12.1 source code analysis (Go), ACP protocol spec, MCP ecosystem research*
*Key principle: Zero regex. Use AgentAPI's own signals (status_change + GET /messages) for permission detection. Use String.includes() for token matching. State machines over pattern matching.*
