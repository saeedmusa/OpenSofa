# OpenSofa

**Remote Coding Agent Controller — PWA**

Control your coding agents from anywhere. A progressive web app that connects to Claude Code, Aider, Goose, Gemini, Codex, OpenCode, and more — all from your phone.

## Overview

OpenSofa is an open-source PWA that acts as a remote control for coding agents running on your laptop via AgentAPI. It uses a **sandwich architecture**: your phone is a thin display + input terminal, while all computation happens on the laptop.

- **Create coding sessions** from any browser or phone
- **Send tasks** and see real-time agent output via SSE streaming
- **Approve/reject actions** from your phone with push notifications
- **Browse files** the agent has changed with syntax highlighting
- **Run multiple agents in parallel** — each in its own git worktree

## Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   PWA (Phone    │────►│  OpenSofa Backend    │────►│   AgentAPI      │
│   or Browser)   │◄────│  (Node.js + Express) │◄────│   (localhost)   │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
         │                        │                          │
    WebSocket +            REST API +                  tmux session
    Web Push              SSE Events                  with agent
```

**Key Design Principles:**
- 📱 **Mobile-first** — optimized for small screens, touch targets ≥ 44px
- 🏗️ **Structured events** — SSE events carry typed data, not parsed text
- 🔔 **Web Push** — native push notifications via VAPID (no third-party services)
- 💾 **SQLite** — WAL mode for concurrent read/write without corruption

## Prerequisites

The one-line installer handles these automatically:
- **Node.js 18+**
- **Git** — for worktree isolation
- **tmux** — for terminal session management
- **cloudflared** — for secure tunnel access
- **AgentAPI** — HTTP wrapper for coding agents
- **At least one coding agent** — Claude Code, Aider, Goose, etc.

## Quick Start (One-Line Install)

```bash
curl -fsSL cdn.jsdelivr.net/gh/saeedmusa/OpenSofa@latest/scripts/opensofa.sh | bash
```

**What this does:**
- ✓ Detects OS (macOS/Linux) and architecture (x64/ARM64)
- ✓ Installs missing prerequisites automatically
- ✓ Clones and builds OpenSofa
- ✓ Installs the `opensofa` command
- ✓ Starts the server and shows a QR code

**After installation:**
```bash
opensofa          # Start and show QR code
opensofa stop     # Stop the server
opensofa status   # Check if running
opensofa logs     # View live logs
opensofa update   # Update to latest version
opensofa help     # See all commands
```

---

## Manual Install

If you prefer to install manually or the installer fails:

```bash
# Clone
git clone https://github.com/saeedmusa/opensofa.git
cd opensofa

# Install & build
npm install
npm run build

# Install frontend dependencies  
cd src/web/frontend && npm install && cd ../../..

# Start the server
npm run dev
```

Open `http://localhost:3000` on your phone or browser.

**For iOS push notifications:** Tap the Share button → "Add to Home Screen" to install the PWA.

---

## Prerequisites

The installer handles these automatically, but if you want to verify:

1. **Node.js 18+**
2. **AgentAPI** — `go install github.com/coder/agentapi/cmd/agentapi@latest`
3. **At least one coding agent** — Claude Code, Aider, Goose, etc.
4. **git** — required for worktree isolation
5. **tmux** — required for terminal session management

---

Config is stored in `~/.opensofa/config.yaml` (created on first run):

```yaml
# Default coding agent
defaultAgent: claude

# Maximum concurrent sessions
maxSessions: 5

# Web server port
webPort: 3000

# Auto-approve agent actions (not recommended)
autoApprove: false
```

### Environment Variables (.env)

```bash
OPENSOFA_CONFIG_DIR=~/.opensofa   # Custom config location
LOG_LEVEL=info                     # debug, info, warn, error
NODE_ENV=development               # development or production
```

## Features

### Session Management
- Create sessions with agent/directory/model picker
- Multiple concurrent sessions with git worktree isolation
- Session stop, restart, and status monitoring

### Real-Time Streaming
- Live activity feed with grouped events
- File change notifications
- Agent output streaming via SSE

### Approvals
- Push notification when agent needs approval
- Approve/reject from phone notification or PWA
- Deep link approvals — tap the notification to go directly to the approval

### File Browser
- Browse the repository file tree
- View file contents with syntax highlighting
- See git diffs for changed files

### Push Notifications
- Web Push via VAPID (no third-party services)
- Notifications for approvals, errors, and session completion
- Background sync for offline actions

### Voice Input
- Dictate messages to the agent using voice
- Works on both mobile and desktop

### PWA
- Install to home screen for native app feel
- Offline page when disconnected
- Service worker with caching strategy

## Supported Agents

| Agent | Type | Notes |
|-------|------|-------|
| Claude Code | `claude` | Anthropic's official CLI |
| Aider | `aider` | AI pair programming |
| Goose | `goose` | Block's AI developer |
| Gemini | `gemini` | Google's AI |
| Codex | `codex` | OpenAI's coding agent |
| Amp | `amp` | AI coding assistant |
| OpenCode | `opencode` | Open source coding agent |
| Copilot | `copilot` | GitHub Copilot CLI |
| Cursor | `cursor` | Cursor's CLI |
| Auggie | `auggie` | Augment Code agent |
| Amazon Q | `amazonq` | Amazon Q Developer CLI |
| Custom | `custom` | Custom agent command through AgentAPI |

## Project Structure

```
opensofa/
├── src/
│   ├── main.ts                    # Entry point, Express server setup
│   ├── types.ts                   # Shared TypeScript interfaces
│   ├── config.ts                  # Config loader
│   ├── session-manager.ts         # Session lifecycle management
│   ├── feedback-controller.ts     # SSE event handling from AgentAPI
│   ├── broadcaster.ts             # WebSocket event broadcasting
│   ├── push.ts                    # Web Push notification manager
│   ├── message-queue.ts           # Message queue for busy agent
│   ├── state-persistence.ts       # Session state persistence
│   ├── agentapi-client.ts         # AgentAPI HTTP client
│   ├── permission-classifier.ts   # Approval detection
│   ├── db.ts                      # SQLite database (WAL mode)
│   └── web/
│       ├── server.ts              # Express routes + WebSocket
│       └── frontend/              # React PWA (Vite + TypeScript)
│           ├── src/
│           │   ├── components/    # UI components
│           │   ├── views/         # Page views
│           │   ├── hooks/         # Custom React hooks
│           │   └── providers/     # Context providers
│           └── public/
│               ├── manifest.json  # PWA manifest
│               ├── sw.js          # Service worker
│               └── icons/         # PWA icons
├── scripts/
│   ├── setup.sh                   # Auto-setup script
│   └── check-prerequisites.ts     # Dependency checker
├── docs/                          # Architecture & design docs
└── package.json
```

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

## PM2 (Production)

```bash
# Build before running in production
npm run build
cd src/web/frontend && npm run build && cd ../../..

# Start under PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Troubleshooting

- **AgentAPI not responding** — Try restarting the session from the PWA
- **Push notifications not working on iOS** — Must install PWA to Home Screen first (iOS 16.4+)
- **Directory is not a git repo** — Run `git init` in that directory, then retry
- **Session stuck** — Stop and recreate the session from the home screen

## Safety Features

- **Git worktrees** — each session isolated in its own directory
- **Approval detection** — agent permission requests surface as push notifications
- **Rollback** — revert uncommitted changes
- **Emergency stop** — kill the agent immediately from the PWA

## License

MIT

## Acknowledgments

- [AgentAPI](https://github.com/coder/agentapi) — HTTP wrapper for coding agents
- All the amazing coding agents this project bridges to