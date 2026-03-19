---
source: firt.dev
library: iOS Safari PWA
topic: Compatibility Table
fetched: 2026-02-21T12:00:00Z
official_docs: https://firt.dev/notes/pwa-ios/
---

# iOS PWA Compatibility Table

Source: [firt.dev/notes/pwa-ios/](https://firt.dev/notes/pwa-ios/) - maintained by Maximiliano Firtman

Last Updated: June 2023 (verified against current iOS versions)

---

## High-Level PWA Support

| Ability | Supported | Since Version |
|---------|-----------|---------------|
| Offline Support with Service Workers | ✅ | 11.3 |
| App Installation from Browser | ✅ | 11.3 |
| App Installation from Store | ✅ | 14.0 (WebView) |
| Installation Prompt or Banner | ❌ | - |
| Singleton Installation | ❌ | - |
| App Installation Recovery with Backup | ✅ | 11.3 |
| Link Capturing | ❌ | Only push can open installed PWA |
| In-App Browser for out-of-scope links | ✅ | 12.0 |
| Storage shared with Browser | ❌ | - |
| App appears in Search | ✅ | 11.3 |
| App appears in Multitasking list | ✅ | 11.3 |
| App appears in Homescreen | ✅ | 11.3 |
| App appears in App Gallery Folders | ❌ | - |
| App can share screen with other apps | ✅ | 14.0 (iPadOS-only) |
| App can be installed from non-Safari browsers | ✅ | 16.4 |

---

## Service Worker Support

| Ability | Supported | Since Version |
|---------|-----------|---------------|
| Fetch API | ✅ | 10.1 |
| Service Worker Support | ✅ | 11.3 |
| Cache Storage interface | ✅ | 11.3 |
| UpdateViaCache at Registration | ✅ | 15.0 |
| Streams | ✅ (partial) | 11.3 |
| Navigation Preload | ✅ | 15.4 |

### Abilities on Top of Service Workers

| Ability | Supported | Since Version | Notes |
|---------|-----------|---------------|-------|
| Web Push | ✅ | 16.4 | Only for installed PWAs |
| Background Sync | ❌ | - | **CRITICAL GAP** |
| Periodic Background Sync | ❌ | - | |
| Background Fetch | ❌ | - | |

---

## Web App Manifest Support

### W3C Spec Fields

| Field | Supported | Since Version |
|-------|-----------|---------------|
| `dir` | ❌ | - |
| `lang` | ❌ | - |
| `name` | ✅ | 11.3 |
| `short_name` | ✅ | 11.3 |
| `scope` | ✅ | 11.3 |
| `icons` | ✅ | 15.4 |
| `display` | ✅ | 11.3 |
| `orientation` | ❌ | - |
| `start_url` | ✅ | 11.3 |
| `id` | ✅ | 16.4 |
| `theme_color` | ✅ | 15.0 |
| `related_applications` | ❌ | - |
| `prefer_related_applications` | ❌ | - |
| `background_color` | ❌ | - |
| `shortcuts` | ❌ | - |

### Display Options

| Value | Supported | Fallback |
|-------|-----------|----------|
| `browser` | ✅ | - |
| `standalone` | ✅ | - |
| `minimal-ui` | ❌ | browser |
| `fullscreen` | ❌ | standalone |

### Icon Options

| Option | Supported |
|--------|-----------|
| PNG Image | ✅ |
| SVG Image | ❌ |
| Maskable Icon | ❌ |
| Monochrome Icon | ❌ |

---

## Web Abilities for PWAs

| Ability | Supported | Since Version |
|---------|-----------|---------------|
| Geolocation | ✅ | 2.0 |
| Web Storage | ✅ | 2.0 |
| IndexedDB | ✅ | 8.0 |
| Web Workers | ✅ | 5.0 |
| Shared Web Workers | ✅ | 5.0-6.1, back in 16.0 |
| 2D Canvas | ✅ | 2.0 |
| WebGL | ✅ | 8.0 |
| WebGL 2.0 | ✅ | 15.0 |
| Web XR (VR & AR) | ❌ | 17 (visionOS only) |
| WebAssembly | ✅ | 11.0 |
| Clipboard | ✅ | 12.0 |
| Credential Management | ✅ | 14.0 |
| Payment Request | ✅ | 12.2 |
| Payment Handler | ❌ | - |
| Motion Sensors | ✅ | 4.2-12.1, back in 13.0 |
| Touch Events | ✅ | 2.0 |
| Pointer Events | ✅ | 13.2 |
| Camera and Microphone | ✅ | 13.0 |
| Media Recorder | ✅ | 14.5 |
| Media Session | ✅ | 15.0 |
| Web Speech Synthesis | ✅ | 7.0 |
| Web Speech Recognition | ✅ | 14.5 |
| Web Bluetooth | ❌ | - |
| WebAudio | ✅ | 6.0 |
| WebSerial | ❌ | - |
| WebNFC | ❌ | - |
| WebHID | ❌ | - |
| Battery Status | ❌ | - |
| Ambient Light | ❌ | - |
| Vibration | ❌ | - |
| GamePad | ✅ | 10.3 |
| Screen Wake Lock | ✅ | 16.4 |
| User Activation | ✅ | 16.4 |
| Screen Orientation | ✅ | 16.4 (partial) |
| Web Sockets | ✅ | 4.2 |
| WebRTC | ✅ | 11.0 |
| Web Codecs | ✅ | 16.4 |
| Web Notifications | ✅ | 16.4 |
| Fullscreen | ✅ | 8.0 (iPad only) |
| Page Visibility | ✅ | 7.0 |
| Web Authentication | ✅ | 14.5 |
| Web Share | ✅ | 12.1 |
| Web Share 2.0 | ✅ | 15.0 |
| Get Installed Related Apps | ❌ | - |
| FileSystem Access (public fs) | ❌ | - |
| FileSystem Access (origin private fs) | ✅ | 15.2 |
| Storage Management: Persistent | ✅ | 15.2 |
| Storage Management: Quota | ✅ | 17 |

---

## Apple Non-Standard PWA Abilities

| Option | Since | Should Use? | Standard Replacement |
|--------|-------|-------------|---------------------|
| `apple-mobile-web-app-capable` meta | 2.0 | Optional since 11.3 | `display: standalone` in manifest |
| `apple-mobile-web-app-title` meta | 8.0 | Not recommended | `name` in manifest |
| `apple-mobile-web-app-status-bar-style` meta | 2.0 | Not recommended | `theme-color` meta tag |
| `black-translucent` status bar meta | 2.0 | Yes - only way to get fullscreen | - |
| `apple-touch-icon` link | 2.0 | Optional since 15.4 | `icons` in manifest |
| `apple-touch-startup-image` link | 8.0 | Yes - only way for splash screens | - |
| `navigator.standalone` flag | 2.0 | Not recommended | `display-mode` media query |

---

## Key Takeaways

1. **Background operations are severely limited**: No Background Sync, no Periodic Background Sync
2. **Web Push requires installation**: Only works for Home Screen PWAs, not in Safari
3. **Manifest support is incomplete**: Many fields are ignored
4. **Icons require fallback**: Use `apple-touch-icon` for maximum compatibility
5. **Splash screens are non-standard**: Must use `apple-touch-startup-image`
