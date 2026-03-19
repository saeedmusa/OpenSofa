# OpenSofa User Stories - Gap Analysis & Roadmap

**Date:** February 18, 2026
**Source:** ARCHITECTURE_TARGET.md v4.4 + Current Implementation Review
**Purpose:** User stories to close gaps between current implementation and target architecture

---

## How to Read This Document

- **Epics** group stories by feature area
- **Stories** use standard format: *As a [role], I want [feature], so that [benefit]*
- **AC** = Acceptance Criteria (testable conditions)
- **Size** = Relative story points (1=trivial, 2=small, 3=medium, 5=large, 8=very large)
- **Status** = Not Started / In Progress / Completed
- **Depends on** = Stories that must be completed first

---

## IMPLEMENTATION STATUS QUO

### Completed (from previous phases)
- P1: Project Foundation & Single Session Loop
- P2: Multi-Session & Feedback Pipeline
- P3: Web Interface & Real-Time Features
- WhatsApp integration
- AgentAPI client
- Session management
- Terminal streaming
- WebSocket server
- PWA frontend with basic session management

### What's Missing (this document's focus)
The target architecture v4.4 specifies features that are not yet implemented or are partially implemented.

---

## Epic M1: Mobile Terminal Controls (MVP Critical)

**Rationale:** Desktop users have keyboard shortcuts. Mobile users MUST have custom controls to send messages, interrupt agents, and manage input.

### M1-01: Send Message Button

**As a** mobile user,
**I want** a prominent "Send" button in the terminal view,
**so that** I can submit my message to the agent without relying on the mobile keyboard's Enter key behavior.

**Size:** 2

**AC:**
1. Terminal component has a visible "Send" button below the input area
2. Clicking Send submits the current input to the agent via WebSocket
3. Button is disabled when input is empty
4. Button shows loading state while message is being sent
5. Button is prominently styled (primary action) - emerald/green color
6. Works on mobile viewport (393px width)

**Status:** Not Started
**Depends on:** None (frontend component exists)

---

### M1-02: Interrupt/Stop Agent Button

**As a** mobile user,
**I want** an explicit "Stop" button that sends Ctrl+C (\x03),
**so that** I can interrupt the agent when it's taking too long or running unwanted commands.

**Size:** 2

**AC:**
1. Terminal component has a "Stop" button (red/danger styled)
2. Clicking Stop sends `\x03` (Ctrl+C) to the agent via WebSocket → AgentAPI
3. Button is always visible, not just when agent is running (for safety)
4. Shows confirmation toast: "Agent interrupted"
5. After interrupt, button becomes disabled briefly (1s) to prevent double-sends

**Status:** Not Started
**Depends on:** M1-01

---

### M1-03: New Line Input Button

**As a** mobile user,
**I want** a "Line" button to insert new lines in multi-line commands,
**so that** I can write commands that span multiple lines without fiddling with the keyboard.

**Size:** 1

**AC:**
1. Terminal has a "Line" or "↵" button
2. Clicking inserts a newline character (`\n`) at cursor position
3. Button is secondary-styled (not as prominent as Send)
4. Works with multi-line input scenarios

**Status:** Not Started
**Depends on:** None

---

### M1-04: Quick Commands Palette

**As a** mobile user,
**I want** a command palette with common actions,
**so that** I can quickly approve, reject, or run /help without typing.

**Size:** 3

**AC:**
1. Lightning bolt (⚡) button opens a modal/popover
2. Shows common commands: /approve, /reject, /stop, /help, /screenshot
3. Each item is a tappable button
4. Closes automatically after selection
5. Accessible from terminal view

**Status:** Not Started
**Depends on:** M1-02

---

## Epic M2: Keep-Alive & Network Resilience (MVP Critical)

**Rationale:** Mobile devices aggressively kill background connections. The app must detect state changes and handle reconnection gracefully.

### M2-01: Page Visibility Detection

**As a** mobile user,
**I want** the app to detect when I switch to another app or the phone locks,
**so that** it can prepare for potential connection drops.

**Size:** 2

**AC:**
1. App listens to `visibilitychange` event
2. When `visibilityState === 'hidden'`, logs "App backgrounded - connection may be dropped"
3. When `visibilityState === 'visible'`, triggers reconnection check
4. Also listens to `pagehide` event for iOS Safari compatibility
5. Does NOT forcibly disconnect - lets socket handle naturally

**Status:** Not Started
**Depends on:** None

---

### M2-02: Smart Reconnection with Exponential Backoff

**As a** mobile user,
**I want** the app to automatically reconnect when network returns,
**so that** I don't have to manually refresh the page.

**Size:** 3

**AC:**
1. WebSocketProvider implements exponential backoff: 1s → 2s → 4s → 8s → 16s (max)
2. After 5 failed attempts, shows error: "Unable to reconnect. Please refresh."
3. On successful reconnect, logs "Reconnected"
4. Resets backoff delay on successful connection
5. Current implementation has basic reconnect - this enhances it with proper backoff

**Status:** Partial (basic reconnect exists, needs backoff enhancement)
**Depends on:** M2-01

---

### M2-03: Offline Message Queue

**As a** mobile user,
**I want** my messages to be queued when I'm offline,
**so that** they're automatically sent when connection is restored.

**Size:** 5

**AC:**
1. When WebSocket is disconnected, new messages are stored in localStorage
2. Queue structure: `{ id, sessionId, content, timestamp }[]`
3. On reconnection, queue is flushed in FIFO order
4. Queue has max 20 messages (per target spec)
5. If queue exceeds max, oldest messages are dropped with warning
6. Queue persists across page refreshes
7. UI shows indicator: "3 messages pending" when offline
8. Messages are sent via WebSocket `message:send` event

**Status:** Not Started
**Depends on:** M2-02

---

### M2-04: Session State Recovery

**As a** mobile user,
**I want** to see what happened while I was offline,
**so that** I understand the current state of the session.

**Size:** 5

**AC:**
1. Each event has a `sequence` number (monotonically increasing)
2. On reconnect, client sends `sync:request` with last known sequence
3. Server responds with missed events since that sequence
4. UI shows banner: "You were offline. X events occurred while you were away."
5. "View Events" button shows the missed activity in the feed
6. Events are replayed into the activity store with proper sequencing

**Status:** Not Started
**Depends on:** M2-03

---

## Epic M3: Error Handling & Recovery (MVP Critical)

**Rationale:** Not all errors are equal. Users need appropriate feedback and recovery actions.

### M3-01: Error Classification

**As a** user,
**I want** errors to be classified so I know if I can recover or need to take action,
**so that** I understand what went wrong and what to do next.

**Size:** 3

**AC:**
1. Error classification system with types:
   - **Transient**: Network blip, timeout (auto-retry)
   - **Recoverable**: Agent crash (auto-restart)
   - **User Error**: Invalid command (show in terminal)
   - **Fatal**: Port in use, permission denied (user action needed)
2. Each error type has distinct user-facing message
3. Transient errors show "Reconnecting..." toast
4. Recoverable errors show "Agent crashed. Restarting..." toast
5. User errors show in terminal as error output
6. Fatal errors show "Fatal error: [message]" with retry option

**Status:** Not Started
**Depends on:** None

---

### M3-02: Agent Crash Recovery

**As a** user,
**I want** the system to automatically restart the agent if it crashes,
**so that** my session continues without manual intervention.

**Size:** 5

**AC:**
1. AgentRecoveryManager listens for AgentAPI 'close' events
2. On crash, attempts restart up to 3 times with 2s delay between attempts
3. Each attempt: cleanup zombie processes → wait → spawn new AgentAPI
4. On success: "Agent restarted. Resuming..."
5. On failure after 3 attempts: "Agent repeatedly crashed. Please restart manually."
6. Session status set to 'failed' after permanent failure

**Status:** Not Started
**Depends on:** M3-01

---

### M3-03: Rate Limiting

**As a** system administrator,
**I want** rate limits on message queue to prevent abuse,
**so that** the system remains stable under high load.

**Size:** 2

**AC:**
1. Server-side rate limiting: 60 messages per minute per session
2. Client-side queue limit: 20 messages max
3. When limit exceeded: "Rate limit exceeded. Please wait."
4. Rate limit reset after 1 minute of no messages

**Status:** Not Started
**Depends on:** None

---

## Epic M4: Mobile UX Enhancements

**Rationale:** Mobile screens are small. UI must be optimized for touch and limited viewport.

### M4-01: Mobile Diff Viewer Optimizations

**As a** mobile user,
**I want** the diff viewer to be optimized for small screens,
**so that** I can review code changes comfortably.

**Size:** 3

**AC:**
1. **Hunk Selector**: Dropdown to jump between hunks (shows "+X -Y" for each)
2. **View Mode Toggle**: Switch between Unified and Split views
3. **Syntax Highlighting**: Proper code coloring
4. **Copy Button**: Copy code snippets to clipboard
5. **Share Button**: Share diff via system share sheet
6. **Collapsible Header**: Tap to hide/show filename
7. **Virtual Scrolling**: Only render visible lines (performance)

**Status:** Partial (DiffViewer exists, needs hunk selector + view toggle)
**Depends on:** None

---

### M4-02: Session Activity Timeline

**As a** mobile user,
**I want** to see a chronological timeline of session activity,
**so that** I can quickly scan what happened.

**Size:** 3

**AC:**
1. Activity feed shows events in chronological order
2. Each event shows: timestamp, type icon, content preview
3. Event types: message, approval, command, error, completion
4. Auto-scroll to latest event (with toggle to disable)
5. Pull-to-refresh to load more history
6. Filter by event type

**Status:** Partial (ActivityFeed exists, needs timeline format)
**Depends on:** None

---

### M4-03: Pre-Change Preview Pattern

**As a** user,
**I want** to see a preview of changes before they're applied,
**so that** I can confirm or reject modifications.

**Size:** 5

**AC:**
1. When agent proposes file changes, show preview modal
2. Preview shows: file paths, diff summary (+X lines, -Y lines)
3. "Approve All" button commits changes
4. "Reject All" button rolls back
5. Per-file granularity: approve some, reject others
6. Preview expires after 5 minutes of inactivity

**Status:** Not Started
**Depends on:** None

---

## Epic M5: Architecture Refinements

**Rationale:** Based on v4.4 bug fixes and clarifications.

### M5-01: ActivityEvent Sequence Numbers

**As a** developer,
**I want** every ActivityEvent to have a sequence number,
**so that** I can track event ordering and implement sync.

**Size:** 2

**AC:**
1. ActivityEvent interface includes `sequence: number`
2. Sequence is monotonically increasing per session
3. Created via EventTransformer.createEvent() helper
4. Used for session recovery and offline sync

**Status:** Not Started
**Depends on:** None

---

### M5-02: Session.pid Field

**As a** developer,
**I want** the Session interface to include the process PID,
**so that** I can kill zombie processes on recovery.

**Size:** 1

**AC:**
1. Session interface has `pid: number` field
2. Set during session creation (from tmux spawn)
3. Used in AgentRecoveryManager.cleanupProcesses()

**Status:** Not Started (already in types.ts? - verify)
**Depends on:** None

---

### M5-03: KeepAliveManager Uses QueuedMessage

**As a** developer,
**I want** KeepAliveManager to use QueuedMessage instead of ActivityEvent,
**so that** queued messages can be properly serialized.

**Size:** 1

**AC:**
1. KeepAliveManager.messageQueue uses type `QueuedMessage[]`
2. QueuedMessage interface: `{ id, sessionId, content, timestamp }`
3. Properly serialized to localStorage

**Status:** Not Started
**Depends on:** None

---

## Epic M6: Model Selection (MVP Enhancement)

**Rationale:** Target spec mentions model selection per session.

### M6-01: Model Selector UI

**As a** user,
**I want** to select which AI model to use for a session,
**so that** I can choose between speed (fast models) and capability (advanced models).

**Size:** 3

**AC:**
1. New session modal has model dropdown
2. Shows available models: claude-3-5-sonnet, gpt-4o, gemini-1.5-pro, etc.
3. Selected model passed to AgentAPI via `--model` flag
4. Model persisted in session state
5. Can change model via `/set <session> agent <agent> <model>`

**Status:** Partial (backend supports model, UI needed)
**Depends on:** None

---

## Summary: Priority Order

### Phase M1: Mobile Terminal Controls (MVP Critical)
| ID | Story | Size | Priority |
|----|-------|------|----------|
| M1-02 | Interrupt/Stop Agent Button | 2 | P0 |
| M1-01 | Send Message Button | 2 | P0 |
| M1-03 | New Line Input Button | 1 | P1 |
| M1-04 | Quick Commands Palette | 3 | P2 |

### Phase M2: Keep-Alive & Network Resilience (MVP Critical)
| ID | Story | Size | Priority |
|----|-------|------|----------|
| M2-01 | Page Visibility Detection | 2 | P0 |
| M2-02 | Smart Reconnection | 3 | P0 |
| M2-03 | Offline Message Queue | 5 | P0 |
| M2-04 | Session State Recovery | 5 | P1 |

### Phase M3: Error Handling (MVP Critical)
| ID | Story | Size | Priority |
|----|-------|------|----------|
| M3-01 | Error Classification | 3 | P0 |
| M3-02 | Agent Crash Recovery | 5 | P1 |
| M3-03 | Rate Limiting | 2 | P2 |

### Phase M4: Mobile UX Enhancements
| ID | Story | Size | Priority |
|----|-------|------|----------|
| M4-01 | Mobile Diff Viewer | 3 | P1 |
| M4-02 | Activity Timeline | 3 | P2 |
| M4-03 | Pre-Change Preview | 5 | P3 |

### Phase M5: Architecture Refinements
| ID | Story | Size | Priority |
|----|-------|------|----------|
| M5-01 | ActivityEvent Sequence | 2 | P1 |
| M5-02 | Session.pid Field | 1 | P1 |
| M5-03 | KeepAliveManager Types | 1 | P2 |

### Phase M6: Model Selection
| ID | Story | Size | Priority |
|----|-------|------|----------|
| M6-01 | Model Selector UI | 3 | P2 |

---

## Total Story Points by Phase

| Phase | Points | Stories |
|-------|--------|---------|
| M1: Mobile Terminal Controls | 8 | 4 |
| M2: Keep-Alive & Network | 15 | 4 |
| M3: Error Handling | 10 | 3 |
| M4: Mobile UX | 11 | 3 |
| M5: Architecture | 4 | 3 |
| M6: Model Selection | 3 | 1 |
| **Total** | **51** | **18** |

---

## Notes

- **Current Status**: Most core functionality exists (P1-P3 phases complete)
- **Focus**: These stories address the v4.4 MVP requirements specifically
- **Dependencies**: Stories are ordered to minimize blocking
- **Size Estimate**: Total ~51 points suggests 6-8 sprints of work
