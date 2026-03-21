---
title: Tech Stack Reference
category: project-intelligence
type: lookup
version: 1.0
created: 2026-03-21
updated: 2026-03-21
tags: [tech-stack, dependencies, frameworks, libraries]
related: [architecture.md, code-quality.md, testing.md]
codebase_references:
  - path: package.json
    lines: 1-48
    description: All dependencies and scripts
  - path: tsconfig.json
    lines: 1-23
    description: TypeScript configuration
---

# Tech Stack Reference

## Runtime & Language

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 22+ | Runtime (ES2022 target) |
| **TypeScript** | 5.4+ | Type-safe development |
| **ES Modules** | Native | `"type": "module"` in package.json |

## Backend Stack

### Web Framework
- **Hono** `^4.12.8` — Lightweight, TypeScript-first web framework
- **@hono/node-server** `^1.19.11` — Node.js adapter for Hono

### Database
- **better-sqlite3** `^12.8.0` — Embedded SQLite database
- Zero-config, file-based, perfect for single-user PWA

### Real-time Communication
- **ws** `^8.18.0` — WebSocket server for live updates
- **eventsource** `^2.0.0` — SSE client for AgentAPI events

### Logging & Validation
- **pino** `^9.0.0` + **pino-pretty** `^11.0.0` — Structured logging
- **zod** `^4.3.6` — Runtime type validation

### Security & Auth
- **web-push** `^3.6.7` — Push notifications (VAPID)
- **qrcode** `^1.5.4` + **qrcode-terminal** `^0.12.0` — TOTP/QR codes
- **@hapi/boom** `^10.0.0` — HTTP error responses

### Utilities
- **js-yaml** `^4.1.0` — YAML parsing (config files)
- **sharp** `^0.33.0` — Image processing
- **uuid** `^10.0.0` — Unique identifiers

## Frontend Stack

### Framework
- **React** — UI library (in `src/web/frontend/`)
- **Vite** — Build tool and dev server
- **TypeScript** — Type safety

### State Management
- **Zustand** — Lightweight state management
- **React Query** — Server state synchronization

### Styling
- **Tailwind CSS** — Utility-first CSS framework
- **CSS Modules** — Component-scoped styles

## Development Tools

### Build & Dev
```bash
npm run build          # Compile TypeScript
npm run build:frontend # Build React PWA
npm run build:all      # Build both
npm run dev            # Run backend with tsx
npm run dev:frontend   # Run Vite dev server
```

### Testing
- **Vitest** `^2.0.0` — Unit/integration tests
- **Playwright** `^1.58.2` — E2E tests

### Type Checking
```bash
npm run build  # Runs tsc — also validates types
```

## External Dependencies

### AgentAPI
- **Purpose:** Manages AI agent processes (tmux + HTTP)
- **Port:** localhost:3284+N (per session)
- **Endpoints:** `/events` (SSE), `/messages`, `/message`, `/upload`, `/status`
- **ACP Support:** Experimental (`--experimental-acp` flag)

### AI Agents (Managed by AgentAPI)
- Claude Code
- OpenCode
- Aider
- Goose
- Gemini CLI
- Codex
- And more...

## Configuration Files

| File | Purpose | Format |
|------|---------|--------|
| `tsconfig.json` | TypeScript config | JSON |
| `package.json` | Dependencies & scripts | JSON |
| `~/.claude.json` | Claude Code MCP config | JSON |
| `~/.config/opencode/config.json` | OpenCode config | JSON |
| `~/.aider.conf.yml` | Aider configuration | YAML |

## Version Constraints

- **Node.js:** 22+ (ES2022 features, native ESM)
- **TypeScript:** 5.4+ (strict mode, `satisfies` operator)
- **ES Target:** ES2022 (top-level await, etc.)
- **Module System:** NodeNext (ESM with .js extensions)
