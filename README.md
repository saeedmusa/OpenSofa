# OpenSofa

**Remote Coding Agent Controller — PWA (Work in Progress)**

Control your coding agents from anywhere. A progressive web app that connects to Claude Code, Aider, Goose, Gemini, Codex, OpenCode, and more — all from your phone.

> ⚠️ **WIP Status**: OpenSofa is functional but actively evolving. Core features work (sessions, approvals, notifications, file browsing). Some advanced features from the product spec are partially implemented or pending.

## What It Does

OpenSofa is a **Node.js + Hono-based PWA** that runs on your laptop alongside your coding agents. It creates a secure tunnel allowing you to monitor agent output, approve commands, and manage sessions from a mobile-optimized web interface.

### Current Capabilities

- ✅ **Create and manage coding sessions** — spawn agents (Claude, Aider, OpenCode, Codex, etc.) in isolated git worktrees
- ✅ **Real-time agent output streaming** — SSE events stream directly to the PWA via WebSocket
- ✅ **Approve/reject agent actions** — get notified when agents need permission, approve from anywhere
- ✅ **Push notifications via ntfy.sh** — HTTP-based push (no iOS native push yet due to PWA limitations)
- ✅ **File browser with syntax highlighting** — browse repo structure and view file contents
- ✅ **Secure tunnel via cloudflared** — zero-config HTTPS access from anywhere
- ✅ **256-bit token authentication** — Bearer token with timing-safe comparison
- ✅ **TOTP step-up auth** — required for destructive operations (stop sessions, destructive commands)
- ✅ **IP rate limiting & banning** — auto-ban after 5 failed auth attempts (persisted to SQLite)
- ✅ **SQLite persistence** — WAL mode for sessions, bans, events, and rate limits
- ✅ **Auto-cleanup** — idle session detection and resource monitoring
- ✅ **Agent state machine** — tracks running/stable/awaiting_approval states
- ✅ **Message queue** — queues messages when agent is busy, flushes when stable

### Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   PWA (Phone    │────►│  OpenSofa Backend    │────►│   AgentAPI      │
│   or Browser)   │◄────│  (Node.js + Hono)   │◄────│   (localhost)   │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
         │                        │                          │
    WebSocket +            REST API +                  tmux session
    ntfy.sh push          SSE Events                  with agent
```

**Key Design Principles:**
- 📱 **Mobile-first** — optimized for small screens, touch targets ≥ 44px
- 🏗️ **Structured events** — SSE events carry typed data, not parsed text
- 🔔 **Push notifications** — via ntfy.sh (iOS/Android app required)
- 💾 **SQLite** — WAL mode for concurrent read/write without corruption
- 🔒 **Security-first** — 256-bit tokens, TOTP for destructive ops, IP banning

## Prerequisites

- **Node.js 18+**
- **Git** — for worktree isolation
- **tmux** — for terminal session management
- **cloudflared** — for secure tunnel access
- **AgentAPI** — HTTP wrapper for coding agents (`go install github.com/coder/agentapi/cmd/agentapi@latest`)
- **At least one coding agent** — Claude Code, Aider, OpenCode, etc.

## Quick Start

```bash
# Clone
git clone https://github.com/saeedmusa/opensofa.git
cd opensofa

# Install & build
npm install
npm run build

# Start the server
npm run dev
```

Open the displayed tunnel URL on your phone or browser.

**For push notifications:**
1. Install the ntfy.sh app (iOS/Android)
2. Subscribe to a unique topic
3. Configure OpenSofa: set `ntfyTopic` in `~/.opensofa/config.yaml`

## Configuration

Config stored in `~/.opensofa/config.yaml` (created on first run):

```yaml
# Default coding agent
defaultAgent: claude

# Maximum concurrent sessions
maxSessions: 5

# Web server port
webPort: 3285

# ntfy.sh topic for push notifications
ntfyTopic: your-unique-topic-name

# Auto-approve agent actions (not recommended)
autoApprove: false

# Enable cloudflared tunnel
tunnelEnabled: true
```

## Work in Progress / Known Limitations

These features are planned or partially implemented:

| Feature | Status | Notes |
|---------|--------|-------|
| Native Web Push (VAPID) | 🚧 WIP | Currently uses ntfy.sh; iOS native push requires PWA installed to Home Screen |
| Voice Input | 🚧 WIP | Browser Speech Recognition API partially implemented |
| MCP Management UI | 🚧 WIP | Backend support exists, UI in progress |
| Preview Apps (localhost forwarding) | 🚧 WIP | Port detection implemented, tunnel auto-creation pending |
| Merge Conflict UI | 🚧 WIP | Parser exists, dedicated UI in progress |
| Model Discovery | ✅ Working | Dynamic model fetching for supported agents |
| Screenshot Streaming | 🚧 WIP | Backend capture exists, inline UI pending |
| Background Sync | ✅ Working | Message queue handles offline scenarios |
| Auto-Snapshots | ✅ Working | Git worktrees provide implicit isolation |

### Platform Limitations

- **iOS PWA**: Apple kills WebSockets ~30 seconds after screen lock. ntfy.sh notifications bridge this gap.
- **Voice Input**: iOS requires active internet connection and stops processing if screen locks.
- **File System**: Browser security restricts direct file access; all file operations proxy through backend.

## Supported Agents

| Agent | Type | Status |
|-------|------|--------|
| Claude Code | `claude` | ✅ Fully supported |
| Aider | `aider` | ✅ Fully supported |
| OpenCode | `opencode` | ✅ Fully supported |
| Codex | `codex` | ✅ Supported |
| Gemini | `gemini` | ✅ Supported |
| Goose | `goose` | ✅ Supported |
| Amp | `amp` | ✅ Supported |
| Cursor | `cursor` | ✅ Supported |
| Auggie | `auggie` | ✅ Supported |
| Amazon Q | `amazonq` | ✅ Supported |
| Copilot | `copilot` | 🚧 Pending full integration |

## Safety Features

- **Git worktrees** — each session isolated in its own directory/branch
- **TOTP for destructive ops** — stop sessions, destructive commands require 2FA
- **Approval detection** — agent permission requests surface as notifications
- **Auto-rollback** — revert uncommitted changes via API
- **Emergency stop** — kill agent immediately from PWA
- **Resource monitoring** — auto-cleanup idle sessions when resources critical
- **IP banning** — 24-hour ban after 5 failed auth attempts

## Development

```bash
# Run in development mode (hot reload)
npm run dev

# Build backend
npm run build

# Build frontend
cd src/web/frontend && npm run build

# Run tests
npm test
```

## Troubleshooting

- **AgentAPI not responding** — Try restarting the session from the PWA
- **Push notifications not working** — Ensure ntfy.sh topic is configured and app is installed
- **Directory is not a git repo** — Run `git init` in that directory, then retry
- **Session stuck** — Stop and recreate the session from the home screen
- **TOTP required but not set up** — Scan the QR code in Settings → Security with your authenticator app

## License

MIT

## Acknowledgments

- [AgentAPI](https://github.com/coder/agentapi) — HTTP wrapper for coding agents
- [ntfy.sh](https://ntfy.sh) — Push notification bridge
- All the amazing coding agents this project bridges to