---
source: Multiple web sources (WebKit.org, firt.dev, MDN, WebKit Bugzilla)
library: iOS Safari PWA
topic: iOS PWA Limitations 2024-2025
fetched: 2026-02-21T12:00:00Z
official_docs: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
---

# iOS Safari PWA Limitations (2024-2025)

## Executive Summary

iOS Safari PWAs have significant limitations compared to Android Chrome PWAs. This document covers the key limitations affecting WebSocket behavior, Page Visibility API, Service Workers, Web Push, IndexedDB persistence, and Socket.IO.

---

## 1. WebSocket Behavior When Phone is Locked/Backgrounded

### Key Facts

- **WebSockets are supported** on iOS since version 4.2
- **Background behavior is problematic**: When an iOS device is locked or the PWA is backgrounded:
  - WebSocket connections are typically **suspended/terminated** by iOS to conserve battery
  - iOS aggressively throttles or kills background processes
  - No reliable way to keep WebSocket alive when screen is locked

### iOS-Specific WebSocket Issues

1. **Connection Termination**: iOS will terminate WebSocket connections shortly after the app enters background (typically within seconds to minutes)
2. **No Background Keep-Alive**: Unlike native apps, PWAs cannot use background modes to maintain connections
3. **Timer Throttling**: `setTimeout` and `setInterval` are heavily throttled in background tabs (minimum ~1 second, heavily budgeted)

### MDN Documentation Notes

From MDN on background throttling:
> Tabs running code using real-time network connections (WebSockets and WebRTC) go unthrottled to avoid connection timeouts.

**However**, this applies to desktop browsers and Android - iOS Safari does NOT honor this for PWAs.

### Recommendations for iOS

- Implement **automatic reconnection** with exponential backoff
- Use **heartbeat/ping-pong** mechanism to detect disconnections quickly
- Consider **polling as fallback** for critical real-time features
- Store messages client-side and sync on reconnection
- Use **Push API** for critical notifications when app is backgrounded

---

## 2. Page Visibility API Reliability on iOS

### Support Status

| Feature | Supported Since |
|---------|----------------|
| `document.hidden` | iOS 7.0 |
| `document.visibilityState` | iOS 7.0 |
| `visibilitychange` event | iOS 7.0 |

### Known iOS Issues

1. **Reliability in PWAs**: The Page Visibility API works, but:
   - When phone is locked, `visibilityState` changes to `hidden`
   - When switching apps, behavior is consistent
   - **However**: The timing of events may not be precise on iOS

2. **Event Firing**: iOS may batch or delay `visibilitychange` events to conserve battery

3. **Screen Lock Detection**:
   - `document.hidden` returns `true` when screen is locked
   - `document.visibilityState` returns `"hidden"`
   - But you **cannot distinguish** between "screen locked" vs "app backgrounded" vs "tab switched"

### Best Practices

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // iOS PWA is now hidden/backgrounded
    // Pause non-critical operations
    // Close or prepare WebSocket for reconnection
  } else {
    // iOS PWA is visible again
    // Resume operations
    // Reconnect WebSocket if needed
  }
});
```

---

## 3. Service Worker and PWA Limitations on iOS (2024-2025)

### High-Level PWA Support (from firt.dev compatibility table)

| Feature | Supported | Notes |
|---------|-----------|-------|
| Service Workers | ✅ iOS 11.3+ | Full support |
| Offline Support | ✅ iOS 11.3+ | Via Service Workers |
| Web App Manifest | ✅ iOS 11.3+ | Partial field support |
| Installation Prompt/Banner | ❌ | Not available - manual only |
| Background Sync | ❌ | **NOT SUPPORTED** |
| Periodic Background Sync | ❌ | **NOT SUPPORTED** |
| Background Fetch | ❌ | **NOT SUPPORTED** |
| Storage shared with Browser | ❌ | Isolated per PWA |

### Manifest Field Support

| Field | Supported |
|-------|-----------|
| `name`, `short_name` | ✅ |
| `display: standalone` | ✅ |
| `display: fullscreen` | ❌ (falls back to standalone) |
| `icons` | ✅ iOS 15.4+ |
| `shortcuts` | ❌ |
| `share_target` | ❌ |
| `orientation` | ❌ |

### Critical Limitations

1. **No Background Processing**: Service workers cannot run in background for extended periods
2. **No Background Sync API**: Cannot sync data when app is closed
3. **Storage Isolation**: PWA storage is separate from Safari browser storage
4. **No Installation Prompt**: Users must manually add to home screen via Share menu
5. **Singleton Installation**: Can install multiple copies, but no native install prompt

---

## 4. Web Push API Support and Reliability on iOS

### Support Status

- **Added**: iOS/iPadOS 16.4 (March 2023)
- **Requirement**: Web app MUST be installed to Home Screen
- **NOT available**: In Safari browser or third-party browsers

### How It Works

1. Uses Apple Push Notification service (APNs)
2. Requires user gesture to request permission
3. Integrates with iOS Focus modes
4. Shows on Lock Screen, Notification Center, Apple Watch

### Known Bugs and Limitations (as of 2024-2025)

#### Bug: Notification Tags Not Working (WebKit Bug #258922)

**Status**: Still OPEN as of April 2025

From WebKit Bugzilla:
> "We don't support tag yet... the tag attribute on Notification is exposed. You can set it via the Notification constructor/ServiceWorkerRegistration.showNotification and access its value later on. But the browser currently doesn't use the property to coalesce notifications."

**Impact**: Notifications with the same `tag` do NOT replace each other on iOS. Each notification appears separately.

#### Other Known Issues

1. **`Notification.close()` doesn't work reliably**: Cannot programmatically close notifications
2. **`getNotifications()` race conditions**: Fast successive push events may return stale data
3. **Tag-based replacement**: Does NOT work as of iOS 18.4

### Web Push Best Practices for iOS

```javascript
// Request permission on user gesture
button.addEventListener('click', async () => {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    // Subscribe to push
  }
});

// Service Worker push handler
self.addEventListener('push', (event) => {
  // iOS requires showing a notification in response to push
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon.png',
      // tag: 'updates' // NOTE: tag doesn't work on iOS!
    })
  );
});
```

---

## 5. IndexedDB Persistence in iOS PWAs

### Support Status

| Feature | Supported Since |
|---------|-----------------|
| IndexedDB | ✅ iOS 8.0+ |
| Origin Private File System | ✅ iOS 15.2+ |
| Storage Manager: Persistent | ✅ iOS 15.2+ |
| Storage Manager: Quota | ✅ iOS 17+ |

### Storage Limits and Persistence

**Important**: iOS PWA storage is **isolated** from Safari browser storage.

1. **Storage Quota**: Varies by device, but generally limited
2. **Eviction Risk**: iOS may clear PWA storage:
   - Under storage pressure
   - If PWA isn't used for extended period
   - No explicit "persistent storage" guarantee like Android

3. **Data Loss Scenarios**:
   - iOS system storage cleanup
   - Long periods of inactivity
   - iOS updates (rare but possible)

### Best Practices

```javascript
// Request persistent storage (helps but not guaranteed)
if (navigator.storage && navigator.storage.persist) {
  const isPersisted = await navigator.storage.persist();
  console.log(`Persisted storage granted: ${isPersisted}`);
}

// Always implement backup/sync strategies
// Don't rely solely on IndexedDB for critical data
```

---

## 6. Socket.IO on iOS PWAs - Known Issues

### Core Issues

Socket.IO builds on WebSockets and inherits all iOS WebSocket limitations:

1. **Disconnection on Background**: Socket.IO connections will drop when:
   - Phone is locked
   - App is backgrounded
   - User switches to another app

2. **Reconnection Behavior**:
   - Socket.IO has built-in reconnection logic
   - Works well when app returns to foreground
   - But no way to receive events while backgrounded

### Specific Socket.IO Recommendations for iOS

```javascript
const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket', 'polling'], // Polling fallback helps
});

// Handle visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !socket.connected) {
    socket.connect(); // Force reconnect when visible
  }
});

// Store missed messages client-side
socket.on('connect', () => {
  // Request missed messages since last disconnection
  socket.emit('sync', { lastSeen: lastMessageTimestamp });
});
```

### Socket.IO Transport Fallback

- Use `transports: ['websocket', 'polling']` for better iOS compatibility
- HTTP long-polling can work in some scenarios where WebSockets fail
- However, polling also gets throttled in background

---

## Summary: iOS PWA Architecture Recommendations

### Do NOT Assume on iOS

| Assumption | Reality |
|------------|---------|
| WebSocket stays alive in background | ❌ Terminated quickly |
| Background Sync works | ❌ Not supported |
| Push notifications tag/replace works | ❌ Buggy (Bug #258922) |
| IndexedDB is permanently persistent | ⚠️ May be cleared |
| Page Visibility is instant | ⚠️ May be delayed |

### Recommended Architecture

1. **Real-time Communication**:
   - Design for disconnection
   - Implement optimistic UI updates
   - Sync on reconnection
   - Use Push API for critical alerts

2. **Data Persistence**:
   - Use IndexedDB with server sync
   - Implement conflict resolution
   - Don't store irreplaceable data locally only

3. **Background Operations**:
   - Use Web Push for notifications
   - Server-side queue for missed events
   - Client pulls on app resume

4. **Service Worker**:
   - Cache for offline support
   - Push event handling only
   - No background sync reliance

---

## Sources

- [WebKit Blog: Web Push for iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [firt.dev: iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/)
- [WebKit Bugzilla #258922](https://bugs.webkit.org/show_bug.cgi?id=258922)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN: WebSocket Client Applications](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications)
