# OpenSofa — User Stories Breakdown

**Date:** March 20, 2026
**Version:** 4.0 (Zero Regex — State Machine Architecture)
**Source:** ARCHITECTURAL_GAP_ANALYSIS.md v4.0
**Total Story Points:** 82 across 7 epics, 29 stories

### v4.0 Changes from v3.0
- **S2-02 (Permissions):** Completely rewritten. No regex at all. Uses a state machine driven by AgentAPI's `status_change` + `GET /messages` + `String.includes()`. `permission-classifier.ts` is deleted.
- **S2-03 (Destructive):** Completely rewritten. No regex. Uses `String.includes()` token matching. `destructive-patterns.ts` is replaced with `destructive-tokens.ts`.
- **Key insight from AgentAPI source code:** AgentAPI detects "stable" by checking if the terminal screen hasn't changed for N snapshots. When an agent asks for permission, the screen stops changing → AgentAPI emits `stable`. We distinguish "done" from "waiting for input" by checking the last message content with `String.includes()` for `?`, `[Y/n]`, `(yes/no)` etc.

---

## How to Read This Document

- **Epics** group stories by architectural concern
- **Stories** use format: *As a [role], I want [feature], so that [benefit]*
- **AC** = Acceptance Criteria (testable conditions)
- **Size** = Story points (1=trivial, 2=small, 3=medium, 5=large, 8=very large)
- **Depends on** = Stories that must complete first
- **Gap ref** = Links to gap in ARCHITECTURAL_GAP_ANALYSIS.md

---

## Epic 0: Quick Wins (6 points)

**Rationale:** These are the highest-impact, lowest-effort changes. They should be done first because they unlock the most user value with the least risk.

---

### S0-01: Wire AgentAPI /messages Endpoint (The 20-Line Fix)

**As a** user,
**I want** to see the full conversation history when I open a session,
**so that** I can understand what the agent has been doing and scroll back through messages.

**Size:** 2
**Gap ref:** G1, G15

**AC:**
1. Add `getMessages()` method to `AgentAPIClient` class in `src/agentapi-client.ts`:
   ```typescript
   async getMessages(): Promise<{ messages: AgentAPIMessage[] }> {
     const res = await fetch(`${this.baseUrl}/messages`, {
       signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
     });
     if (!res.ok) throw new AgentAPIError(`HTTP ${res.status}`, res.status);
     return (await res.json()) as { messages: AgentAPIMessage[] };
   }
   ```
2. Update `src/web/routes/sessions.ts` — replace the empty array TODO with actual call to `getMessages()`
3. Add `AgentAPIMessage` type to `src/types.ts`: `{ id: number; content: string; role: 'user' | 'agent'; time: string }`
4. Frontend loads messages on session view open via `GET /api/sessions/:name/messages`
5. Messages displayed in chronological order with user/agent visual distinction
6. Agent messages may contain terminal-formatted text (80-char lines) — clean by joining wrapped lines
7. If AgentAPI `/messages` fails (agent not running), show graceful empty state
8. Messages auto-scroll to latest on load

**⚠️ Engineering risk:** AgentAPI returns terminal-formatted text, not markdown. Agent messages will have hard line breaks at 80 chars. The frontend must join these lines intelligently (don't join lines that start with `$`, `>`, or are blank — those are intentional breaks).

**Files involved:**
- MODIFY: `src/agentapi-client.ts` (add `getMessages()` — ~10 lines)
- MODIFY: `src/types.ts` (add `AgentAPIMessage` type — ~5 lines)
- MODIFY: `src/web/routes/sessions.ts` (replace empty array — ~15 lines)
- NEW: `src/web/frontend/src/components/ConversationHistory.tsx`
- MODIFY: `src/web/frontend/src/views/SessionView.tsx` (add conversation display)

**Depends on:** None

---

### S0-02: Session Restart API and UI

**As a** user,
**I want** to restart a stopped or errored session from the PWA,
**so that** I can resume work without creating a new session from scratch.

**Size:** 2
**Gap ref:** G18

**AC:**
1. New API route: `POST /api/sessions/:name/restart`
2. Calls existing `SessionManager.restartSession(name)` (already implemented in backend)
3. Returns updated session details on success
4. Session card shows "Restart" button for stopped/error sessions
5. Restart button has loading state during restart
6. On success, navigates to session view
7. On failure, shows error toast with message

**Files involved:**
- MODIFY: `src/web/routes/sessions.ts` (add restart route — ~15 lines)
- MODIFY: `src/web/frontend/src/components/SessionList.tsx` (add restart button)

**Depends on:** None

---

### S0-03: Handle agent_error SSE Events

**As a** user,
**I want** to see agent errors in the activity feed and get notified,
**so that** I know when something goes wrong instead of the session silently failing.

**Size:** 2
**Gap ref:** (Appendix B — agent_error is "logged only")

**AC:**
1. `FeedbackController` handles `agent_error` SSE events (currently only logged)
2. Agent errors are emitted as `FeedbackEvent` with `type: 'error'` and `priority: 'p0'`
3. Errors appear in the activity feed as red error cards
4. Push notification sent for agent errors when user is offline
5. Session status updated to reflect error state

**Files involved:**
- MODIFY: `src/feedback-controller.ts` (handle agent_error event — ~20 lines)
- MODIFY: `src/web/frontend/src/components/ActivityFeed.tsx` (error card styling)

**Depends on:** None

---

## Epic 1: Zero-Setup Discovery (16 points)

**Rationale:** The core product promise is "install and use." Users should not have to browse directories, configure models, or set up MCP. Everything is discovered from the laptop.

---

### S1-01: Project Auto-Discovery

**As a** user,
**I want** OpenSofa to automatically find all my git repositories on my laptop,
**so that** I can start a session without manually browsing to a directory.

**Size:** 5
**Gap ref:** G6

**AC:**
1. On startup, scan configurable directories (`~/development`, `~/projects`, `~/code`, `~/src`, `~/work`) for git repos
2. Each directory is checked for `.git` folder or `.git` file (worktree)
3. Results are cached and refreshed on pull-to-refresh or every 60 seconds
4. Home view shows discovered projects in a "My Projects" section with:
   - Project name (directory basename)
   - Full path
   - Current branch name (from `git -C <path> branch --show-current`)
   - Last modified time (from most recent commit or file modification)
   - Git status indicator (clean/dirty — from `git status --porcelain`)
5. Tapping a project pre-fills the session creation modal with that directory
6. Projects are sorted by last-modified (most recent first)
7. Max 50 projects shown (pagination or "Show more" for larger sets)
8. Hidden directories (starting with `.`) are excluded
9. Worktree directories are detected and linked to their parent repo

**Files involved:**
- NEW: `src/discovery/project-discovery.ts`
- MODIFY: `src/web/routes/browse.ts` (add `/api/projects` endpoint)
- MODIFY: `src/web/frontend/src/views/HomeView.tsx` (show discovered projects)
- NEW: `src/web/frontend/src/components/ProjectList.tsx`

**Depends on:** None

---

### S1-02: MCP Server Auto-Discovery

**As a** user,
**I want** OpenSofa to automatically find all my configured MCP servers,
**so that** I can see what tools my agents have access to without any setup.

**Size:** 5
**Gap ref:** G8, G10

**AC:**
1. On startup, read MCP server configs from known agent config files:
   - `~/.claude.json` → `mcpServers` object
   - `~/.config/opencode/config.json` → MCP section
   - `~/.config/goose/profiles.yaml` → extensions (conceptually MCP)
2. For each MCP server, extract:
   - Name (key in mcpServers object)
   - Command (e.g., `npx`)
   - Args (e.g., `["-y", "@modelcontextprotocol/server-github"]`)
   - Environment variables (redact values, show key names only)
   - Transport type (stdio or http)
3. Home view shows discovered MCP servers in an "MCP Servers" section
4. Each server shows:
   - Name
   - Status indicator (green = config found, red = config file missing/invalid)
   - Which agent it's configured for
   - Transport type
5. Config file parsing errors are caught gracefully (show "Config error" not crash)
6. If no MCP servers are configured, show helpful empty state: "No MCP servers configured. Add them in Claude Code with `claude mcp add`"

**Files involved:**
- NEW: `src/discovery/mcp-discovery.ts`
- MODIFY: `src/web/routes/index.ts` (add MCP routes)
- NEW: `src/web/routes/mcp.ts`
- MODIFY: `src/web/frontend/src/views/HomeView.tsx` (show MCP section)
- NEW: `src/web/frontend/src/components/MCPServerList.tsx`

**Depends on:** None

---

### S1-03: Complete Model Discovery

**As a** user,
**I want** OpenSofa to discover all available models from all my installed agents,
**so that** I can pick the right model when creating a session without manual configuration.

**Size:** 3
**Gap ref:** G7

**AC:**
1. Model discovery works for all installed agents, not just Claude + OpenCode:
   - Claude Code: Read `~/.claude/settings.json` env vars (existing)
   - OpenCode: Run `opencode models` + `opencode auth list` (existing)
   - Aider: Read `~/.aider.conf.yml` for model config
   - Gemini: Read `~/.gemini/settings.json` or check `GEMINI_MODEL` env
   - Goose: Read `~/.config/goose/profiles.yaml`
   - Codex: Read `~/.codex/config.yaml` or check model env vars
2. Each agent adapter implements `ModelAdapter` interface (existing pattern)
3. Models are grouped by provider within each agent
4. Configured vs unconfigured providers are distinguished
5. Model picker in NewSessionModal shows all discovered models
6. If an agent has no discoverable models, show agent's default behavior

**Files involved:**
- NEW: `src/model-adapters/aider-model-adapter.ts`
- NEW: `src/model-adapters/gemini-model-adapter.ts`
- NEW: `src/model-adapters/goose-model-adapter.ts`
- NEW: `src/model-adapters/codex-model-adapter.ts`
- MODIFY: `src/web/routes/model-discovery.ts` (register new adapters)

**Depends on:** None

---

### S1-04: Environment Variable Status Display

**As a** user,
**I want** to see which API keys are configured on my laptop,
**so that** I know which agents/models are ready to use without guessing.

**Size:** 3
**Gap ref:** G9

**AC:**
1. On startup, check environment variables for known API keys:
   - `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` (Claude)
   - `OPENAI_API_KEY` (Codex, GPT models)
   - `GEMINI_API_KEY` / `GOOGLE_API_KEY` (Gemini)
   - `OPENROUTER_API_KEY` (OpenRouter)
2. Display key name + configured status (✅/❌) — NEVER display key values
3. Show in Settings view under "API Keys" section
4. Also show in agent cards on Home view (e.g., "Claude Code — API key configured")
5. If no keys are found, show helpful message: "Set API keys as environment variables or configure in agent settings"

**Files involved:**
- NEW: `src/discovery/key-discovery.ts`
- MODIFY: `src/web/frontend/src/views/SettingsView.tsx`
- MODIFY: `src/web/routes/system.ts` (add key status endpoint)

**Depends on:** None

---

## Epic 2: ACP Protocol Integration (18 points)

**Rationale:** AgentAPI provides structured ACP events but OpenSofa flattens them and still uses regex for permissions. This epic replaces all regex-based systems with structured protocol handling.

---

### S2-01: Extend ACP Parser for Full Schema

**As a** developer,
**I want** the ACP parser to capture all available fields from AgentAPI's ACP events,
**so that** we have a future-proof foundation when AgentAPI adds more ACP capabilities.

**Size:** 3
**Gap ref:** G2

**AC:**
1. `ACPEventParser` captures all fields from `SessionUpdate`:
   - `AgentMessageChunk.Content.Text.Text` (existing)
   - `ToolCall.Kind` (existing)
   - `ToolCall.Title` (existing)
   - `ToolCallUpdate.Status` (existing)
   - Future: `ToolCall.toolCallId`, `ToolCall.Content`, `ToolCall.Locations`, `ToolCall.RawInput`
2. Parser handles unknown fields gracefully (stores in `raw` field, doesn't crash)
3. Parser emits typed events with all captured data
4. Unit tests cover: full event, partial event, unknown fields, malformed JSON
5. Event types are defined as TypeScript interfaces with optional fields for future data

**Current code:** `src/web/event-parser/acp-parser.ts` (157 lines)
**Current gap:** Only extracts `Kind`, `Title`, `Status` — ignores structure for future fields

**Files involved:**
- MODIFY: `src/web/event-parser/acp-parser.ts`
- MODIFY: `src/web/event-parser/acp-mapper.ts`

**Depends on:** None

---

### S2-02: Agent State Machine for Permission Detection (Zero Regex)

**As a** user,
**I want** permission requests to be detected without any regex patterns,
**so that** approvals work reliably for any agent without maintaining fragile pattern lists.

**Size:** 5
**Gap ref:** G3

**How it works (from AgentAPI source code analysis):**

AgentAPI detects "stable" by checking if the terminal screen hasn't changed for N consecutive snapshots. When an agent asks for permission, it prints a question and stops → screen stops changing → AgentAPI emits `status: "stable"`. This is the same signal as "agent finished." We distinguish them by checking the last message content.

**AC:**
1. New `AgentStateMachine` class with states: `IDLE`, `WORKING`, `ANALYZING`, `AWAITING_INPUT`, `COMPLETED`
2. State transitions driven by AgentAPI signals (no regex):
   - `status_change → running` → transition to `WORKING`
   - `status_change → stable` → transition to `ANALYZING`
   - In `ANALYZING`: call `GET /messages` to get last agent message, then:
     - If last message's final non-empty line ends with `?` → `AWAITING_INPUT`
     - If last message contains `[Y/n]` or `[y/N]` or `(yes/no)` or `(Y)es` (checked with `String.includes()`) → `AWAITING_INPUT`
     - If ACP `ToolCall(Kind: "execute")` was received without a matching `ToolCallUpdate(Status: "completed")` → `AWAITING_INPUT`
     - Otherwise → `COMPLETED`
   - Add 2-second debounce in `ANALYZING`: if agent goes `running` again within 2s, it was just a pause, not a permission request
3. When entering `AWAITING_INPUT`, emit approval event with:
   - The last agent message content (the question being asked)
   - The ACP ToolCall context if available (Kind, Title)
   - The extracted command (last line before the question, or ToolCall Title)
4. `permission-classifier.ts` is **deleted entirely** — zero regex patterns
5. `FeedbackController` uses `AgentStateMachine` instead of `PermissionClassifier`
6. All state transitions are logged for debugging
7. Future: when AgentAPI adds `session/request_permission`, add it as a direct transition to `AWAITING_INPUT` (bypasses `ANALYZING`)

**Files involved:**
- NEW: `src/agent-state-machine.ts`
- DELETE: `src/permission-classifier.ts`
- MODIFY: `src/feedback-controller.ts` (replace PermissionClassifier with AgentStateMachine)
- MODIFY: `src/session-manager.ts` (use state machine for approval detection)
- MODIFY: `src/agentapi-client.ts` (ensure `getMessages()` exists — done in S0-01)

**Depends on:** S0-01 (needs `getMessages()`), S2-01

---

### S2-03: Replace Destructive Patterns with Token Matching (Zero Regex)

**As a** user,
**I want** dangerous commands to be detected without regex,
**so that** the detection is simple, readable, and doesn't break when command formats change.

**Size:** 2
**Gap ref:** G5

**AC:**
1. New file `src/web/destructive-tokens.ts` replaces `src/web/destructive-patterns.ts`
2. Uses a `Record<string, string>` map of `{ token: riskLabel }`:
   ```typescript
   const DESTRUCTIVE_TOKENS = {
     'rm -rf': 'File Deletion',
     'rm -f': 'File Deletion',
     'rm --force': 'File Deletion',
     'DROP TABLE': 'Database Drop',
     'DROP DATABASE': 'Database Drop',
     'DELETE FROM': 'Data Deletion',
     'TRUNCATE TABLE': 'Table Truncation',
     'chmod 777': 'Unsafe Permissions',
     'mkfs': 'Filesystem Format',
     'dd if=': 'Raw Disk Write',
     'git push --force': 'Force Push',
     'git push -f': 'Force Push',
     'git reset --hard': 'Hard Reset',
   };
   ```
3. Detection uses `command.includes(token)` — no regex
4. Pipe-to-shell detection: `command.includes('|')` AND (`command.includes('curl')` OR `command.includes('wget')`) AND (`command.includes('sh')` OR `command.includes('bash')`)
5. When ACP `ToolCall.Kind` is available:
   - `Kind === 'delete'` → always dangerous, label from Kind
   - `Kind === 'execute'` → check title/content with token matching
   - Other kinds → not dangerous
6. `destructive-patterns.ts` is **deleted** — zero regex
7. TOTP step-up auth works with new token-based detection
8. Exports: `isDestructive(command: string)` and `isDestructiveToolCall(kind: string, title: string)`

**Files involved:**
- NEW: `src/web/destructive-tokens.ts`
- DELETE: `src/web/destructive-patterns.ts`
- MODIFY: `src/feedback-controller.ts` (import from new file)

**Depends on:** None

---

### S2-04: Use ACP Kind for Activity Event Mapping

**As a** user,
**I want** activity events to be categorized by the agent's structured tool kind,
**so that** the activity feed accurately shows what the agent is doing.

**Size:** 3
**Gap ref:** G4

**AC:**
1. `ACPToActivityMapper` maps ACP `ToolCall.Kind` directly to activity types:
   - `read` → "Reading: {title}" with 📖 icon
   - `edit` → "Editing: {title}" with ✏️ icon
   - `delete` → "Deleting: {title}" with 🗑️ icon
   - `execute` → "Running: {title}" with ⚡ icon
   - `search` → "Searching: {title}" with 🔍 icon
   - `think` → "Thinking: {title}" with 🤔 icon
   - `fetch` → "Fetching: {title}" with 🌐 icon
   - `other` → "{title}" with 🔧 icon
2. No string matching on tool names (no `tool === 'bash'` checks)
3. `mapper.ts` is simplified — the `mapToolCallStart` function uses Kind instead of name matching
4. Activity events include `toolKind` field for frontend filtering
5. MCP tool calls show the MCP server name in the activity card

**Current code:** `src/web/event-parser/mapper.ts` (512 lines, heavy string matching)

**Files involved:**
- MODIFY: `src/web/event-parser/mapper.ts` (refactor mapToolCallStart)
- MODIFY: `src/web/event-parser/acp-mapper.ts` (pass Kind through)
- MODIFY: `src/web/frontend/src/types/index.ts` (add toolKind to ActivityEvent)

**Depends on:** S2-01

---

### S2-05: Conversation History Persistence in SQLite

**As a** user,
**I want** my conversation history to persist even after the session stops,
**so that** I can review what happened in past sessions.

**Size:** 4
**Gap ref:** G16

**⚠️ Note:** The basic `/messages` wiring is done in S0-01. This story adds persistence so conversations survive session stops.

**AC:**
1. New SQLite table: `conversations` with columns: `id`, `session_name`, `agent_message_id`, `role`, `content`, `timestamp`, `created_at`
2. When AgentAPI SSE sends `message_update`, store/update the message in SQLite (upsert by `agent_message_id`)
3. When session stops, conversation remains in SQLite
4. New API: `GET /api/conversations` — list past conversations grouped by session (name, agent, message count, last activity)
5. New API: `GET /api/conversations/:sessionName` — get messages for a past session
6. Home view shows "Recent Conversations" section with last 5 sessions
7. Conversations pruned after 30 days (configurable in `config.yaml`)

**Files involved:**
- MODIFY: `src/db.ts` (add conversations table)
- NEW: `src/web/routes/conversations.ts`
- MODIFY: `src/feedback-controller.ts` (persist messages on receive)
- MODIFY: `src/web/frontend/src/views/HomeView.tsx` (recent conversations section)

**Depends on:** S0-01

---

## Epic 3: MCP Integration (14 points)

**Rationale:** MCP is the primary way agents connect to external tools. Users need to see and manage their MCP configuration from the PWA.

---

### S3-01: MCP Server Display Panel

**As a** user,
**I want** to see all my configured MCP servers in the PWA,
**so that** I know what tools are available to my agents.

**Size:** 3
**Gap ref:** G11

**AC:**
1. New "MCP" section on Home view (below Projects, above Sessions)
2. Each MCP server card shows:
   - Server name
   - Agent it belongs to (Claude Code, OpenCode, etc.)
   - Transport type (stdio/http)
   - Status: 🟢 Config found / 🔴 Config error / ⚪ Unknown
   - Command + args (truncated, expandable)
3. Tapping a server card expands to show:
   - Full command
   - Environment variable names (values redacted)
   - Config file path
4. If no MCP servers configured, show empty state with instructions
5. List is sorted by agent, then by server name

**Files involved:**
- NEW: `src/web/frontend/src/components/MCPServerList.tsx`
- NEW: `src/web/frontend/src/components/MCPServerCard.tsx`
- MODIFY: `src/web/frontend/src/views/HomeView.tsx` (add MCP section)

**Depends on:** S1-02

---

### S3-02: MCP Tool Discovery (On-Demand)

**As a** user,
**I want** to see what tools each MCP server provides,
**so that** I understand what capabilities my agent has.

**Size:** 5
**Gap ref:** G12

**⚠️ Engineering risk:** This story spawns MCP server processes to query their tool lists. This is inherently risky — MCP servers may require env vars, network access, or database connections. Discovery must be on-demand (user-initiated), never automatic.

**AC:**
1. "Discover Tools" button on each MCP server card (not automatic)
2. For stdio servers: spawn the MCP server process with its configured command/args/env, send JSON-RPC `tools/list` request over stdin, read response from stdout, kill process
3. For http servers: send POST to server URL with `tools/list` JSON-RPC request
4. Tool list shows: tool name, description (if available)
5. Discovery has 10-second timeout per server
6. If discovery fails, show "Could not discover tools — {error}" (common: missing env vars, server not installed)
7. Tool results are cached in memory (not persisted) — cleared on app restart
8. Tool count shown on card after successful discovery

**Files involved:**
- NEW: `src/discovery/mcp-tool-discovery.ts`
- MODIFY: `src/web/routes/mcp.ts` (add tool discovery endpoint)
- MODIFY: `src/web/frontend/src/components/MCPServerCard.tsx` (show tools)

**Depends on:** S3-01

---

### S3-03: MCP Tool Calls in Activity Feed

**As a** user,
**I want** to see when the agent calls MCP tools in the activity feed,
**so that** I can track what external services the agent is using.

**Size:** 3
**Gap ref:** G12

**AC:**
1. When ACP `ToolCall.Kind` corresponds to an MCP tool (detected by tool name matching MCP server tools), show MCP-specific activity card
2. MCP activity card shows:
   - MCP server name (e.g., "GitHub")
   - Tool name (e.g., "create_issue")
   - Status (pending → in_progress → completed/failed)
   - Input summary (when available from ACP)
   - Output summary (when available from ACP)
3. MCP tool calls are filterable in the activity feed (toggle "Show MCP only")
4. MCP tool calls have a distinct visual style (border color, icon) to differentiate from built-in tools

**Files involved:**
- MODIFY: `src/web/event-parser/mapper.ts` (detect MCP tool calls)
- MODIFY: `src/web/frontend/src/components/ActivityFeed.tsx` (MCP card styling)
- MODIFY: `src/web/frontend/src/types/index.ts` (add MCP fields to ActivityEvent)

**Depends on:** S2-04, S3-02

---

### S3-04: MCP Server Management

**As a** user,
**I want** to add and remove MCP servers from the PWA,
**so that** I can configure my agent's tools without editing JSON files on my laptop.

**Size:** 3
**Gap ref:** G13

**AC:**
1. "Add MCP Server" button on MCP section of Home view
2. Add server form collects:
   - Server name (required)
   - Target agent (dropdown: Claude Code, OpenCode, etc.)
   - Transport type (stdio/http)
   - Command (for stdio) or URL (for http)
   - Arguments (comma-separated or array input)
   - Environment variables (key-value pairs, values hidden by default)
3. On save, writes to the agent's config file:
   - Claude Code: Updates `~/.claude.json` `mcpServers` object
   - OpenCode: Updates `~/.config/opencode/config.json`
4. "Remove MCP Server" button on each server card
5. Remove requires confirmation: "Remove MCP server '{name}'? This will update your {agent} config."
6. Config file is backed up before modification (`.bak` suffix)
7. After add/remove, MCP server list refreshes automatically

**Files involved:**
- NEW: `src/web/frontend/src/components/AddMCPServerModal.tsx`
- MODIFY: `src/web/routes/mcp.ts` (add create/delete endpoints)
- MODIFY: `src/discovery/mcp-discovery.ts` (add write capability)

**Depends on:** S3-01

---

## Epic 4: Conversation & History (12 points)

**Rationale:** Users need to see what happened in their sessions, scroll through conversations, and resume work.

---

### S4-01: Conversation History Display

**As a** user,
**I want** to see the full conversation when I open a session,
**so that** I can understand the context of what the agent is doing.

**Size:** 3
**Gap ref:** G15

**AC:**
1. Session view loads conversation history from `GET /api/sessions/:name/messages`
2. Messages displayed in a scrollable list (newest at bottom)
3. User messages: right-aligned, distinct color
4. Agent messages: left-aligned, with markdown rendering
5. Messages show timestamp (relative: "2m ago" or absolute on tap)
6. Auto-scroll to latest message on load
7. "Scroll to bottom" button appears when user scrolls up
8. Long messages are truncated with "Show more" expansion
9. Loading state while fetching history
10. Error state if fetch fails

**Files involved:**
- NEW: `src/web/frontend/src/components/ConversationHistory.tsx`
- MODIFY: `src/web/frontend/src/views/SessionView.tsx` (add conversation tab)

**Depends on:** S2-05

---

### S4-02: Conversation Persistence in SQLite

**As a** user,
**I want** my conversation history to persist even after the session stops,
**so that** I can review what happened in past sessions.

**Size:** 5
**Gap ref:** G16

**AC:**
1. New SQLite table: `conversations`
   ```sql
   CREATE TABLE conversations (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     session_name TEXT NOT NULL,
     agent_message_id INTEGER,
     role TEXT NOT NULL, -- 'user' or 'agent'
     content TEXT NOT NULL,
     timestamp INTEGER NOT NULL,
     created_at INTEGER NOT NULL DEFAULT (unixepoch())
   );
   ```
2. When AgentAPI SSE sends `message_update`, store the message in SQLite
3. When session stops, conversation remains in SQLite
4. New API: `GET /api/conversations` — list all past conversations (grouped by session)
5. New API: `GET /api/conversations/:sessionName` — get messages for a past session
6. Conversations are pruned after 30 days (configurable)
7. Home view shows "Recent Conversations" section with last 5 conversations
8. Tapping a past conversation shows the full message history (read-only)

**Files involved:**
- MODIFY: `src/db.ts` (add conversations table)
- NEW: `src/web/routes/conversations.ts`
- MODIFY: `src/feedback-controller.ts` (persist messages on receive)
- MODIFY: `src/web/frontend/src/views/HomeView.tsx` (recent conversations)

**Depends on:** S4-01

---

### S4-03: Session Restart API and UI

**As a** user,
**I want** to restart a stopped or errored session,
**so that** I can resume work without creating a new session.

**Size:** 2
**Gap ref:** G18

**AC:**
1. New API route: `POST /api/sessions/:name/restart`
2. Calls existing `SessionManager.restartSession(name)` (already implemented)
3. Returns updated session details
4. Session card in Home view shows "Restart" button for stopped/error sessions
5. Restart button has loading state during restart
6. On success, session card updates to "active" state
7. On failure, shows error toast with message

**Files involved:**
- MODIFY: `src/web/routes/sessions.ts` (add restart route)
- MODIFY: `src/web/frontend/src/components/SessionCard.tsx` (add restart button)

**Depends on:** None

---

### S4-04: Files Changed View

**As a** user,
**I want** to see which files the agent has modified in this session,
**so that** I can quickly review changes without browsing the entire file tree.

**Size:** 2
**Gap ref:** G19

**AC:**
1. New "Changes" tab in session view (alongside Activity, Terminal, Files)
2. Shows list of files modified by the agent during this session
3. Each file shows:
   - File path (relative to worktree root)
   - Change type: created/modified/deleted
   - Lines added/removed (from `git diff --stat`)
4. Tapping a file opens the diff viewer with that file's changes
5. "View all changes" opens a combined diff
6. Data comes from:
   - ACP tool calls with `kind: "edit"` or `kind: "create"` or `kind: "delete"` (primary)
   - `git diff --name-status` between session start and current state (fallback)
7. List updates in real-time as agent makes changes

**Files involved:**
- NEW: `src/web/frontend/src/components/FilesChanged.tsx`
- MODIFY: `src/web/frontend/src/views/SessionView.tsx` (add Changes tab)
- NEW: `src/web/routes/session-changes.ts` (git diff endpoint)

**Depends on:** S2-04

---

## Epic 5: Agent Lifecycle (11 points)

**Rationale:** Sessions need to be resilient. Agents crash, users need templates, and model switching should be easy.

---

### S5-01: Agent Crash Recovery

**As a** user,
**I want** the system to automatically restart the agent if it crashes,
**so that** my session continues without manual intervention.

**Size:** 5
**Gap ref:** G22

**AC:**
1. `FeedbackController` detects SSE disconnection (agent crash)
2. On crash, SessionManager attempts restart:
   - Wait 2 seconds
   - Kill any zombie processes (using existing `killProcess`)
   - Respawn AgentAPI (using existing `spawnAgentAPI`)
   - Health check with timeout
3. Max 3 restart attempts with exponential backoff (2s, 4s, 8s)
4. On successful restart:
   - Session status remains `active`
   - User sees toast: "Agent restarted"
   - SSE connection re-established
5. On failure after 3 attempts:
   - Session status set to `error`
   - User sees push notification: "Agent crashed repeatedly. Tap to restart manually."
   - Session card shows error state with "Restart" button
6. Restart attempts are logged for debugging
7. If session was awaiting approval when it crashed, approval state is cleared on restart

**Files involved:**
- MODIFY: `src/session-manager.ts` (add crash recovery logic)
- MODIFY: `src/feedback-controller.ts` (emit crash event)
- MODIFY: `src/web/frontend/src/components/SessionCard.tsx` (show crash state)

**Depends on:** None

---

### S5-02: Session Templates

**As a** user,
**I want** to create sessions from pre-configured templates,
**so that** I can quickly start common workflows without configuring each time.

**Size:** 3
**Gap ref:** G23

**AC:**
1. Templates are defined in `~/.opensofa/templates.yaml`:
   ```yaml
   templates:
     frontend:
       name: "Frontend Dev"
       agent: claude
       model: sonnet
       description: "React/frontend development"
       mcpServers: [github, filesystem]
     backend:
       name: "Backend API"
       agent: opencode
       description: "Python/Node backend"
       mcpServers: [github, postgres]
   ```
2. New Session modal shows template picker as first step (before agent selection)
3. Selecting a template pre-fills: agent, model, MCP servers
4. User still selects directory and enters initial prompt
5. "Custom" template option preserves current behavior (no pre-fill)
6. Templates are editable via Settings view

**Files involved:**
- NEW: `src/template-manager.ts`
- MODIFY: `src/web/frontend/src/components/NewSessionModal.tsx` (add template step)
- MODIFY: `src/web/frontend/src/views/SettingsView.tsx` (template editor)

**Depends on:** S3-01

---

### S5-03: Model Switching UI

**As a** user,
**I want** to change the model mid-session from the PWA,
**so that** I can switch between fast and powerful models as needed.

**Size:** 3
**Gap ref:** G24

**AC:**
1. Session view header shows current model with a dropdown arrow
2. Tapping the model opens a model picker (reuses ModelPicker component)
3. Selecting a new model triggers `POST /api/sessions/:name/model` with `{ model: "new-model" }`
4. Backend calls `SessionManager.switchSessionAgent()` with new model (existing function)
5. During model switch, session shows "Switching model..." state
6. On success, header updates to show new model
7. On failure, shows error toast and reverts to previous model
8. Model switch restarts the agent (existing behavior in `switchSessionAgent`)

**Files involved:**
- MODIFY: `src/web/routes/sessions.ts` (add model switch route)
- MODIFY: `src/web/frontend/src/views/SessionView.tsx` (model picker in header)
- MODIFY: `src/web/frontend/src/components/ModelPicker.tsx` (reuse existing)

**Depends on:** S1-03

---

## Epic 6: Mobile & Network Resilience (18 points)

**Rationale:** This is a mobile PWA. Network drops, app backgrounding, and reconnection are daily occurrences.

---

### S6-01: Offline Event Summary Banner

**As a** mobile user,
**I want** to see a summary of what happened while I was offline,
**so that** I can quickly catch up without scrolling through hundreds of events.

**Size:** 3
**Gap ref:** (Existing gap from USER_STORIES_GAP_ANALYSIS.md M2-04)

**AC:**
1. When WebSocket reconnects after being offline, the `sync_response` contains missed events
2. If missed events > 5, show a "Catch Up" banner at the top of the activity feed
3. Banner shows: "You were offline. {N} events occurred while you were away."
4. "View Events" button scrolls to the first missed event
5. "Dismiss" button hides the banner
6. Banner auto-dismisses after 30 seconds
7. Banner shows event summary: "{N} tool calls, {N} messages, {N} file changes"

**Current state:** `WebSocketProvider` tracks `missedEvents` count and `showOfflineBanner` state, but the UI doesn't render a meaningful banner.

**Files involved:**
- MODIFY: `src/web/frontend/src/components/CatchUpCard.tsx` (enhance existing)
- MODIFY: `src/web/frontend/src/components/ActivityFeed.tsx` (show banner)

**Depends on:** None

---

### S6-02: Pull-to-Refresh for Session List

**As a** mobile user,
**I want** to pull down on the session list to refresh,
**so that** I can get the latest session status without waiting for WebSocket.

**Size:** 1
**Gap ref:** (Existing, partially implemented)

**AC:**
1. Pull-to-refresh gesture on Home view triggers `GET /api/sessions`
2. Refresh indicator shows during pull (existing `usePullToRefresh` hook)
3. Session list updates with fresh data
4. Haptic feedback on refresh trigger (existing `safeVibrate`)
5. Works on both iOS and Android browsers

**Current state:** `usePullToRefresh` hook exists and is wired to `HomeView`. This story is mostly complete — verify it works end-to-end.

**Files involved:**
- VERIFY: `src/web/frontend/src/hooks/usePullToRefresh.ts`
- VERIFY: `src/web/frontend/src/views/HomeView.tsx`

**Depends on:** None

---

### S6-03: Background Sync for Push Notifications

**As a** mobile user,
**I want** to receive push notifications even when the PWA is closed,
**so that** I know when the agent needs my attention.

**Size:** 5
**Gap ref:** (Existing, partially implemented)

**AC:**
1. Service worker handles push events when PWA is in background
2. Push notifications are sent for:
   - Approval needed (existing)
   - Session completed (new — currently only error/idle)
   - Agent crashed (existing via resource monitor)
3. Notification tap opens PWA to the relevant session (deep link)
4. Notification includes action buttons: "Approve" / "Reject" (for approval notifications)
5. Notifications are grouped by session (iOS notification grouping)
6. VAPID keys are generated once and persisted (existing)
7. Push subscription is sent to backend on PWA install (existing)

**Current state:** Web Push via VAPID is implemented. Notifications work for approvals. Missing: completion notifications, action buttons, notification grouping.

**Files involved:**
- MODIFY: `src/web/notifier.ts` (add completion notification)
- MODIFY: `src/web/frontend/public/sw.js` (handle notification actions)
- MODIFY: `src/session-manager.ts` (emit completion event for push)

**Depends on:** None

---

### S6-04: Terminal Mobile Controls Enhancement

**As a** mobile user,
**I want** reliable terminal controls that work on all mobile browsers,
**so that** I can interact with the agent's terminal from my phone.

**Size:** 3
**Gap ref:** (Existing from USER_STORIES_GAP_ANALYSIS.md M1)

**AC:**
1. Terminal control bar has: ⚡ (commands), Esc, Tab, ■ (Stop), Line, ↑, ↓
2. Quick commands palette: Approve, Reject, Stop, Help, Screenshot
3. Stop button sends Ctrl+C with 1-second debounce (existing)
4. All buttons have 44px minimum touch targets (existing)
5. Control bar is fixed at bottom, above the input bar
6. Controls work in both portrait and landscape
7. Landscape mode warning is dismissible (existing)
8. Arrow keys work for command history navigation

**Current state:** Most of this is implemented in `Terminal.tsx` `MobileTerminalBar`. This story is about verification and polish.

**Files involved:**
- VERIFY: `src/web/frontend/src/components/Terminal.tsx`

**Depends on:** None

---

### S6-05: Session State Recovery After Reconnect

**As a** mobile user,
**I want** the app to fully restore my session state after reconnecting,
**so that** I can continue where I left off without confusion.

**Size:** 3
**Gap ref:** (Existing from USER_STORIES_GAP_ANALYSIS.md M2-04)

**AC:**
1. On reconnect, client sends `sync_request` with last known sequence number
2. Server responds with all events since that sequence
3. Events are replayed into the activity store
4. Session status is refreshed from `GET /api/sessions/:name`
5. If session was stopped while offline, show "Session ended" state
6. If session is still active, show current status (running/stable/awaiting_input)
7. Conversation history is refreshed from `GET /api/sessions/:name/messages`
8. No duplicate events in the activity feed (idempotency via eventId)

**Current state:** `WebSocketProvider` has `sync_request`/`sync_response` logic. `Broadcaster` has `getEventsSince()`. This story is about ensuring the full flow works end-to-end.

**Files involved:**
- VERIFY: `src/web/frontend/src/providers/WebSocketProvider.tsx`
- VERIFY: `src/web/broadcaster.ts`
- VERIFY: `src/web/server.ts` (sync_request handler)

**Depends on:** None

---

### S6-06: Gesture Navigation

**As a** mobile user,
**I want** to swipe between sessions and swipe to go back,
**so that** the PWA feels like a native app.

**Size:** 3
**Gap ref:** (Mobile UX gap)

**AC:**
1. Swipe right from session view → go back to home
2. Swipe left/right on home view → cycle through sessions (if multiple active)
3. Swipe gestures have 50px threshold to prevent accidental triggers
4. Swipe animation matches iOS/Android native feel (300ms ease-out)
5. Gestures disabled during text input (prevent conflict with keyboard)
6. Gestures work on both iOS Safari and Android Chrome

**Files involved:**
- NEW: `src/web/frontend/src/hooks/useSwipeGesture.ts`
- MODIFY: `src/web/frontend/src/views/SessionView.tsx` (add swipe-back)
- MODIFY: `src/web/frontend/src/views/HomeView.tsx` (add swipe-between)

**Depends on:** None

---

## Summary

### Story Points by Epic

| Epic | Points | Stories | Priority |
|------|--------|---------|----------|
| E0: Quick Wins | 6 | 3 | P0 (do first) |
| E1: Zero-Setup Discovery | 16 | 4 | P0 |
| E2: ACP Protocol Integration | 17 | 5 | P0 |
| E3: MCP Integration | 14 | 4 | P0-P1 |
| E4: Conversation & History | 9 | 3 | P1 |
| E5: Agent Lifecycle | 11 | 3 | P1 |
| E6: Mobile & Network | 18 | 6 | P1-P2 |
| **Total** | **91** | **28** | |

### Implementation Order

**Sprint 0 (Quick Wins — 6 points, 2-3 days):**
- S0-01: Wire /messages Endpoint (2) ← highest impact, lowest effort
- S0-02: Session Restart API/UI (2)
- S0-03: Handle agent_error Events (2)

**Sprint 1 (P0 Foundation — 20 points):**
- S2-03: Replace Destructive Patterns with Tokens (2) ← delete regex, simple
- S2-01: Extend ACP Parser (3)
- S2-02: Agent State Machine for Permissions (5) ← delete regex, state machine
- S1-01: Project Auto-Discovery (5)
- S1-02: MCP Server Auto-Discovery (5)

**Sprint 2 (P0 Experience — 12 points):**
- S2-04: ACP Kind Mapping (3)
- S4-01: Conversation History Display (3)
- S1-03: Complete Model Discovery (3)
- S1-04: Env Var Status Display (3)

**Sprint 3 (P1 Features — 18 points):**
- S3-01: MCP Server Display (3)
- S3-02: MCP Tool Discovery (5)
- S2-05: Conversation Persistence (4)
- S4-04: Files Changed View (2)
- S3-03: MCP Tool Calls in Activity (3)

**Sprint 4 (P1 Resilience — 14 points):**
- S5-01: Crash Recovery (5)
- S5-02: Session Templates (3)
- S5-03: Model Switching UI (3)
- S6-01: Offline Event Summary (3)

**Sprint 5 (P2 Advanced — 12 points):**
- S3-04: MCP Server Management (3)
- S6-03: Push Notification Enhancement (5)
- S6-02: Pull-to-Refresh Verify (1)
- S6-06: Gesture Navigation (3)

**Sprint 6 (P2 Polish — 6 points):**
- S6-04: Terminal Controls Enhancement (3)
- S6-05: Session State Recovery (3)

### Dependency Graph

```
S0-01 (/messages) ─┬── S2-02 (State Machine) ──────────┐
                   └── S4-01 (Conversation UI) ─────────┤
                       └── S2-05 (Persistence) ─────────┤
                                                         │
S0-02 (Restart) ─────────────────────────────────────────┤
S0-03 (agent_error) ────────────────────────────────────┤
                                                         │
S2-03 (Destructive Tokens) ─────────────────────────────┤ ← no deps, do early
                                                         │
S2-01 (ACP Parser) ─┬── S2-02 (State Machine) ─────────┤
                    ├── S2-04 (Kind Mapping) ── S4-04 ──┤
                    └── S3-03 (MCP Activity) ───────────┤
                                                         │
S1-01 (Project Discovery) ─────────────────────────────┤
S1-02 (MCP Discovery) ──── S3-01 (MCP Display) ────────┤
                           ├── S3-02 (Tool Discovery) ──┤
                           ├── S3-04 (MCP Management) ──┤
                           └── S5-02 (Session Templates)┤
                                                         │
S1-03 (Model Discovery) ── S5-03 (Model Switch) ───────┤
S1-04 (Env Var Status) ─────────────────────────────────┤
S5-01 (Crash Recovery) ─────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Zero regex** | Regex patterns are a maintenance trap. Every agent update breaks them. State machines and `String.includes()` are deterministic and readable. |
| **State machine for permissions** | AgentAPI already detects stability. We use its signals (`status_change` + `GET /messages`) instead of re-parsing terminal text. |
| **Token matching for destructive detection** | `command.includes('rm -rf')` is simpler, faster, and more readable than `/\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+\|.*--force)/i`. Same detection accuracy. |
| **MCP read-only in Phase 1** | Writing to `~/.claude.json` risks corrupting user's agent config. Read first, write later with backups. |
| **`GET /messages` as primary data source** | AgentAPI already parses terminal output, strips TUI elements, and tracks conversation. Don't re-parse what it already provides. |

---

*Document generated: 2026-03-20*
*Based on: ARCHITECTURAL_GAP_ANALYSIS.md v4.0, AgentAPI source code analysis, ACP protocol spec, full codebase audit*
*Key principle: Zero regex. State machines + String.includes() + AgentAPI signals.*
