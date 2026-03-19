## Overview

This document captures the confirmed architecture for OpenSofa v5.0 and the 4 critical design decisions made after a full review of v4.4. The core **Sandwich Architecture** is correct and unchanged. These are targeted fixes that eliminate production failure risks and reduce build time.

---

## The Sandwich Architecture (Confirmed Correct)

The phone is purely a **display + input terminal**. All compute, storage, and LLM spend stays on the laptop. The Node Hub is the brain.

```
PHONE (PWA — installed to home screen)
  ↕ Socket.IO/WSS          → foreground (screen on)
  ↕ ntfy.sh API            → background (screen locked)

NODE.JS HUB (laptop)
  - Session Manager        (better-sqlite3, WAL mode ON)
  - Event Transformer      (AgentAPI SSE → ActivityEvent cards)
  - Message Queue          (hold messages while agent is busy)
  - Auth                   (256-bit token, QR code pairing)
  - ntfy-topic             (User-configured topic string)
  - Cloudflared tunnel     (zero-config remote access)
  ↕ HTTP/SSE

AGENTAPI (laptop)
  - Structured events: message.updated, status.changed
  - No regex parsing ever
  ↕ Spawns

OPENCODE (laptop)
  - All LLM compute happens here
  - File writes, terminal, model calls
```

**Key principle:** Never stream raw terminal output to the phone. The ActivityParser on Node transforms AgentAPI SSE events into structured ActivityEvent cards before [Socket.IO](http://Socket.IO) sends them. The phone only ever receives clean, typed objects.

---

## Design Principles

### 1. Deep, Not Broad

Build excellent OpenCode support before adding other agents. Get the one agent experience production-grade first.

### 2. Structured Over Parsed

Use AgentAPI's structured SSE events. Never use regex on terminal output — it breaks every time OpenCode changes its output format.

### 3. Steal, Don't Build

Use proven libraries wherever possible. Every line of custom code is a bug waiting to happen.

### 4. Mobile-First, Terminal-Second

The Activity Feed (cards) is the primary mobile experience. The raw xterm.js terminal is secondary and hidden on mobile by default. If it doesn't work perfectly on a 390px screen, it belongs behind an Advanced menu.

### 5. Zero-Config Remote Access

The bundled cloudflared tunnel handles remote access. No port forwarding. No router config. One command.

### 6. Agent Runs on Laptop Always

Even if the phone disconnects, goes offline, or the screen locks — the agent keeps running. The phone is a remote control, not the engine.

---

## The 4 Critical Changes from v4.4

### Fix 1: Utilize ntfy.sh for Push Notifications

**Problem:** The ntfy native iOS app stopped delivering notifications in July 2024 (GitHub issue #1191). This is a broken dependency with user friction.

**Fix:** Use the web-push npm package with VAPID keys. iOS 16.4+ natively supports Web Push for installed PWAs — no extra app required.

How it works (3 steps):

1. On startup, Node generates a VAPID keypair once and saves it to SQLite
2. PWA asks user "Allow notifications?" — browser returns a subscription object (endpoint + encryption keys)
3. PWA sends that subscription to Node backend. Node saves it in SQLite.

When agent stalls and socket is dead:

```jsx
webpush.sendNotification(savedSubscription, JSON.stringify({
  title: "Approval needed",
  body: "rm -rf dist — tap to review",
  url: "/sessions/my-project?action=approve"
}));
```

Architecture change:

```
BEFORE: Node → HTTP POST → ntfy.sh → ntfy app → phone
AFTER:  Node → web-push  → phone OS (direct, no middleman)
```

**Requirements:** ntfy.sh app installed on mobile, or subscribed via web browser.

---

### Fix 2: Hide xterm.js on Mobile by Default

**Problem:** xterm.js has an open GitHub issue since 2017 for limited mobile touch support. Copy/paste doesn't work reliably on iOS.

**Fix:** This is a routing decision, not a library replacement.

The phone has two views of a session:

- **View A — Activity Feed (Primary):** Cards. This is 90% of what users need.
- **View B — Terminal (Advanced):** Raw xterm.js. Hidden on mobile.

**Hard rule:**

```
if (screenWidth < 768px) {
  // Show: Activity Feed, Diff Viewer, Approval Cards
  // Hide: Terminal tab → move to Settings → Advanced → View Terminal
}
```

**Diff viewer library:** Use react-diff-viewer-continued@4.1.2 (maintained fork, updated February 2026, React 18/19 compatible). Do NOT use the original react-diff-viewer — abandoned in 2020.

On mobile, always render the diff in unified mode:

```tsx
<ReactDiffViewer
  splitView={false}
  useDarkTheme={true}
/>
```

---

### Fix 3: SQLite WAL Mode (One Line)

**Problem:** By default, SQLite write-locks the entire database. Concurrent read + write causes queuing delays under load.

**Fix:** Add one line to database initialisation:

```jsx
const db = new Database('opensofa.db');
db.pragma('journal_mode = WAL');
```

WAL mode removes the write-lock. Reads and writes happen concurrently without blocking each other.

---

## Component Decision Table

| Component | Decision | Library | Reason |
| --- | --- | --- | --- |
| Push notifications | Use [ntfy.sh](http://ntfy.sh) | Simple POST requests | Rock-solid reliability |
| Terminal on mobile | Hide by default | xterm.js behind Advanced menu | Mobile touch unresolved since 2017 |
| Diff viewer | Replace | react-diff-viewer-continued@4.1.2 | Original abandoned 2020 |
| SQLite mode | Change | WAL mode (one line) | Concurrent read/write |
| WebSocket | Keep | [Socket.IO](http://Socket.IO) | Mature, handles mobile reconnects |
| Tunnel | Keep | cloudflared npm | Best free zero-config WSS tunnel |
| Backend | Keep | Hono | Faster than Express, streaming-native |
| Agent interface | Keep | AgentAPI SSE sandwich | Structured events, no regex |
| Auth | Keep | 256-bit token + QR code | Simple, secure |
| Persistence | Keep | better-sqlite3 (WAL) | Fastest SQLite driver for Node |

---

## The 3 Streaming Failure Modes & Solutions

### Failure Mode 1: iOS 30-Second WebSocket Kill

When the phone screen locks, iOS kills WebSocket connections after ~30 seconds.

Solution:

1. Node detects socket.ondisconnect → marks user offline
2. Agent stalls → Node sends push notification via ntfy.sh
3. User taps notification → deep link opens OpenSofa PWA
4. PWA fetches SQLite catch-up summary (all missed events since last sequence)
5. WebSocket re-established → Node marks user online

### Failure Mode 2: Phone Offline

Phone loses network. Agent keeps running on laptop.

Solution: SQLite-backed message queue on Node. Events stored with sequence numbers. On reconnect, phone sends syncRequest: { since: lastSequence } and Node replays missed events.

### Failure Mode 3: Event Flood on Reconnect

Agent runs for an hour while phone sleeps. Phone reconnects to hundreds of events.

Solution: Sequence numbers on every ActivityEvent. Node replays only events after last known sequence. Cap at 1000 events per session (FIFO eviction). PWA renders a Catch-Up Summary card.

---

## Critical Path — What to Build First

1. **agentapi-client.ts** (AUDIT) — Verify it targets OpenCode native SSE endpoint. Highest risk. Do this first.
2. **activity-parser.ts** — Migrate from regex to AgentAPI SSE event consumption
3. **session-manager.ts** — Add AWAITING_HUMAN_INPUT state + sequence number tracking
4. **broadcaster.ts** — Add sequence numbers to all [Socket.IO](http://Socket.IO) broadcast events
5. **Push Notifications** — `ntfy.sh` API integrations and `NotificationSettings.tsx` update
6. **ActivityFeed.tsx** — Switch to SSE-based ActivityEvent cards
7. **DiffViewer.tsx** — Mobile pagination, splitView={false}

---

## References

- [ntfy.sh](http://ntfy.sh) iOS issue: https://github.com/binwiederhier/ntfy/issues/1191
- ntfy docs: https://docs.ntfy.sh
- xterm.js mobile issue: https://github.com/xtermjs/xterm.js/issues/1101
- react-diff-viewer-continued: https://www.npmjs.com/package/react-diff-viewer-continued
- better-sqlite3 WAL: https://wchargin.github.io/better-sqlite3/performance.html