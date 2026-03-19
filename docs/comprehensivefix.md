# OpenSofa — Comprehensive Fix List

> Deep audit of every capability a mobile coding agent needs, cross-referenced against `newArchitecture.md` and the current implementation. Includes PWA sizing audit, architecture compliance scorecard, and all known issues.
>
> **Last updated:** 2026-03-14

---

## 📊 newArchitecture.md Compliance Scorecard

| Spec Item | Status | Notes |
|-----------|--------|-------|
| **Fix 1:** Push Notifications (ntfy.sh) | ✅ Done | `notifier.ts` with ntfy API, `NotificationSettings.tsx` form |
| **Fix 2:** Hide xterm on mobile | ✅ Done | `SessionTabBar` shows Feed/Files only; terminal behind `lg:` on desktop |
| **Fix 3:** SQLite WAL mode | ✅ Done | `db.ts` line 11: `db.pragma('journal_mode = WAL')` |
| **Fix 4 (implied):** Socket.IO | ❌ Not done | Still using raw `ws` — see A2 below |
| Structured events (no regex) | ❌ Not done | `activity-parser.ts` still uses regex `PATTERNS` — see A1 |
| Catch-up summary on reconnect | ❌ Not done | `CatchUpCard.tsx` exists but backend never emits event — see A3 |
| SQLite event persistence | ⚠️ Partial | Table created, broadcaster updated, but no sequence-based replay on sync_request |
| Message queue wired | ⚠️ Partial | Queue wired into session pipeline but replay-on-stable not confirmed working |
| Push on disconnect + stall | ⚠️ Partial | Push on `approval:needed` works, but not on "last client disconnected" — see A7 |
| DiffViewer `splitView={false}` on mobile | ✅ Done | `DiffViewer.tsx` uses `useDarkTheme` and `splitView` props correctly |
| `react-diff-viewer-continued` | ✅ Done | Using maintained fork as specified |

---

## 🧹 Category 1: WhatsApp Removal (Full Purge)

Every trace of WhatsApp must go. The architecture is web-only + PWA.

| # | What | File(s) | Fix | Status |
|---|------|---------|-----|--------|
| W1 | `@whiskeysockets/baileys` dependency | `package.json` | Remove from dependencies | ✅ Done |
| W2 | WhatsApp handler test file | `tests/whatsapp-handler.test.ts` | Delete file | ✅ Done |
| W3 | Dead delivery-manager test files | `tests/delivery-manager*.test.ts` | Delete files | ✅ Done |
| W4 | `groupJid` references in tests | `state-persistence.test.ts`, `resource-monitor.test.ts` | Remove from fixtures | ✅ Done |
| W5 | WhatsApp text — auth screen | `App.tsx:78` | Change message | ✅ Done |
| W6 | WhatsApp text — HomeView auth | `HomeView.tsx:96-99` | Same fix | ✅ Done |
| W7 | WhatsApp text — empty sessions | `SessionList.tsx:43` | Change message | ✅ Done |
| W8 | WhatsApp text — session toast | `NewSessionModal.tsx:104` | Change message | ✅ Done |
| W9 | WhatsApp text — sidebar | `Sidebar.tsx:13,38` | Change toast | ✅ Done |
| W10 | WhatsApp comments in source | `main.ts:57,85`, `session-manager.ts:6` | Update comments | ✅ Done |
| W11 | WhatsApp phone number config | `check-prerequisites.ts:110` | Remove WA number check | ❌ TODO |
| W12 | WhatsApp setup script | `setup.sh:155-239` | Rewrite for web-only | ❌ TODO |
| W13 | README describes WhatsApp bridge | `README.md` | Full rewrite | ❌ TODO |
| W14 | Compiled dist/ with WA code | `dist/` | Rebuild after cleanup | ❌ TODO |
| W15 | Legacy docs with WA refs | `BROWNFIELD_MIGRATION.md`, `USER_STORIES.md` | Clean references | ❌ TODO |

---

## ⚙️ Category 2: Architecture Spec Alignment

Things `newArchitecture.md` explicitly requires but aren't done.

| # | Issue | Spec Ref | Status | Fix |
|---|-------|----------|--------|-----|
| A1 | ActivityParser uses regex | Principle #2 | ❌ | Rewrite to consume structured SSE events |
| A2 | Raw WS instead of Socket.IO | Component Table | ❌ | Replace `ws` with `socket.io` for auto-reconnect, rooms, heartbeat |
| A3 | No `catch_up_summary` event | Failure Mode 3 | ❌ | Add catch-up generation to `sync_request` handler |
| A4 | Event history in-memory | SQLite-backed queue | ⚠️ | Table created; need sequence-based replay on `sync_request` |
| A5 | State persistence uses JSON | SQLite everywhere | ❌ | Migrate `state-persistence.ts` to SQLite |
| A6 | Message queue not fully wired | Message Queue spec | ⚠️ | Queue wired; verify replay-on-stable works |
| A7 | Push not on disconnect+stall | Failure Mode 1 | ⚠️ | Track client count, push when 0 clients + approval fires |

---

## 📱 Category 3: Mobile Coding Agent Capabilities

### ✅ Already Implemented
- Session creation with agent/dir/model picker (NewSessionModal)
- File tree browser + **file content preview** (FileView + FileContent.tsx)
- Activity feed with grouped events (ActivityFeed)
- Approval cards (ApprovalCard + DeepLinkApprovalModal)
- Send messages to agent (SessionView textarea)
- Pull-to-refresh (HomeView)
- **Voice input wired** to SessionView (both mobile and desktop)
- Desktop 3-panel layout (Activity | Terminal | Files)
- Mobile tab bar (Feed | Files)
- DiffViewer with unified/split toggle (forced unified on mobile)
- **Git branch display** in SessionCard (line 69-73)
- Connection status, keyboard shortcuts, haptic feedback
- Notification settings, SW update prompt
- Service worker with push + background sync + offline page

### 🔴 Missing / Broken

| # | Capability | Status | Fix |
|---|-----------|--------|-----|
| M1 | Voice input | ✅ Done | Wired into SessionView |
| M2 | File content preview | ✅ Done | FileContent.tsx exists |
| M3 | Code search/grep from phone | ❌ | Add `/api/sessions/:name/search` + SearchBar UI |
| M4 | Repo/dir switcher mid-session | ❌ | Add "Switch Directory" UI |
| M5 | Git branch in SessionCard | ✅ Done | Already implemented |
| M6 | Git diff in activity events | ❌ | Run `git diff` on file_edit events |
| M7 | Conversation history viewer | ❌ | Full agent message log from SSE |
| M8 | Session rename/duplicate | ❌ | Add rename API + UI |
| M9 | Dark/light theme toggle | ❌ | Theme toggle in settings + localStorage |
| M10 | iOS PWA install prompt | ⚠️ | Component exists but has build error (see F1 below) |

---

## 📐 Category 4: PWA Sizing & Cross-Platform (NEW)

Audit of how the PWA renders on different devices and screen sizes.

### ✅ What's Correct
- `viewport-fit=cover` in `index.html` meta tag ✅
- `safe-area-inset` CSS env() vars applied to `body` ✅
- `.safe-area-inset` utility class for components ✅
- `apple-mobile-web-app-capable` and `black-translucent` status bar ✅
- Custom breakpoint `sm: 393px` matches iPhone 15 Pro ✅
- `useResponsive` hook with debounced resize (mobile < 768, tablet 768-1024, desktop ≥ 1024) ✅
- `.btn` min-height 44px (iOS touch target) ✅
- `VoiceInput` touch target `min-w-[48px] min-h-[48px]` ✅
- SessionView has `pb-32` to clear bottom TabBar ✅

### 🔴 PWA Sizing Issues

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| S1 | **Tailwind config colors conflict with CSS @theme colors** | `tailwind.config.js` defines blue accent `#3b82f6`, dark blues; `index.css @theme` defines green accent `#40a42d`, dark greens. Two competing design systems. | Unify: remove Tailwind color overrides, rely solely on CSS `@theme` variables. Or sync them to match. |
| S2 | **`btn-sm` min-height is 32px** — below 44px iOS touch target | Small buttons may be hard to tap on mobile | Change `btn-sm` min-height to `44px` or add `touch-target` class fallback on mobile |
| S3 | **`floating-tab-bar` CSS class has no styles** | TabBar uses `className="floating-tab-bar"` but no matching CSS rule exists | Add `.floating-tab-bar` styles (background blur, border-top, shadow) or remove class |
| S4 | **No landscape orientation handling** | Phone in landscape gets awkward tall layout; manifest says `portrait-primary` | Add landscape media query (or unlock orientation in manifest); test with `orientation: landscape` |
| S5 | **No tablet-optimised layout** | `useResponsive` has `isTablet` but no component uses it — tablets get mobile layout | Add tablet breakpoint layouts (e.g., 2-panel side-by-side for iPad) |
| S6 | **No iOS splash screen (launch image)** | PWA launches with black screen before content loads on iOS | Add `apple-touch-startup-image` meta tags for various iPhone/iPad sizes |
| S7 | **TabBar doesn't account for home indicator separately** | `safe-area-inset` class adds padding but the `h-16` (64px) is the tab bar content height — total height varies per device | Use `calc(64px + env(safe-area-inset-bottom))` for consistent sizing |
| S8 | **Manifest missing `display_override`** | `display: standalone` is correct but `display_override: ["standalone", "minimal-ui"]` provides better fallback | Add `display_override` array |
| S9 | **No 180×180 apple-touch-icon** | iOS requires 180×180px icon specifically; only 512px provided | Generate 180×180 PNG and add `<link rel="apple-touch-icon" sizes="180x180">` |

---

## 🌐 Category 5: PWA Cross-Platform Hardening

| # | Issue | Platform | Fix | Status |
|---|-------|----------|-----|--------|
| P1 | iOS requires Home Screen install for push | iOS 16.4+ | Install banner | ⚠️ F1 |
| P2 | iOS push subscriptions silently disappear | iOS | Re-subscribe on app activation | ❌ |
| P3 | EU iOS 17.4+ breaks standalone mode | iOS (EU) | Detect + inform user | ❌ |
| P4 | Android battery opt blocks notifications | Android | Note in NotificationSettings | ❌ |
| P5 | No manifest `id` field | All | Add `"id": "/"` | ❌ |
| P6 | Missing `prefer_related_applications` | All | Add `false` | ❌ |
| P7 | No offline data display | All | Show cached session list when offline | ❌ |
| P8 | SW doesn't handle API token in sync | All | Pass auth headers in background sync | ❌ |

---

## 🔄 Category 6: Future Agent Interoperability

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| I1 | Regex patterns in ActivityParser | Parse structured SSE events | ❌ |
| I2 | Hardcoded model lists | Fetch from backend dynamically | ❌ |
| I3 | Single agent per session UI | Add agent-switch button | ❌ |
| I4 | No universal ToolCallEvent type | Define standard type + renderer | ❌ |
| I5 | Static VALID_AGENTS config | Dynamic agent-registry | ❌ |

---

## 🧪 Category 7: Code Hygiene & Testing

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| T1 | Dead WA test files | Delete | ✅ Done |
| T2 | WA-era command tests | Update or remove | ❌ |
| T3 | No tests for broadcaster | Add | ❌ |
| T4 | No tests for push.ts | Add | ❌ |
| T5 | No integration tests | Add with mocked AgentAPI | ❌ |
| T6 | session-wizard.test.ts may be dead | Verify and update/remove | ❌ |
| T7 | Stale dist/ artifacts | Add to .gitignore, rebuild | ❌ |

---

## ⚠️ Category 8: Known Bugs & Build Issues (ACTIVE)

These are bugs discovered during implementation that need immediate attention.

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| F1 | **iOSInstallBanner TypeScript JSX error** | Function name `iOSInstallBanner` starts with lowercase `i` — React/JSX treats lowercase tags as intrinsic HTML elements, not components. Error: "Property 'iOSInstallBanner' does not exist on type 'JSX.IntrinsicElements'" | **Rename** to `IOSInstallBanner` (uppercase `I`) in both filename and export. React requires components to start with uppercase. |
| F2 | **README.md still describes WhatsApp bridge** | Not rewritten yet | Full rewrite for web-only PWA architecture |
| F3 | **A2: Socket.IO not implemented** | Architecture spec says Socket.IO but implementation uses raw `ws` | Replace — this gives auto-reconnect, rooms, heartbeat for free (eliminates custom reconnect logic in `WebSocketProvider.tsx`) |
| F4 | **A7: Push on disconnect + stall incomplete** | Push fires on `approval:needed` but doesn't detect "last client left" | Track `connectedClients` count in broadcaster; when count → 0 and approval event fires, send push |

---

## 📋 Updated Sprint Plan

### Sprint 1: Hygiene & WhatsApp Purge (1-2 days)
- [ ] W11-W15: Remaining WhatsApp removal (scripts, README, docs, dist)
- [ ] T2, T6-T7: Clean dead tests, stale dist
- [ ] **F1: Fix iOSInstallBanner naming** (rename to `IOSInstallBanner`)
- [ ] **S1: Unify Tailwind/CSS color systems**
- [ ] **S3: Add `.floating-tab-bar` CSS styles**

### Sprint 2: PWA Sizing & Mobile Polish (2-3 days)
- [ ] S2: Fix `btn-sm` touch target
- [ ] S4: Landscape orientation handling
- [ ] S5: Tablet-optimised layout using `isTablet`
- [ ] S6: iOS splash screen images
- [ ] S7: TabBar home indicator spacing
- [ ] S8-S9: Manifest `display_override`, 180px icon
- [ ] P1-P2: iOS install banner (once F1 fixed) + subscription health check
- [ ] P5-P6: Manifest `id` and `prefer_related_applications`

### Sprint 3: Architecture Alignment (3-5 days)
- [ ] A1: Rewrite ActivityParser for structured events
- [ ] A3: Implement catch_up_summary backend
- [ ] A4: Complete sequence-based replay on sync_request
- [ ] A6: Verify message queue replay-on-stable
- [ ] A7: Push on disconnect + stall (F4)
- [ ] M6: Git diffs in activity events

### Sprint 4: Interop & Advanced (3-5 days)
- [ ] A2/F3: Replace raw WS with Socket.IO
- [ ] I1-I4: Agent interoperability
- [ ] M3: Code search from mobile
- [ ] M7: Conversation history viewer
- [ ] M9: Dark/light theme toggle
- [ ] A5: Migrate state persistence to SQLite

### Sprint 5: Testing & Polish (2-3 days)
- [ ] T3-T5: Missing tests (broadcaster, push, integration)
- [ ] P3-P4, P7-P8: PWA hardening (EU, offline, battery, auth)
- [ ] M4, M8: Directory switcher, session rename
- [ ] I2, I5: Dynamic model lists, agent registry
- [ ] F2: README rewrite

---

## Deep Analysis: Remaining Critical Issues

### Issue #3: Port Allocation Infinite Loop

**Location:** `src/session-manager.ts:463-470`

**Problem:**
```typescript
private allocatePort(): number {
  let port = this.config.portRangeStart;
  while (this.usedPorts.has(port)) {
    port++;  // INFINITE LOOP if all ports in range are used!
  }
  this.usedPorts.add(port);
  return port;
}
```

**Analysis:**
- If all ports in the range (default: 3284 to infinity) are allocated, this will loop forever
- No max port boundary check exists
- Port range is unbounded (portRangeStart only, no portRangeEnd)

**Fix Required:**
```typescript
private allocatePort(): number {
  const maxPort = this.config.portRangeStart + 10000; // Reasonable max
  let port = this.config.portRangeStart;
  while (this.usedPorts.has(port)) {
    port++;
    if (port > maxPort) {
      throw new Error('No available ports in range');
    }
  }
  this.usedPorts.add(port);
  return port;
}
```

---

### Issue #1: Race Condition in Session Creation

**Location:** `src/session-manager.ts:275-365`

**Problem:**
- Uses `creatingSessions` Set for guard but:
  1. No atomic check-and-set operation
  2. Between check and set, another concurrent call could slip through
  3. If create fails mid-way, `creatingSessions` might not be cleaned up properly

**Analysis:**
The current code has:
```typescript
if (this.creatingSessions.has(name)) {
  throw new Error(`Session '${name}' is already being created`);
}
this.creatingSessions.add(name);
```

This is a classic TOCTOU (Time-of-Check-Time-of-Use) race condition. Two concurrent requests with same name could both pass the check before either adds to the set.

**Fix Required:**
Use a mutex/lock pattern or database-level locking for atomic operations.

---

### Issue #4: Missing Error Propagation

**Location:** Multiple files with EventEmitter error handling

**Problem:**
- Errors in event handlers often get swallowed
- No centralized error handling for event emitter chains
- Some async errors may not propagate correctly

**Analysis:**
The Node.js EventEmitter has a special `error` event - if emitted with no listener, Node.js crashes the process. Current code has some error handlers but may not cover all paths.

**Required Fix Pattern:**
```typescript
// Always add error handler to prevent crashes
emitter.on('error', (err) => {
  log.error('Emitter error', { error: err.message, stack: err.stack });
  // Decide: emit to parent, fallback, or graceful degradation
});
```

---

### Issue #5: Timer Cleanup Race

**Location:** Multiple files with `setTimeout`/`setInterval`

**Problem:**
- Timers created but not always cleared on shutdown
- If component restarts quickly, old timers might fire with stale state
- `pendingApproval.timeoutId` could fire after session is stopped

**Analysis:**
Looking at `session-manager.ts:1276-1280`:
```typescript
pending.timeoutId = setTimeout(() => {
  void this.handleApprovalTimeout(session);
}, this.config.approvalTimeoutMs);
```

If session is stopped before timeout fires, the timeout still fires with stale session reference.

**Fix Required:**
- Always store timeout IDs
- Clear all timeouts in session cleanup
- Use `clearTimeout` in session `disconnectAllRuntime` and `stopSession`

---

### Issue #9: Missing Error Handlers on EventEmitters

**Location:** Various emitters throughout codebase

**Analysis:**
Search for `.on(` without matching `.on('error'`:

**Found emitters needing error handlers:**
1. `sessionManager` in main.ts - has error handlers ✅
2. `feedbackController` - has error handler ✅  
3. `resourceMonitor` - NO explicit error handler found ❌
4. `tunnelManager` - process error handler only ✅
5. `WebSocketServer` - has error handler ✅

**ResourceMonitor error handler missing:**
```typescript
// Add to resource-monitor.ts constructor:
this.on('error', (err) => {
  log.error('ResourceMonitor error', { error: err.message });
});
```

---

### Issue #11: Resource Monitor Double-Start

**Location:** `src/resource-monitor.ts:96-102`

**Problem:**
```typescript
start(): void {
  if (this.running) {
    log.warn('Resource monitor already running');
    return;  // Just warns, doesn't prevent issues
  }
  // ... setup code
}
```

**Analysis:**
- The guard is correct but returns silently - could mask issues
- If `start()` called from multiple places in startup sequence, might miss initialization
- Should throw error or use a more robust pattern

**Fix Required:**
```typescript
start(): void {
  if (this.running) {
    throw new Error('Resource monitor already running - duplicate start call');
  }
  // ... setup
}
```

---

## Recommended Fix Implementation Order

### Phase 1: Critical Safety Fixes (Do First)
1. **#3 Port Allocation** - Add max boundary to prevent infinite loop
2. **#5 Timer Cleanup** - Ensure all timers cleared on session stop
3. **#11 Resource Monitor** - Make double-start throw error

### Phase 2: Race Conditions & Error Handling
4. **#1 Session Creation Race** - Add proper locking/atomic operations
5. **#4 Error Propagation** - Add centralized error handling
6. **#9 EventEmitter** - Add missing error handlers

### Phase 3: Testing & Validation
7. Write tests for each fix
8. Run integration tests
9. Load test for port allocation

---

## Implementation Notes

All fixes should follow these patterns:

**Port Allocation Pattern:**
```typescript
private allocatePort(): number {
  const maxPort = this.config.portRangeStart + 10000;
  let port = this.config.portRangeStart;
  while (this.usedPorts.has(port)) {
    port++;
    if (port > maxPort) {
      throw new Error(`No available ports - exhausted range ${this.config.portRangeStart}-${maxPort}`);
    }
  }
  this.usedPorts.add(port);
  return port;
}
```

**Timer Cleanup Pattern:**
```typescript
// Store all timers
private sessionTimers = new Map<string, NodeJS.Timeout>();

// When creating timer
const timerId = setTimeout(() => {...}, timeout);
this.sessionTimers.set(sessionName, timerId);

// When stopping session
const timerId = this.sessionTimers.get(sessionName);
if (timerId) {
  clearTimeout(timerId);
  this.sessionTimers.delete(sessionName);
}
```

**EventEmitter Error Pattern:**
```typescript
// Always at end of constructor
this.on('error', (err) => {
  this.logger.error('Emitter error', { error: err.message, stack: err.stack });
});
```

### CRITICAL Fixes:
1. **#6 Command Injection in Git**: Created `src/utils/safe-shell.ts` with `safeGitExec()` and `safeTmuxExec()` functions. Updated session-manager.ts to use these instead of string-interpolated execSync calls.

2. **#7 Command Injection in Tmux**: Same as above - replaced all tmux execSync calls with safeTmuxExec().

3. **#2 ReDoS Vulnerability**: Fixed auth.ts `parseAuthHeader()` to use simple string operations instead of regex for Bearer token parsing.

4. **#22 Rate Limit Bypass**: Enhanced rate-limit.ts to properly validate and sanitize x-forwarded-for headers, preventing IP spoofing.

### HIGH Priority Fixes:
5. **#23 Path Traversal in Browse**: Enhanced server.ts browse endpoint to use canonical paths (fs.realpathSync.native) for traversal detection, matching the security used in upload.ts.

6. **#15 Unsafe Shell in Agent Detection**: Updated agent-registry.ts, terminal-stream.ts, and tunnel.ts to use execFileSync instead of execSync for 'which' commands.

### Files Created:
- `src/utils/safe-shell.ts` - Safe shell execution utilities with:
  - `safeExec()` - Execute commands with array arguments
  - `safeGitExec()` - Safe git command execution
  - `safeTmuxExec()` - Safe tmux command execution
  - `safeShell()` - Shell execution with dangerous pattern detection
  - `isSafePath()` - Path validation
  - `isSafeFilename()` - Filename validation

---

## Recently Implemented Fixes (2026-03-14 Extended)

### ✅ Issue #3: Port Allocation Infinite Loop - FIXED
- Added max port boundary (portRangeStart + 10000) to prevent infinite loop
- Now throws descriptive error when port range exhausted
- Location: `src/session-manager.ts:463-474`

### ✅ Issue #11: Resource Monitor Double-Start - FIXED
- Changed from silent warning to throwing error
- Added error handler to ResourceMonitor constructor to prevent process crashes
- Location: `src/resource-monitor.ts:60-70, 96-100`

### ✅ Timer Cleanup - VERIFIED WORKING
- `clearPendingApproval` properly clears timeout IDs
- Called from `clearRuntime` which is invoked in all session stop paths
- No additional code changes needed - pattern is correct
