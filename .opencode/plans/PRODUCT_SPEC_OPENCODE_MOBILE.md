# Product Specification: OpenCode Mobile (Enterprise Edition)

**Version:** 1.0  
**Date:** February 15, 2026  
**Status:** Draft  

---

## 1. Executive Summary

OpenCode Mobile is a self-hosted "Remote Development Environment" that packages:
- **VS Code Server** (via code-server)
- **Auto-Tunnel** (Cloudflare Quick Tunnel)
- **Agent Control Sidebar** (VS Code Extension)
- **PWA Dashboard** (Mobile-optimized web interface)

### Value Proposition
> "The power of your desktop IDE, the convenience of your phone, the intelligence of AI agents—securely tunneled to you anywhere."

### Dual Interface Strategy

| Interface | Primary Use Case | Push Mechanism |
|-----------|------------------|----------------|
| **WhatsApp** | Notifications, quick approvals | WhatsApp push |
| **Web PWA** | Rich interaction, terminal, file browser | WebSocket events |

**Core Value:** "WhatsApp notifies you when attention is needed. The PWA gives you the tools to act on it."

---

## 2. Architecture Overview

### High-Level Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                           User's Machine                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐    ┌──────────────────────────────────┐  │
│  │   OpenSofa Core (EXISTING)   │    │   OpenSofa Web (EXISTING)        │  │
│  │                              │    │                                  │  │
│  │  • SessionManager            │◄───┤  • HTTP Server (Hono, port 3285) │  │
│  │  • AgentAPIClient            │    │  • WebSocket Server              │  │
│  │  • FeedbackController        │    │  • TunnelManager (Cloudflare)    │  │
│  │  • ScreenshotService         │    │  • Broadcaster (WS events)       │  │
│  │  • AgentRegistry             │    │  • TerminalStream (tmux → WS)    │  │
│  │  • StatePersistence          │    │  • AuthMiddleware (token-based)  │  │
│  │  • ResourceMonitor           │    │                                  │  │
│  │  • WhatsAppHandler           │    └──────────────┬───────────────────┘  │
│  └──────────────┬───────────────┘                   │                      │
│                 │                                    ▼                      │
│                 │                    ┌──────────────────────────┐          │
│                 │                    │  PWA Frontend (NEW)      │          │
│                 │                    │  • React + Vite          │          │
│                 │                    │  • xterm.js terminal     │          │
│                 │                    │  • Monaco file viewer    │          │
│                 │                    │  • Zustand state         │          │
│                 │                    └──────────────────────────┘          │
└─────────────────┼───────────────────────────────────────────────────────────┘
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│    WhatsApp     │   │  Tunnel URL     │
│  (Baileys)      │   │  (Cloudflare)   │
│                 │   │                 │
│ • Push alerts   │   │ • Remote access │
│ • Quick approve │   │ • QR auth       │
└─────────────────┘   └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │   Mobile PWA    │
                      │   (Browser)     │
                      └─────────────────┘
\`\`\`

---

## 3. Current Implementation Status

### What's Already Built

| Component | Status | File(s) |
|-----------|--------|---------|
| **SessionManager** | ✅ Complete | \`src/session-manager.ts\` |
| **AgentAPIClient** | ✅ Complete | \`src/agentapi-client.ts\` |
| **FeedbackController** | ✅ Complete | \`src/feedback-controller.ts\` |
| **DeliveryManager** | ✅ Complete | \`src/delivery-manager.ts\` |
| **WhatsAppHandler** | ✅ Complete | \`src/whatsapp-handler.ts\` |
| **HTTP Server (Hono)** | ✅ Complete | \`src/web/routes/\` |
| **WebSocket Broadcaster** | ✅ Complete | \`src/web/broadcaster.ts\` |
| **Tunnel Manager** | ✅ Complete | \`src/web/tunnel.ts\` |
| **Terminal Stream** | ✅ Complete | \`src/web/terminal-stream.ts\` |
| **Auth Middleware** | ✅ Complete | \`src/web/auth.ts\` |
| **API Types** | ✅ Complete | \`src/web/types.ts\` |

### What Needs to Be Built

| Component | Priority | Description |
|-----------|----------|-------------|
| **PWA Frontend** | P0 | React + Vite + Tailwind mobile dashboard |
| **Session History Endpoint** | P1 | \`GET /api/sessions/:name/history\` |
| **Terminal Resize WS Event** | P1 | Handle xterm.js resize on mobile rotation |
| **File Write Endpoint** | P2 | \`POST /api/sessions/:name/files/*path\` |
| **Deep Linking** | P2 | WhatsApp → PWA direct navigation |

---

## 4. HTTP API Specification

### Base Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Port** | 3285 | Dedicated gateway, separate from AgentAPI (3284+) |
| **Framework** | Hono | Lightweight, TypeScript-native, already in use |
| **Auth** | Token-based | 32-char token in \`~/.opensofa/web-token\` |

### REST Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | \`/api/sessions\` | List all sessions | ✅ |
| GET | \`/api/sessions/:name\` | Get session details | ✅ |
| POST | \`/api/sessions/:name/message\` | Send message to agent | ✅ |
| POST | \`/api/sessions/:name/approve\` | Approve pending action | ✅ |
| POST | \`/api/sessions/:name/reject\` | Reject pending action | ✅ |
| DELETE | \`/api/sessions/:name\` | Stop session | ✅ |
| GET | \`/api/sessions/:name/files\` | List files | ✅ |
| GET | \`/api/sessions/:name/files/*path\` | Get file contents | ✅ |
| GET | \`/api/agents\` | List available agents | ✅ |
| GET | \`/api/status\` | System status + tunnel URL | ✅ |
| WS | \`/ws\` | WebSocket for real-time events | ✅ |

### WebSocket Protocol

\`\`\`typescript
interface WebSocketEvent {
  type: 
    | 'session_created'
    | 'session_stopped'
    | 'session_updated'
    | 'agent_status'
    | 'agent_output'
    | 'approval_needed'
    | 'terminal_output'
    | 'system_status';
  sessionName?: string;
  payload: unknown;
  timestamp: number;
}
\`\`\`

---

## 5. Tunnel Strategy

### Default: Cloudflare Quick Tunnel

\`\`\`bash
cloudflared tunnel --url http://localhost:3285
# Outputs: https://random-name.trycloudflare.com
\`\`\`

**Characteristics:**
- ✅ Zero configuration required
- ✅ No account needed
- ✅ Automatic HTTPS
- ❌ URL changes on restart

### MVP Workflow (Random URL + QR Code)

1. **App starts** → Generates tunnel URL
2. **App generates QR Code** with embedded token
3. **User scans QR** with phone camera
4. **Browser opens** URL with token parameter
5. **Token saved** in browser localStorage
6. **Session established** via WebSocket

---

## 6. Authentication

### MVP: Single-Token Auth

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                      Token Lifecycle                        │
├─────────────────────────────────────────────────────────────┤
│  1. On first start, generate 32-char crypto token          │
│  2. Store in ~/.opensofa/web-token                          │
│  3. Embed in QR code URL: ?token=abc123...                  │
│  4. Browser stores in localStorage                          │
│  5. Include in all requests via Authorization header        │
│  6. Token expires after 24 hours (configurable)             │
└─────────────────────────────────────────────────────────────┘
\`\`\`

---

## 7. Web UI (PWA) Specification

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | React 18 | Largest ecosystem, xterm/monaco wrappers mature |
| **Build Tool** | Vite | Fast HMR, excellent PWA plugin |
| **Styling** | Tailwind CSS | Mobile-first, rapid prototyping |
| **State** | Zustand | Minimal boilerplate, good WebSocket integration |
| **Terminal** | xterm.js | Industry standard, good mobile support |
| **File Viewer** | Monaco Editor | Syntax highlighting, familiar VS Code feel |
| **PWA** | vite-plugin-pwa | Service worker, manifest, offline caching |

### Screen Structure

#### Sessions List (Home)
- Header with menu, settings, disconnect
- Tab bar: Sessions, Files, Log
- Session cards with status, agent, branch
- New Session button

#### Session Detail View
- Back navigation with session info
- Tab: Chat, Terminal, Files
- Agent output with approval modals
- Message input with send button

### PWA Configuration

\`\`\`json
{
  "name": "OpenSofa",
  "short_name": "OpenSofa",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1a1a2e",
  "background_color": "#1a1a2e"
}
\`\`\`

### Offline Strategy

| Resource | Strategy | Behavior |
|----------|----------|----------|
| App Shell | Cache First | Instant load |
| API Calls | Network Only | Always fresh |
| WebSocket | Auto-Reconnect | "Reconnecting..." UI |

---

## 8. Deep Linking (WhatsApp → PWA)

### The "Killer Feature"

\`\`\`
WhatsApp: "⚠️ Agent 'Frontend' needs approval for rm -rf /dist"

Message includes link:
https://tunnel.trycloudflare.com/sessions/frontend?action=approve&token=xyz...

User taps link → PWA opens → Auth via token → Focus on approval modal
\`\`\`

### URL Scheme

\`\`\`
https://<tunnel>/
  ├── /sessions                    → Session list
  ├── /sessions/:name              → Session detail (Chat tab)
  ├── /sessions/:name/terminal     → Terminal tab
  ├── /sessions/:name/files        → Files tab
  └── /sessions/:name?action=X     → Deep link with action
\`\`\`

---

## 9. Feature Requirements

### P0 (MVP)

| Feature | Description | Status |
|---------|-------------|--------|
| Zero-Config Tunnel | Connect without port forwarding | ✅ Backend done |
| Mobile PWA | "Add to Home Screen" | 🔲 Frontend |
| WebSocket Events | Real-time updates | ✅ Backend done |
| Secure Auth | One-time token via QR | ✅ Backend done |
| Session List | View all active sessions | 🔲 Frontend |
| Session Control | Start/stop/message/approve | 🔲 Frontend |
| Terminal View | xterm.js with mobile helper | 🔲 Frontend |
| File Browser | Read-only file viewing | 🔲 Frontend |

### P1 (Post-MVP)

- Terminal Touch: Mobile keyboard helper bar
- History Replay: Reconnection buffer endpoint
- Terminal Resize: Handle mobile rotation

### P2 (Future)

- File Upload: Gallery images to workspace
- File Editing: Write files via Monaco
- Persistent Tunnel: Named tunnel for stable URL

---

## 10. Monetization Strategy

| Feature | Free | Pro ($10/mo) | Enterprise ($25/user/mo) |
|---------|------|--------------|--------------------------|
| Local access | ✅ | ✅ | ✅ |
| WhatsApp control | ✅ | ✅ | ✅ |
| PWA Dashboard | ✅ | ✅ | ✅ |
| Remote Tunnel | ❌ | ✅ | ✅ |
| Persistent URL | ❌ | ❌ | ✅ |
| Central Dashboard | ❌ | ❌ | ✅ |
| Audit Logs | ❌ | ❌ | ✅ |
| SSO | ❌ | ❌ | ✅ |

---

## 11. Implementation Roadmap

### Phase 1: PWA MVP (Week 1-2)

- [ ] Initialize React + Vite project in \`src/web/frontend/\`
- [ ] Configure vite-plugin-pwa
- [ ] Build session list and detail views
- [ ] Implement WebSocket connection
- [ ] Add xterm.js terminal component
- [ ] Add Monaco file viewer
- [ ] Test QR code auth flow

### Phase 2: UX Polish (Week 3-4)

- [ ] Add mobile terminal helper bar
- [ ] Implement terminal resize
- [ ] Add history replay endpoint
- [ ] Implement deep linking

### Phase 3: Enterprise (Month 2)

- [ ] Build manager dashboard
- [ ] Implement audit logging
- [ ] Add SSO integration
- [ ] Build self-hosted tunnel

---

## 12. Technical Decisions Log

| Decision | Choice | Rationale | Date |
|----------|--------|-----------|------|
| Port | 3285 | Dedicated gateway | Feb 2026 |
| Frontend Framework | React + Vite | Ecosystem, xterm/monaco | Feb 2026 |
| Tunnel (MVP) | Cloudflare Quick Tunnel | Zero config | Feb 2026 |
| Offline Strategy | Cache app shell only | Live data required | Feb 2026 |
| State Management | Zustand | Minimal boilerplate | Feb 2026 |
| Terminal | xterm.js | Industry standard | Feb 2026 |

---

## 13. Success Metrics

### MVP Launch

| Metric | Target |
|--------|--------|
| First meaningful paint | < 2s |
| Time to interactive | < 3s |
| WebSocket reconnect | < 5s |
| QR scan to dashboard | < 10s |

---

*Document prepared for OpenCode Mobile Enterprise Edition*  
*Based on OpenSofa codebase analysis and product specifications*
