# OpenSofa v4.0 — Open Issues Review

> **Perspective:** Product Manager. Can a user code on the move using this PWA without any setup while mobile?
>
> **Scope:** End-to-end audit of the user journey: access → auth → session → prompt → stream → approve → terminal → files → reconnect.

---

## Previously Fixed (this session)

| # | Issue | Status |
|---|---|---|
| 1 | Image upload formData field mismatch (`image` → `file`) | ✅ Fixed |
| 2 | CameraUpload not wired into SessionView | ✅ Fixed |
| 3 | Uploaded images not forwarded to agent | ✅ Fixed |
| 4 | sync_request payload shape mismatch | ✅ Fixed |
| 5 | No auto-approve toggle in UI | ✅ Fixed |
| 6 | No stop/cancel button during agent execution | ✅ Fixed |
| 7 | ACP approval detection missing for Claude/Goose | ✅ Fixed |
| 8 | E2E test token not guarded for production | ✅ Fixed |
| 9 | Redundant 3s polling alongside WebSocket | ✅ Fixed |
| 10 | 42 `.bak` files cluttering repo | ✅ Fixed |
| 11 | Dedup set too small (1000 → 5000) | ✅ Fixed |
| 12 | `PATCH /sessions/:name` for settings updates | ✅ Added |

| 13 | Per-agent rejection strategies (was hardcoded 'no\n') | ✅ Fixed |
| 14 | WS auth token in URL query string | ✅ Fixed (moved to first message) |
| 15 | Dead InputBar.tsx component | ✅ Removed |

---

## Verification of P0 Claims

### ❌ INCORRECT: "ConversationHistory never updates after initial load"

**Actual State:** ConversationHistory **DOES** have WebSocket subscriptions.

**File:** `src/web/frontend/src/components/ConversationHistory.tsx:161-205`

The component subscribes to:
- `session_updated` → triggers message refetch
- `activity` → captures streaming text + refetches messages  
- `approval_needed` → refetches messages
- `approval_cleared` → refetches messages

**Finding:** Messages ARE updated via WS events. The `activity` event triggers `debouncedRefetch()` which calls `fetchMessages()`.

---

### ❌ INCORRECT: "No streaming/real-time text display"

**Actual State:** Streaming text **IS** implemented.

**File:** `src/web/frontend/src/components/ConversationHistory.tsx:92,178-181,263-281`

Features:
- `streamingText` state accumulates agent output
- "typing..." indicator with animated pulse
- Auto-scroll as text arrives
- Clears when completed messages arrive

**Finding:** Real-time streaming IS working.

---

### ❌ INCORRECT: "FileBrowser/FileView never refreshes"

**Actual State:** FileBrowser **DOES** subscribe to file change events.

**File:** `src/web/frontend/src/components/FileBrowser.tsx:37-55`

```typescript
const FILE_CHANGE_TYPES = new Set(['file_created', 'file_edited', 'file_deleted']);

useEffect(() => {
  const unsub = subscribe('activity', (event) => {
    const hasFileChange = payload.events?.some(e => FILE_CHANGE_TYPES.has(e.type));
    if (hasFileChange) {
      debouncedInvalidate(); // Refreshes file tree
    }
  });
}, [subscribe, sessionName, debouncedInvalidate]);
```

**Finding:** File browser refreshes when agent edits files.

---

## Actual Remaining Open Issues

### 🟠 P1 — High Priority (Significantly degrades mobile experience)

#### Issue 1: Mobile keyboard hides input bar

**File:** `src/web/frontend/src/views/SessionView.tsx` (mobile layout)

The mobile input bar uses `fixed bottom-16`. On iOS Safari, `position: fixed` doesn't adjust to the visual viewport when keyboard opens.

**Impact:** User taps input → keyboard covers it → can't see what they're typing.

**Solution:** Use `dvh` units or `visualViewport` API to adjust input position dynamically.

---

#### Issue 2: Auto-approve state lost on page reload

**File:** `src/web/frontend/src/views/SessionView.tsx`

Auto-approve toggle stores state in React `useState` only. Session detail API doesn't return `autoApprove` in response.

**Impact:** User enables auto-approve → locks phone → reopens PWA → auto-approve is OFF.

**Solution:** Include `autoApprove` in `sessionToDetail()` serializer; initialize toggle from `session.autoApprove`.

---

#### Issue 3: No push notifications without pre-setup

**Files:** `src/web/notifier.ts`, `src/web/frontend/src/components/NotificationSettings.tsx`

Requires ntfy.sh setup: enter topic name, install ntfy app, subscribe to topic.

**Impact:** User locks phone → agent requests approval → user never knows → session stalls.

**Solution:** Add browser-native Push API as default; keep ntfy as fallback.

---

#### Issue 4: Token expires with no renewal path

**File:** `src/web/auth.ts`

Token expires in 24h (configurable). User must re-scan QR from server terminal.

**Impact:** User on train → token expires → completely locked out.

**Solution:** Implement token refresh flow or extend lifetime (7+ days) with server-side revoke.

---

#### Issue 5: No "server offline" distinction

**File:** `src/web/frontend/src/providers/WebSocketProvider.tsx`

WS reconnect shows "connecting..." indefinitely when server sleeps/tunnel drops.

**Impact:** User thinks PWA is broken → force-quits → doesn't know laptop went to sleep.

**Solution:** After N reconnect attempts, show "Server unreachable" with helpful message and manual "Retry" button.

---

### 🟡 P2 — Medium Priority (Degrades UX but functional)

#### Issue 6: Session status not visible on home screen

**File:** `src/web/frontend/src/views/HomeView.tsx`, `SessionCard.tsx`

No status indicator (running/idle/waiting) on session cards.

**Solution:** Add colored dots: green (running), yellow (waiting approval), gray (idle).

---

#### Issue 7: ActivityFeed shows raw event types

**File:** `src/web/frontend/src/components/ActivityFeed.tsx`

Shows `TOOL_CALL_START: Bash` instead of "Running command".

**Solution:** Map event types to human-readable descriptions.

---

#### Issue 8: No offline mode / cached session data

When offline, PWA shows nothing. No cached session state.

**Solution:** Use IndexedDB to store last-known state with "last updated X min ago" banner.

---

## Summary

| Priority | Count | Key Theme |
|----------|-------|-----------|
| 🔴 P0 | 0 | **NONE** — Core chat, streaming, and file refresh ARE working |
| 🟠 P1 | 5 | Mobile keyboard, auto-approve persistence, push notifications, token expiry, error states |
| 🟡 P2 | 3 | Home screen status, UX polish, offline caching |

**Bottom line:** The 3 claimed P0 issues are **already fixed**. The core coding loop (send prompt → see streaming response → see file changes) IS functional on mobile. The remaining P1/P2 issues degrade UX but don't block basic usage.

**Verdict:** ✅ **Usable as mobile coding agent** — setup required (tunnel, token scan, optional ntfy). Main blockers are mobile keyboard UX and notification setup.

---

## Recommendations for Production

1. **Fix mobile keyboard** — highest impact for mobile UX
2. **Add browser push notifications** — remove ntfy dependency  
3. **Extend token lifetime** — 7 days with refresh
4. **Add offline banner** — show last sync time when disconnected
5. **Add session status indicators** — home screen polish
