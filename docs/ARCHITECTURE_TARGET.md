# OpenSofa Target Architecture

**Version:** 4.4  
**Date:** February 18, 2026  
**Status:** Target Design - MVP Focus (Final Bug Fixes)  

---

## Executive Summary

OpenSofa enables **full coding agent control from a mobile PWA**. This document defines the target architecture with an **MVP focus on OpenCode only**, designed to be extended to other agents later.

**Key Changes from v3.0**: 
1. Uses **AgentAPI** for structured SSE events (solves parser fragility)
2. Supports **full terminal access** (not just approvals)
3. Includes **QR code authentication**
4. **Removed offline support** per requirements (but supports offline queue)
5. Addresses **all user capabilities** comprehensively

**Key Changes from v4.2**:
1. Added **mobile terminal controls** (custom Send/Stop/Line buttons)
2. Added **keep-alive handling** (Page Visibility API, background detection)
3. Added **offline message queue** (persist + flush on reconnect)
4. Added **session state recovery** (sequence-based event sync)
5. Added **comprehensive error handling** (transient/recoverable/fatal)
6. Added **mobile diff viewer** (GitHub Mobile-style optimizations)
7. Added **pre-change preview** pattern (nice-to-have)
8. Added **mobile UX validation checklist**
9. Increased rate limits (30→60 msg/min, 10→20 queue)

**Key Changes from v4.2 (Bug Fixes)**:
1. Fixed **section numbering** - eliminated duplicate 1.9, 1.13, 1.14, 1.15
2. Fixed **processQueue logic** - was inverted, now processes when stable
3. Fixed **Session.pid** - added pid field to interface
4. Fixed **ActivityEvent.sequence** - added sequence field for event recovery
5. Fixed **offline support clarification** - documented what's supported
6. Added **EventTransformer helper** - createEvent() method for consistent event creation
7. Fixed **RateLimiter values** - now consistent (60 msg/min, 20 queue)
8. Fixed **KeepAliveManager queue type** - now uses QueuedMessage instead of ActivityEvent
9. Fixed **detectTestResults** - now uses createEvent() for consistent sequence numbers

### MVP Scope

| Aspect | MVP | Future |
|--------|-----|--------|
| Agent | **OpenCode only** | Claude Code, Aider, Goose, etc. |
| Features | Full terminal + approvals + model selection | Additional agents |
| Architecture | AgentAPI client | Multiple adapters |
| Auth | QR code pairing | OAuth, magic links |
| Offline | **Removed** | N/A |
| Model Selection | ✅ Per-session model | - |
| API Keys | Via terminal commands | Config UI |
| Skills/Commands | Auto-loaded per repo | - |

### Foundational Libraries & Infrastructure
To ensure production-grade reliability and security, the architecture mandates the following core libraries:
* **Persistence**: `better-sqlite3` (Replaces in-memory Map storage so sessions survive server restarts)
* **Validation**: `zod` (Strict schema validation on all inbound Socket.IO events and HTTP requests)
* **Security**: `helmet` (HTTP headers), `cors` (Cross-Origin Resource Sharing), and cryptographically secure **256-bit Bearer Tokens** (No complicated JWT/WebAuthn login flows).
* **Logging**: `pino` (Structured JSON logging, replacing `console.log`)
* **Secrets**: `keytar` (Cross-platform native keychain access for API keys)
* **Offline Storage**: `idb-keyval` (IndexedDB wrapper for reliable, async client-side queueing)
* **Remote Access**: `cloudflared` npm package (Maintained, stable tunnels)

### Security & Process Reliability Details
* **WSS Enforcement**: All external traffic routed through `cloudflared` is strictly encrypted transit (HTTPS/WSS).
* **Bearer Token Shield**: Upon `opensofa start`, Node generates a 256-bit token embedded in the QR code. The PWA saves this to IndexedDB.
* **Ruthless Middleware**: An Express middleware intercepts ALL HTTP and WebSocket upgrades. Missing/incorrect `Authorization: Bearer <token>` results in immediate dropped connections (`401 Unauthorized`).
* **Auto-Ban**: Memory-based rate limiters (`express-rate-limit`) will insta-ban an IP for 24 hours after 5 failed token guesses.
* **CSWSH Prevention**: Strict CORS Origin matching forces connections to originate exclusively from `localhost` or the dynamically generated tunnel domain.
* **Payload Control**: Rest API accepts max 1MB JSON limits. Socket.IO events trigger a Leaky Bucket rate limit (max 60 messages/minute) preventing flood attacks.
* **Agent Interruption**: Bypassing missing API hooks, the backend translates the user's "Stop" command into a Graceful OS `SIGINT` isolated strictly to the underlying `opencode serve` PID, protecting backend stability.
* **Scheduled Messages (Queuing)**: Due to lack of native `opencode serve` queuing, the Node backend explicitly tracks the model's 'busy/idle' state and holds user messages in local SQLite memory until the model finishes generating.

### Core Principles
1. **Deep, not broad** - Build excellent OpenCode support before adding agents
2. **Structured over parsed** - Use AgentAPI's SSE, avoid regex fragility
3. **Steal, don't build** - Use proven libraries wherever possible
4. **Zero-config remote access** - MVP uses a bundled relay tunnel (e.g., `cloudflared` npm package) for instant public URLs without setup
5. **Multi-repo parallel** - Run multiple OpenCode sessions simultaneously
6. **Full terminal access** - Users can run ANY command, not just approve
7. **Mobile-first UX** - Every feature works on phone screen

**Clarification on "Offline Support"**:
- **No full offline mode**: Cannot use app without network connection
- **Yes offline queue**: Messages can be queued when network drops, sent on reconnect
- **Agent runs on laptop**: Even if phone disconnects, agent continues working on laptop

---

## 0. Practical Setup & Installation (Critical for MVP)

This section addresses how users actually get started - often overlooked in architecture docs.

### 0.1 OpenCode Installation

The architecture assumes OpenCode is installed. For MVP, we need a setup flow:

```bash
# Option 1: npm global install
npm install -g opencode

# Option 2: Homebrew (macOS)
brew install opencode

# Option 3: Direct binary
curl -L https://github.com/opencode-cli/opencode/releases/latest | tar xz
```

**OpenSofa should verify OpenCode is installed** on startup and guide users if not:

```typescript
async function verifyOpenCodeInstalled(): Promise<boolean> {
  try {
    const result = await execAsync('opencode --version');
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

async function promptInstallation(): Promise<void> {
  // Show installation instructions in PWA
  showModal({
    title: 'OpenCode Not Found',
    content: 'OpenSofa requires OpenCode to be installed on your laptop.',
    steps: [
      '1. Install OpenCode: npm install -g opencode',
      '2. Or: brew install opencode',
      '3. Configure your API keys: opencode --connect anthropic',
    ],
    actions: [{ label: 'Retry', action: verifyOpenCodeInstalled }],
  });
}
```

### 0.2 How Users Connect: Connection Modes

**Problem**: Local network only is too restrictive. Users want to use this from:
- Home WiFi (local - works)
- Work/office (local - works)
- Coffee shop (needs remote)
- Commute (needs remote)

**Solution**: Two connection modes

| Mode | Use Case | Setup Complexity | Security |
|------|----------|-----------------|----------|
| **Local** | Same WiFi network | Zero config | Same network only |
| **Bundled Relay Tunnel** | Remote access | Zero setup, out-of-the-box | Standard |

#### 0.2.1 Local Mode (Default MVP)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOCAL MODE (DEFAULT)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Laptop runs OpenSofa server on port 3280                                   │
│      ↓                                                                       │
│  Server detects local IP: 192.168.1.x                                        │
│      ↓                                                                       │
│  Generates QR with: http://192.168.1.x:3280?token=xxx                       │
│      ↓                                                                       │
│  Phone scans QR → connects directly                                          │
│                                                                              │
│  Pros: Zero setup, works instantly                                          │
│  Cons: Only works on same network                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Auto-detecting local IP**:

```typescript
import os from 'os';

async function detectLocalIP(): Promise<string | null> {
  // Uses Node's built-in OS network interfaces (server-side)
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Return first non-internal IPv4 address
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Alternative: Server tells us its IP
async function getServerIP(): Promise<string> {
  const response = await fetch('/api/server/ip');
  return response.json();
}
```

#### 0.2.2 Bundled Relay Tunnel Mode (Remote Access, Zero-Config)

For users who want remote access without relying on manual setup:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUNDLED RELAY TUNNEL MODE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User runs:                                                                  │
│  $ opensofa start                                                            │
│                                                                              │
│  Server starts and automatically establishes a relay tunnel:                 │
│  → Uses `cloudflared` npm package for stable, zero-config tunnels            │
│  → Instantly generates public URL (e.g. https://xyz.loca.lt)                 │
│                                                                              │
│  Generates QR with: https://xyz.loca.lt?token=xxx                            │
│      ↓                                                                       │
│  Phone scans → connects securely from anywhere                               │
│                                                                              │
│  Pros: Zero setup friction, instant remote access                            │
│  Cons: Connection relies on third-party relay latency                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tunnel integration in OpenSofa**:

```typescript
interface ServerConfig {
  mode: 'local' | 'tunnel';
  tunnelUrl?: string;  // Generated dynamically
  port: number;
}

async function startServer(config: ServerConfig): Promise<void> {
  if (config.mode === 'tunnel') {
    // Start automated relay tunnel alongside OpenSofa
    const tunnel = await startRelayTunnel(config.port);
    console.log(`Tunnel active: ${tunnel.url}`);
    
    // Send URL via PWA Push Notification for instant access
    await notificationService.notify(`OpenSofa active at: ${tunnel.url}`);
  }
  
  // Start OpenSofa local server
  await startOpenSofa(config.port);
}
```

### 0.3 Repository Selection (From Phone)

**Problem**: Users traditionally can't easily instruct an agent on which local folder to start on without running CLI commands manually on the laptop.

**Solution**: The backend exposes a secure `/api/browse` endpoint allowing the PWA to navigate the local filesystem dynamically.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NATIVE REPO SELECTION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHONE SIDE:                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Dashboard shows "Create Session":                                  │    │
│  │  [ Browse Filesystem ]                                              │    │
│  │  ↳ Displays folders dynamically via `/api/browse`                   │    │
│  │  ↳ Highlights folders containing `.git` as "Ready"                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│      ↓                                                                       │
│  BACKEND:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  `fs.readdirSync` streams top-level directories to PWA.             │    │
│  │  User recursively navigates to `~/Projects/my-new-app`              │    │
│  │  Hits "Start Agent"                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Implementation**:

```typescript
// Backend implementation currently exists in src/web/server.ts
app.get('/api/browse', async (c) => {
  const queryPath = c.req.query('path') ?? '';
  // Fix: Prevent Path Traversal
  const safePath = path.resolve(process.cwd(), queryPath);
  if (!safePath.startsWith(process.cwd())) {
    return c.json({ error: 'Unauthorized path traversal attempt' }, 403);
  }
  
  // Fix: Non-blocking fs.promises.readdir vs fs.readdirSync to prevent event loop blocking
  const entries = await fs.promises.readdir(safePath);
  return c.json({ success: true, data: { entries, currentPath: safePath } });
});
```

### 0.4 API Key Setup (Mobile-Friendly)

**Problem**: Currently requires terminal interaction for `/connect`.

**Solution**: Allow API key input via PWA + store securely:

```typescript
// PWA: API key input form
function ApiKeyManager({ sessionId }: { sessionId: string }) {
  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  
  const providers = [
    { id: 'anthropic', name: 'Anthropic (Claude)', models: 'claude-3-5-sonnet' },
    { id: 'openai', name: 'OpenAI (GPT)', models: 'gpt-4o' },
    { id: 'google', name: 'Google (Gemini)', models: 'gemini-1.5-pro' },
    { id: 'openrouter', name: 'OpenRouter', models: '75+ models' },
  ];
  
  return (
    <div className="api-key-form">
      <select value={provider} onChange={e => setProvider(e.target.value)}>
        {providers.map(p => <option value={p.id}>{p.name}</option>)}
      </select>
      
      <input 
        type="password"
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        placeholder="Enter API key..."
      />
      
      <button onClick={() => saveApiKey(provider, apiKey)}>
        Save Key
      </button>
    </div>
  );
}

// Server: store securely via system keychain
import keytar from 'keytar';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

async function saveApiKey(provider: string, apiKey: string): Promise<void> {
  // Store securely using keytar across macOS, Windows, Linux
  await keytar.setPassword('opensofa', provider, apiKey);
  
  // OR securely write to global config, NOT repo .opencode.json
  const confPath = path.join(os.homedir(), '.config', 'opensofa', 'keys.json');
  await fs.mkdir(path.dirname(confPath), { recursive: true });
  await fs.writeFile(confPath, JSON.stringify({ [provider]: apiKey }));
}
```

### 0.5 Quick Start Flow (End-to-End)

For a working MVP, the complete first-time setup should be:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUICK START GUIDE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Install OpenCode (laptop)                                          │
│  ─────────────────────────────────                                          │
│  $ npm install -g opencode                                                  │
│                                                                              │
│  STEP 2: Install OpenSofa (laptop)                                         │
│  ─────────────────────────────────                                          │
│  $ npm install -g opensofa                                                  │
│                                                                              │
│  STEP 3: Configure API Key (optional but recommended)                       │
│  ─────────────────────────────────                                          │
│  $ opencode --connect anthropic                                              │
│  → Enter API key: xxx                                                       │
│                                                                              │
│  STEP 4: Add repositories                                                  │
│  ─────────────────────────────────                                          │
│  $ opensofa scan ~/Development                                              │
│  → Found 5 repositories                                                    │
│                                                                              │
│  STEP 5: Start OpenSofa                                                    │
│  ─────────────────────────────────                                          │
│  $ opensofa server                                                         │
│  → Server running on http://192.168.1.15:3280                              │
│  → QR Code displayed: [QR CODE]                                            │
│                                                                              │
│  STEP 6: Connect Phone                                                     │
│  ─────────────────────────────────                                          │
│  1. Scan QR with phone camera                                              │
│  2. PWA opens, authenticated                                              │
│  3. Select repository → Start session                                      │
│                                                                              │
│  FOR REMOTE ACCESS:                                                        │
│  ─────────────────                                                         │
│  $ cloudflared tunnel create opensofa                                      │
│  $ opensofa server --tunnel opensofa.example.com                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. What Users Can Do - Complete Capability Matrix

### 1.1 Session Management

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ Create session | Select any local repo to start agent | Session Manager → AgentAPI process |
| ✅ Multiple sessions | Run 2+ agents in parallel | Separate AgentAPI per session |
| ✅ Switch sessions | Instantly switch context | Socket.IO room switching |
| ✅ Stop session | Gracefully terminate agent | 3-stage kill (SIGINT → SIGTERM → SIGKILL) |
| ✅ Cancel/Restart | Stop and restart same repo | Stop → Clear state → Restart |
| ✅ Session list | See all sessions on dashboard | Session Registry |
| ✅ Session details | View repo path, status, duration | Real-time status |

### 1.2 Full Terminal Access (ALL Commands)

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ Run ANY command | Any shell command via AgentAPI | `POST /message { type: "raw" }` |
| ✅ Git operations | git status, commit, push, pull, branch, etc. | Via terminal commands |
| ✅ npm/yarn/pnpm | install, run, test, build | Via terminal commands |
| ✅ Shell builtins | cd, export, alias (within session) | Via terminal |
| ✅ Piping/redirection | `cmd \| cmd`, `cmd > file` | Via terminal |
| ✅ Environment vars | Set session-specific env | Via terminal |
| ✅ Working directory | See current path, change dirs | Via terminal |
| ✅ Interactive input | Handle npm init, git rebase prompts | Via approval flow |
| ✅ Process list | See running processes | Via terminal (`ps`, `top`) |
| ✅ Kill processes | Kill specific processes | Via terminal (`kill`) |

### 1.3 Agent Interaction

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ Send prompts | Send natural language tasks | Socket.IO → AgentAPI |
| ✅ Multimodal Uploads | Send images/diagrams to context | `POST /message` (multipart/form-data) |
| ✅ Real-time thinking | See agent output as it types | SSE streaming via AgentAPI |
| ✅ See commands | See what commands run | Parse from message content |
| ✅ See output | See command results | Message content |
| ✅ Interrupt agent | Ctrl+C to stop | `POST /message { type: "raw", content: "\x03" }` |
| ✅ "Oh Crap" Undo | Revert agent's latest file changes | Auto-`git stash push` pre-execution |
| ✅ Mid-Session Handoff | Upgrade model mid-task | Spawn new `opencode serve`, transfer context |
| ✅ Queue messages | Send while agent busy | Message queue → deliver when stable |
| ✅ Agent status | See thinking/waiting/done | `/status` endpoint |
| ✅ Detect questions | Agent asks for clarification | Regex/Parsing on streaming stdout (`?` / prompt indicators) |
| ✅ Violent Cancellation | Force close active sessions | Backend issues `SIGINT`, logs state as `CANCELLED` |
| ✅ Session Resumption | Restore context post-crash | Rehydrate SQLite history to PWA on reconnect |

### 1.4 Approval Flow

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ See command | Exact command to run | Parse from message |
| ✅ Approve | Send "y" | `POST /message { type: "raw", content: "y\n" }` |
| ✅ Reject | Send "n" or Ctrl+C | `POST /message { type: "raw", content: "n\n" }` |
| ✅ Respond to Questions | Send arbitrary answer | `POST /message { type: "raw", content: "your answer\n" }` |
| ✅ Await State | Enter blocker state | Backend sets session `waiting_human_input=true` |
| ✅ Sub-approvals | Nested approvals correlated | Approval chain tracker |
| ✅ Approval history | Past approvals with status | Stored in SQLite session state |
| ✅ Hybrid Push Notifications | **MVP Core** | `ntfy.sh` or Telegram HTTP POST fallback for locked background screens with deep-linking `Click` headers |

### 1.5 Code Visibility

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ Files changed | See modified files | chokidar + git diff |
| ✅ Diff view | Before/after code | react-diff-viewer-continued |
| ✅ Merge Conflicts | Mobile 3-way conflict resolution | Intercept `<<<<<<< HEAD`, expose `/api/git/resolve` |
| ✅ Navigate diffs | Large file pagination | Virtual scrolling |
| ✅ Read-Only Explorer | Browse the entire unchecked repo | `/api/browse` and `/api/file` streaming |
| ✅ Copy snippets | Copy code from diff | Clipboard API |

### 1.6 Test Results

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ Parsed results | Green/red cards | Parse from message |
| ✅ Pass/fail counts | "2 passed, 1 failed" | Parse test output |
| ✅ Failed details | Expand to see failures | Parse test output |

### 1.7 File Browser (Core MVP)

| Capability | Description | Status |
|------------|-------------|--------|
| ✅ See changed files | From agent activity | Via diff cards |
| ✅ Browse all files | Full file tree | **Core MVP** |
| ✅ View any file | Read arbitrary files | **Core MVP** |
| ❌ Create files | Create from phone | **Not MVP** |
| ❌ Edit files | Edit from phone | **Not MVP** |
| ❌ Delete files | Delete from phone | **Not MVP** |

### 1.8 Agent Configuration

| Capability | Description | Status |
|------------|-------------|--------|
| ✅ Agent status | Running/stopped | Via status |
| ✅ Model selection | Choose model | **Core MVP** |
| ✅ Tool selection | Enable/disable tools via MCP | **Core MVP** |
| ⚠️ Temperature | Set agent behavior | **Not MVP** |

### 1.9 Debugging & Re-connection

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ Error messages | See errors | Parse from message |
| ✅ Stack traces | Full error details | Parse from message |
| ✅ Catch-Up Summary | Avoid crashing phone after unlocking | Frontend queries SQLite for missed events after tapping a push deep-link |
| ⚠️ Agent logs | Verbose agent logs | **Not MVP** |
| ⚠️ Resource usage | CPU/memory | **Not MVP** |

### 1.10 Advanced Desktop Parity (Core PWA Security & Features)

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ Biometric Step-Up | Enforce FaceID for `rm -rf` or DB drops | WebAuthn API (`@simplewebauthn`) |
| ✅ Localhost Forwarding | Render "Preview App" when agent runs server | Spawn secondary `cloudflared` process binding to detected port |
| ✅ Financial Guardrails | Budget Caps for autonomous loops | SQLite token tracking per `Session` |
| ✅ Visual Passthrough | Stream headless browser screenshots to chat | Intercept MCP browser outputs |
| ✅ Secrets Vault | Safe API key passing | Native OS Password Manager → JWT vault |

---

### 1.11 OpenCode-Specific Features

OpenCode has rich configuration options that OpenSofa supports:

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ Model selection | Choose AI model per session | `--model` flag via AgentAPI |
| ✅ API key management | Add/remove API keys | `/connect` command via terminal |
| ✅ Custom commands | Create custom `/command` shortcuts | `.opencode/commands/` files |
| ✅ Skills | Load reusable instructions | `.opencode/skills/` directory |
| ✅ Built-in agents | Use `build`, `general` agents | `--agent` flag |
| ✅ Provider config | Configure 75+ LLM providers | Config file |

#### 1.10.1 Model Selection

OpenCode supports 75+ AI models. Users can select different models per session:

```bash
# Via CLI
opencode --model anthropic/claude-sonnet-4-5

# Supported providers:
# - anthropic (Claude)
# - openai (GPT-4, GPT-4o)
# - google (Gemini)
# - openrouter (75+ models)
# - ollama (local models)
# - and more...
```

**OpenSofa implementation**: Pass `--model` flag when starting AgentAPI:

```typescript
async function startAgentAPI(sessionId: string, repoPath: string, model?: string): Promise<string> {
  const args = ['server', '--', 'opencode'];
  
  if (model) {
    args.push('--model', model);
  }
  
  return spawnAgentAPI(sessionId, repoPath, args);
}
```

**PWA UI**: Model selector dropdown in session settings:
```
Model: [anthropic/claude-sonnet-4-5 ▼]
```

### 1.12 MCP Tool Integration (Model Context Protocol)
A coding agent relies drastically on MCP tool plugins (e.g. accessing Postgres, searching the web, executing puppeteer). OpenSofa elevates MCP server configuration to the phone:

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ View Active Servers | See all active MCPs | Parse `mcp.json` config |
| ✅ Configure Server | Supply ENV vars (API Keys) to MCPs | PWA form updates file |
| ✅ Add New Server | Npx install or spawn new MCP | Backend config builder |

**PWA UI**: An "MCP Configurator" tab inside the session. User can toggle tools on/off before invoking the agent.

#### 1.10.2 API Key Management

Users can add API keys for different providers:

```bash
# Connect a provider securely without echoing secret directly into shell history
opensofa config --provider anthropic
# Prompts securely for API key
# Keys stored in ~/.config/opensofa/keys.json
```

**OpenSofa implementation**: Expose via terminal or create helper commands:

```typescript
// Via terminal - user types /connect anthropic
async function handleConnectCommand(sessionId: string, provider: string): Promise<void> {
  // This opens interactive prompt in agent
  await sendRawInput(sessionId, `/connect ${provider}\n`);
}

// Or via config file - for non-interactive setup
async function configureProvider(sessionId: string, providerConfig: ProviderConfig): Promise<void> {
  // Fix: Write to global config, not local repo, to prevent api key git leaks
  const configPath = path.join(os.homedir(), '.config', 'opensofa', 'providers.json');
  const safeConfig = {
    provider: {
      [providerConfig.provider]: {
        apiKey: providerConfig.apiKey,
        options: providerConfig.options,
      },
    },
  };
  await fs.writeFile(configPath, JSON.stringify(safeConfig, null, 2));
}
```

#### 1.10.3 Custom Commands

Create custom commands that run specific prompts:

```markdown
<!-- .opencode/commands/test.md -->
---
description: Run tests with coverage
agent: build
model: anthropic/claude-sonnet-4-5
---

Run the full test suite with coverage report.
```

**Usage**: User types `/test` in terminal

**OpenSofa**: These are per-repo configs, automatically loaded when agent starts in that repo.

#### 1.10.4 Skills

Reusable instructions that agents can load:

```markdown
<!-- .opencode/skills/react-best-practices/SKILL.md -->
---
name: react-best-practices
description: React best practices for code reviews
---

When reviewing React code:
- Check for useEffect dependency arrays
- Prefer functional components
- Use proper memoization
- Follow hooks rules
```

**OpenSofa**: Skills are loaded from repo's `.opencode/skills/` directory automatically.

#### 1.10.5 Built-in Agents

OpenCode has built-in agents:

| Agent | Purpose |
|-------|---------|
| `general` | General coding assistance |
| `build` | Build/test/deploy focused |
| `review` | Code review |
| `debug` | Debugging assistance |

```bash
opencode --agent build
```

---

### 1.13 Session Lifecycle Features

| Capability | Description | Status |
|------------|-------------|--------|
| ✅ Continue session | Resume previous conversation | AgentAPI supports via `--continue` |
| ✅ Fork session | Create branch of conversation | AgentAPI supports via `--fork` |
| ✅ Rename session | Give friendly name to session | PWA UI feature |
| ⚠️ Session history | See past sessions | **Not MVP** - Future |
| ⚠️ Search history | Search past conversations | **Not MVP** - Future |
| ⚠️ Export chat | Export as Markdown/JSON | **Not MVP** - Future |

### 1.14 Native Web Capabilities (Desktop Parity)

Leveraging standard PWA HTML5 APIs to provide native app experiences:

| Capability | Description | Implementation |
|------------|-------------|----------------|
| ✅ Voice Dictation | Speak to the agent via microphone | `window.SpeechRecognition` API |
| ✅ Haptic Feedback | Physical click responses | `navigator.vibrate` |
| ✅ Screen Wake Lock | Keep app alive during long tasks | `navigator.wakeLock.request` |
| ⚠️ Native Share | Share patches or results directly | `navigator.share` (Future) |

### 1.15 Real-Time / Push Hybrid Architecture (iOS Restrictions)

To build a bulletproof OpenSofa experience that survives Apple's aggressive iOS background throttling (where WebSockets are killed 30 seconds after screen lock), we explicitly separate "Foreground Real-Time" from "Background Wake-Up".

#### 1. The Foreground State (Live Screen)
When the PWA is open, it connects directly via WebSockets. The agent types code, and it streams instantly. If the agent asks for approval, the UI simply pops up a modal. No external push notifications are triggered because the user is actively viewing the session.

#### 2. The Background State (Locked Screen)
When the user locks their screen, Apple kills the WebSocket 30 seconds later. 
- **Detection**: The Node.js server detects the `socket.on('disconnect')` event and marks the user's status as "offline/away".
- **Trigger**: When the agent finishes running a task and needs approval, the backend checks the user state. Seeing they are offline, it skips the WebSocket and instantly fires an HTTP POST request to a configured push provider (e.g., `ntfy.sh`).
- **Wake-Up**: The user's phone vibrates natively in their pocket.

#### 3. The Reconnection State (Notification Tap)
The user taps the notification on their lock screen. 
- **Deep Linking**: Because the HTTP POST payload included a `Click: https://...` header, this action deep-links directly back into the exact agent session within the OpenSofa PWA.
- **Sync**: The PWA immediately fetches the missed logs from the SQLite database to synthesize a Catch-Up Summary.
- **Socket**: The PWA re-establishes the WebSocket connection, and the backend marks the user as online again.

*(Note: While native iOS Web Push is available via Safari 16.4+, its notorious silent failure rate makes `ntfy.sh` or local Telegram bots the vastly superior MVP fallback mechanism. Users simply subscribe to a unique topic in the free `ntfy` app and configure OpenSofa via `opensofa config --notify ntfy://topic_name`.)*

#### 1.13.1 Continue Session

Users may want to continue working on a previous session:

```bash
# Via CLI
opencode --continue
opencode --session session-123
opencode --session session-123 --fork  # Fork instead of continuing
```

*⚠️ **WARNING for Headless Environments**: Relying on CLI flags like `--continue`, `--fork`, or `--session` may cause unexpected behavior or hangs if the agent expects interactive TTY input. OpenSofa's backend should explicitly manage session state via API/SSE instead of relying on CLI arguments.*

**OpenSofa**: Store session IDs, allow selection from dropdown:

```typescript
interface SessionMetadata {
  id: string;
  name?: string;
  repoPath: string;
  model: string;
  createdAt: number;
  lastActiveAt: number;
  messageCount: number;
}

// Resume previous session
async function continueSession(sessionId: string): Promise<Session> {
  const session = await sessionManager.getSession(sessionId);
  // Use AgentAPI's --continue or --session flag
}
```

#### 1.13.2 Fork Session

Create a branch of the conversation to try a different approach:

```bash
opencode --session existing-session --fork
```

Useful for:
- "Let me try a different approach" - fork, try, then compare
- Experiment with different models
- Share a branch with someone else

---

### 1.16 Context & Resource Management

| Capability | Description | Status |
|------------|-------------|--------|
| ⚠️ View context | See current context/window | **Not MVP** |
| ⚠️ Clear context | Reset conversation context | **Not MVP** |
| ⚠️ Token usage | See tokens used | **Not MVP** |
| ⚠️ Cost tracking | Track API costs | **Not MVP** |
| ⚠️ Memory status | See context usage | **Not MVP** |

These are useful but require additional AgentAPI queries or parsing.

---

### 1.17 User Experience Features

| Capability | Description | Status |
|------------|-------------|--------|
| ✅ Dark/Light mode | Theme toggle | PWA CSS feature |
| ✅ Keyboard shortcuts | Common actions | PWA JS feature |
| ✅ Voice input | Use microphone to type natively | **MVP Core** |
| ⚠️ Code snippets | Run code inline | **Not MVP** |
| ⚠️ Share session | Share read-only link | **Not MVP** |
| ✅ Mobile terminal controls | Custom interrupt/enter buttons | **MVP** |
| ✅ Keep-alive handling | Background/foreground detection | **MVP** |
| ✅ Offline queue | Queue messages when disconnected | **MVP** |
| ✅ Session state recovery | Resume after reconnect | **MVP** |

#### 1.17.1 Mobile Terminal Controls (Critical for UX)

Desktop users have keyboard shortcuts. Mobile users don't. The PWA MUST provide custom controls:

```tsx
// PWA Mobile Terminal Controls
function MobileTerminalControls({ 
  onInterrupt, 
  onSend, 
  onNewLine,
  disabled 
}: {
  onInterrupt: () => void;
  onSend: () => void;
  onNewLine: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mobile-controls">
      {/* Primary action - Send message */}
      <button 
        onClick={onSend}
        disabled={disabled}
        className="btn-primary"
      >
        ➤ Send
      </button>
      
      {/* Interrupt agent - critical for mobile */}
      <button 
        onClick={onInterrupt}
        disabled={disabled}
        className="btn-danger"
      >
        ⏹ Stop
      </button>
      
      {/* New line in input */}
      <button 
        onClick={onNewLine}
        disabled={disabled}
        className="btn-secondary"
      >
        ↵ Line
      </button>
      
      {/* Quick commands palette */}
      <button 
        onClick={() => showCommandPalette()}
        className="btn-icon"
      >
        ⚡
      </button>
    </div>
  );
}
```

**Why this matters**: 
- Users cannot type `\x03` (Ctrl+C) on mobile keyboards
- Need explicit "Stop" button that sends interrupt signal
- Send button needed because mobile "Enter" behavior varies

#### 1.17.2 Keep-Alive & Background Handling (Critical)

Mobile devices kill background connections. Use Page Visibility API to detect state changes:

```typescript
// PWA Keep-Alive Handler
class KeepAliveManager {
  private socket: SocketIOClient.Socket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageQueue: QueuedMessage[] = [];  // Fixed: was ActivityEvent[]

  constructor(socket: SocketIOClient.Socket) {
    this.socket = socket;
    this.setupVisibilityHandling();
    this.setupSocketHandling();
  }

  private setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // User returned to app - reconnect if needed
        this.handleForeground();
      } else {
        // User left app - prepare for disconnection
        this.handleBackground();
      }
    });

    // Also handle pagehide for iOS
    window.addEventListener('pagehide', () => {
      this.handleBackground();
    });
  }

  private handleForeground() {
    if (!this.socket.connected) {
      console.log('Reconnecting after being backgrounded...');
      this.reconnect();
    } else {
      // Socket still connected - fetch missed events
      this.fetchMissedEvents();
    }
  }

  private handleBackground() {
    // Mark that we expect potential disconnection
    console.log('App backgrounded - connection may be dropped');
    // Don't disconnect - let socket handle it naturally
  }

  private async reconnect() {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.notifyUser('Unable to reconnect. Please refresh.');
      return;
    }

    this.reconnectAttempts++;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    this.socket.connect();
  }

  private async fetchMissedEvents() {
    // Request server to send events since last known sequence
    const lastSequence = await this.getLastKnownSequence();
    this.socket.emit('sync:request', { since: lastSequence });
  }

  private setupSocketHandling() {
    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.fetchMissedEvents();
      this.flushMessageQueue();
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server disconnected - reconnect manually
        this.socket.connect();
      }
      // Otherwise will auto-reconnect
    });
  }

  private notifyUser(message: string) {
    // Show toast/notification
    showToast(message, 'error');
  }

  private async getLastKnownSequence(): Promise<number> {
    const val = await idb.get('lastEventSequence');
    return parseInt(val as string || '0');
  }

  private flushMessageQueue() {
    // Any queued messages during disconnection
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      // Fixed: emit correct payload format for message:send
      this.socket.emit('message:send', { 
        sessionId: msg.sessionId, 
        content: msg.content 
      });
    }
  }
}
```

**Key behaviors**:
1. **Foreground return**: Reconnect + fetch missed events
2. **Background**: Don't force disconnect, let socket handle naturally
3. **Reconnection**: Exponential backoff (1s → 16s max)
4. **Missed events**: Request sync from server using sequence numbers

#### 1.17.3 Offline Message Queue

When network fails, queue messages locally and flush on reconnect:

```typescript
class OfflineQueue {
  private queue: QueuedMessage[] = [];
  private storageKey = 'opensofa_message_queue';

  constructor() {
    this.loadFromStorage();
  }

  async enqueue(sessionId: string, content: string): Promise<void> {
    const message: QueuedMessage = {
      id: crypto.randomUUID(),
      sessionId,
      content,
      timestamp: Date.now(),
    };
    
    this.queue.push(message);
    this.saveToStorage();
  }

  async flush(socket: SocketIOClient.Socket): Promise<void> {
    if (!socket.connected || this.queue.length === 0) return;

    // Fix: Process one by one so exceptions don't drop the entire queue
    while (this.queue.length > 0) {
      const msg = this.queue[0];
      socket.emit('message:send', msg);
      this.queue.shift(); // Remove only after successful processing
      this.saveToStorage();
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  private async loadFromStorage() {
    try {
      const stored = await idb.get(this.storageKey);
      this.queue = stored ? JSON.parse(stored as string) : [];
    } catch {
      this.queue = [];
    }
  }

  private async saveToStorage() {
    await idb.set(this.storageKey, JSON.stringify(this.queue));
  }
}
```

#### 1.17.4 Session State Recovery

After reconnection, user needs to understand what happened:

```typescript
interface SessionRecoveryState {
  lastEventSequence: number;
  lastAgentStatus: string;
  lastMessageCount: number;
  missedEvents: ActivityEvent[];
  reconnectTimestamp: number;
}

async function recoverSession(sessionId: string): Promise<SessionRecoveryState> {
  // Request state from server
  const response = await fetch(`/api/session/${sessionId}/state`);
  const serverState = await response.json();
  
  return {
    lastEventSequence: serverState.sequence,
    lastAgentStatus: serverState.status,
    lastMessageCount: serverState.messageCount,
    missedEvents: serverState.missedEvents,
    reconnectTimestamp: Date.now(),
  };
}

function renderRecoveryUI(state: SessionRecoveryState) {
  if (state.missedEvents.length > 0) {
    return `
      <div class="recovery-banner">
        <p>You were offline. ${state.missedEvents.length} events occurred while you were away.</p>
        <button onclick="showMissedEvents()">View Events</button>
      </div>
    `;
  }
  return '';
}
```

---

### 1.18 Error Handling & Network Failure

#### 1.14.1 Error Classification

Not all errors are equal. Handle them differently:

| Error Type | Example | User Feedback | Auto-Recovery |
|------------|---------|---------------|---------------|
| **Transient** | Network blip | "Reconnecting..." | ✅ Auto-retry |
| **Recoverable** | Agent crash | "Agent crashed. Restarting..." | ✅ Restart agent |
| **User error** | Invalid command | Show error in terminal | ❌ No recovery |
| **Fatal** | Port in use | "Port unavailable. Try another." | ❌ User action needed |

```typescript
class ErrorHandler {
  classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('econnreset') || message.includes('timeout')) {
      return 'transient';
    }
    if (message.includes('process exited') || message.includes('crash')) {
      return 'recoverable';
    }
    if (message.includes('permission denied') || message.includes('not found')) {
      return 'user_error';
    }
    return 'fatal';
  }

  async handle(error: Error, context: ErrorContext): Promise<void> {
    const type = this.classifyError(error);
    
    switch (type) {
      case 'transient':
        await this.handleTransient(error, context);
        break;
      case 'recoverable':
        await this.handleRecoverable(error, context);
        break;
      case 'user_error':
        this.handleUserError(error, context);
        break;
      case 'fatal':
        await this.handleFatal(error, context);
        break;
    }
  }

  private async handleTransient(error: Error, context: ErrorContext) {
    showToast('Connection lost. Reconnecting...', 'warning');
    // Socket.IO handles auto-reconnect
  }

  private async handleRecoverable(error: Error, context: ErrorContext) {
    showToast('Agent crashed. Restarting...', 'warning');
    await sessionManager.restartSession(context.sessionId);
  }

  private handleUserError(error: Error, context: ErrorContext) {
    // Show in terminal as error output
    appendToTerminal(context.sessionId, `Error: ${error.message}`, 'error');
  }

  private async handleFatal(error: Error, context: ErrorContext) {
    showToast(`Fatal error: ${error.message}`, 'error');
    // Offer manual retry
    await sessionManager.stopSession(context.sessionId);
  }
}
```

#### 1.14.2 Network Failure Scenarios

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NETWORK FAILURE HANDLING FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SCENARIO 1: WiFi drops briefly                                              │
│  ─────────────────────────────                                              │
│  Socket.IO detects disconnect                                                │
│      ↓                                                                       │
│  Auto-reconnect with exponential backoff (1s → 16s)                         │
│      ↓                                                                       │
│  Reconnected → Fetch missed events via sequence                              │
│      ↓                                                                       │
│  User sees:connected. 3 events occurred while you were away."            │
│ "Re                                                                              │
│  SCENARIO 2: Phone goes to sleep                                             │
│  ─────────────────────────────────                                          │
│  Page Visibility API detects 'hidden'                                        │
│      ↓                                                                       │
│  Keep connection alive briefly                                               │
│      ↓                                                                       │
│  OS kills connection (typically 30s-5min)                                   │
│      ↓                                                                       │
│  User returns →change 'visible'                                   │
 visibility│      ↓                                                                       │
│  Reconnect + fetch missed events                                            │
│      ↓                                                                       │
│  User sees: "Session active. Synced."                                       │
│                                                                              │
│  SCENARIO 3: Agent crashes                                                   │
│  ────────────────────────                                                   │
│  AgentAPI emits 'close' event                                                │
│      ↓                                                                       │
│  ErrorHandler classifies as 'recoverable'                                    │
│      ↓                                                                       │
│  Show toast: "Agent crashed. Restarting..."                                 │
│      ↓                                                                       │
│  Session Manager spawns new AgentAPI process                                │
│      ↓                                                                       │
│  Reconnect to new port                                                       │
│      ↓                                                                       │
│  User sees: "Agent restarted. Resuming..."                                   │
│                                                                              │
│  SCENARIO 4: Server port exhausted                                           │
│  ────────────────────────────                                               │
│  Port allocation fails                                                       │
│      ↓                                                                       │
│  Show error: "Too many sessions. Please close one."                         │
│      ↓                                                                       │
│  User manually stops a session                                              │
│      ↓                                                                       │
│  Port freed → Retry                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 1.14.3 Agent Process Failure Recovery

```typescript
class AgentRecoveryManager {
  private sessionManager: SessionManager;
  private maxRestartAttempts = 3;
  private restartDelayMs = 2000;

  async handleAgentCrash(sessionId: string): Promise<boolean> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return false;

    for (let attempt = 1; attempt <= this.maxRestartAttempts; attempt++) {
      try {
        // Kill any zombie processes
        await this.cleanupProcesses(sessionId);
        
        // Wait before restart
        await new Promise(r => setTimeout(r, this.restartDelayMs * attempt));
        
        // Restart agent
        await this.sessionManager.restartSession(sessionId);
        
        console.log(`Agent ${sessionId} recovered on attempt ${attempt}`);
        return true;
      } catch (error) {
        console.error(`Recovery attempt ${attempt} failed:`, error);
      }
    }

    // All attempts failed
    await this.handlePermanentFailure(sessionId);
    return false;
  }

  private async cleanupProcesses(sessionId: string) {
    // Ensure no orphaned processes
    const session = this.sessionManager.getSession(sessionId);
    if (session?.pid) {
      try {
        process.kill(session.pid, 'SIGKILL');
      } catch {
        // Process already dead
      }
    }
  }

  private async handlePermanentFailure(sessionId: string) {
    const session = this.sessionManager.getSession(sessionId);
    session.status = 'failed';
    
    // Notify PWA
    this.sessionManager.emit(sessionId, {
      type: 'session_failed',
      reason: 'Agent repeatedly crashed. Please restart manually.',
    });
  }
}
```

---

### 1.19 Code Visibility on Mobile (Diff Viewer UX)

Mobile screens are small. Diff viewing must be optimized:

#### 1.15.1 Diff Viewer Mobile Optimizations

```tsx
// Mobile-Optimized Diff Viewer
function MobileDiffViewer({ 
  filePath, 
  diff, 
  onClose 
}: {
  filePath: string;
  diff: DiffHunk[];
  onClose: () => void;
}) {
  const [selectedHunk, setSelectedHunk] = useState(0);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');

  return (
    <div className="diff-modal">
      {/* Header */}
      <div className="diff-header">
        <span className="file-name">{filePath}</span>
        <button onClick={onClose}>✕</button>
      </div>

      {/* Toggle view mode for mobile */}
      <div className="diff-controls">
        <button 
          onClick={() => setViewMode('unified')}
          className={viewMode === 'unified' ? 'active' : ''}
        >
          Unified
        </button>
        <button 
          onClick={() => setViewMode('split')}
          className={viewMode === 'split' ? 'active' : ''}
        >
          Split
        </button>
      </div>

      {/* Jump to hunk selector */}
      <div className="hunk-selector">
        <select 
          value={selectedHunk} 
          onChange={(e) => setSelectedHunk(parseInt(e.target.value))}
        >
          {diff.map((hunk, i) => (
            <option key={i} value={i}>
              Hunk {i + 1}: +{hunk.additions} -{hunk.deletions}
            </option>
          ))}
        </select>
      </div>

      {/* Diff content with syntax highlighting */}
      <div className="diff-content">
        {viewMode === 'unified' ? (
          <UnifiedDiff hunks={diff} />
        ) : (
          <SplitDiff hunks={diff} />
        )}
      </div>

      {/* Action buttons */}
      <div className="diff-actions">
        <button onClick={() => copyToClipboard(diff)}>
          📋 Copy
        </button>
        <button onClick={() => shareDiff(diff)}>
          📤 Share
        </button>
      </div>
    </div>
  );
}
```

#### 1.15.2 GitHub Mobile-Style Diff Features

Based on research of GitHub Mobile patterns:

| Feature | Implementation | Mobile Benefit |
|---------|---------------|----------------|
| **Hunk navigation** | Jump between changed sections | Don't scroll through entire file |
| **Collapse unchanged** | Hide code without changes | Focus on what matters |
| **Line numbers** | Toggle on/off | Save horizontal space |
| **Syntax highlighting** | Color-coded changes | Quick visual scan |
| **Copy button** | Copy selection/entire diff | Share or paste elsewhere |
| **Swipe navigation** | Swipe between files | Quick file browsing |

```tsx
// Swipe between changed files
function FileSwipeNavigator({ files }: { files: FileChange[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div className="file-navigator">
      <button 
        onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
        disabled={currentIndex === 0}
      >
        ← Prev
      </button>
      
      <span>{currentIndex + 1} / {files.length}</span>
      
      <button 
        onClick={() => setCurrentIndex(i => Math.min(files.length - 1, i + 1))}
        disabled={currentIndex === files.length - 1}
      >
        Next →
      </button>
    </div>
  );
}
```

---

### 1.20 User Feedback Mechanisms

Users need constant feedback that the agent is doing the right thing:

#### 1.16.1 Real-Time Feedback Types

| Feedback Type | When It Happens | How User Confirms |
|---------------|-----------------|-------------------|
| **Approval Cards** | Before running commands | Tap Approve/Reject |
| **File Change Preview** | After agent plans changes | Tap to see diff |
| **Test Results** | After test runs | Green/red cards |
| **Status Indicator** | Always visible | See thinking/waiting |
| **Progress Toast** | Long operations | Progress bar |
| **Completion Summary** | Task done | Read summary |

#### 1.16.2 Pre-Change Diff Preview (Critical UX)

Users should see what will change BEFORE it's applied:

```typescript
// Request preview before agent makes changes
async function requestPreview(sessionId: string, action: string): Promise<Preview> {
  // AgentAPI: Ask for preview mode
  const response = await fetch(`/api/session/${sessionId}/preview`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
  
  return response.json();
}

// In PWA: Show preview modal
function PreviewModal({ preview }: { preview: Preview }) {
  return (
    <div className="preview-modal">
      <h3>Agent plans to:</h3>
      <ul>
        {preview.changes.map(change => (
          <li key={change.file}>
            {change.type} {change.file}
          </li>
        ))}
      </ul>
      
      <div className="preview-diffs">
        {preview.diffs.map(diff => (
          <DiffSummary key={diff.file} diff={diff} />
        ))}
      </div>
      
      <div className="preview-actions">
        <button onClick={() => approvePreview()}>Apply Changes</button>
        <button onClick={() => rejectPreview()}>Cancel</button>
      </div>
    </div>
  );
}
```

#### 1.16.3 Session Summary (Post-Task)

After task completion, summarize what happened:

```typescript
interface SessionSummary {
  messagesSent: number;
  commandsRun: string[];
  filesChanged: FileChange[];
  testsPassed: number;
  testsFailed: number;
  duration: number;
  errors: string[];
}

function renderSummary(summary: SessionSummary): string {
  return `
    ## Task Complete ✓
    
    **Duration:** ${formatDuration(summary.duration)}
    **Messages:** ${summary.messagesSent}
    
    **Files Changed:**
    ${summary.filesChanged.map(f => `- ${f.type} ${f.file}`).join('\n')}
    
    **Tests:** ${summary.testsPassed} passed, ${summary.testsFailed} failed
    
    ${summary.errors.length > 0 ? `**Errors:**\n${summary.errors.join('\n')}` : ''}
  `;
}
```

---

### 1.21 Rate Limiting & Queue Management

#### 1.17.1 Improved Rate Limits

Original limits (30 msg/min) were too strict. Updated:

| Limit | Value | Rationale |
|-------|-------|------------|
| Messages per minute | 60 | Power users need faster iteration |
| Queue size | 20 | Allow more buffered commands |
| Burst allowance | 5 | Allow quick "try again" loops |

```typescript
class AdaptiveRateLimiter {
  private messageTimestamps: Map<string, number[]> = new Map();
  private readonly MAX_MESSAGES_PER_MINUTE = 60;
  private readonly QUEUE_LIMIT = 20;
  private readonly BURST_ALLOWANCE = 5;
  private readonly BURST_WINDOW_MS = 5000;

  canSend(sessionId: string): { allowed: boolean; queued?: boolean; reason?: string } {
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(sessionId) || [];
    
    // Remove old timestamps (> 1 minute)
    const recent = timestamps.filter(t => now - t < 60000);
    
    // Check burst allowance (allow burst in short window)
    const burstRecent = timestamps.filter(t => now - t < this.BURST_WINDOW_MS);
    const isBursting = burstRecent.length < this.BURST_ALLOWANCE;
    
    if (recent.length >= this.MAX_MESSAGES_PER_MINUTE && !isBursting) {
      // Check queue space (length must be passed from caller)
      const queueLength = this.getQueueLength(sessionId, 0 /* pass dynamically */);
      if (queueLength < this.QUEUE_LIMIT) {
        return { allowed: false, queued: true };
      }
      return { allowed: false, reason: 'Rate limited. Please wait.' };
    }
    
    recent.push(now);
    this.messageTimestamps.set(sessionId, recent);
    
    return { allowed: true };
  }

  getQueueLength(sessionId: string, currentQueueLength: number): number {
    return currentQueueLength;
  }
}
```

---

### 1.22 Collaboration Features

| Capability | Description | Status |
|------------|-------------|--------|
| ⚠️ Share session | Generate shareable link | **Not MVP** |
| ⚠️ Read-only view | Someone watches session | **Not MVP** |
| ⚠️ Multiple users | Collaborative editing | **Not MVP** |

These are future features that would require:
- Session state serialization
- WebSocket room management for viewers
- Read-only mode in PWA

---

### 1.23 Advanced Terminal Features

| Capability | Description | Status |
|------------|-------------|--------|
| ✅ Terminal history | Past commands in session | AgentAPI stores |
| ⚠️ Search terminal | Search in terminal output | PWA feature |
| ⚠️ Copy all | Copy entire terminal | PWA feature |
| ⚠️ Download log | Download as file | PWA feature |

#### 1.19.1 Terminal Search

Users often want to search through terminal output:

```tsx
// PWA terminal search
function TerminalSearch({ onClose }) {
  const [query, setQuery] = useState('');
  
  return (
    <div className="search-bar">
      <input 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        autoFocus
      />
      <button onClick={findPrevious}>↑</button>
      <button onClick={findNext}>↓</button>
      <button onClick={onClose}>✕</button>
    </div>
  );
}
```

---

### 1.24 What Users Actually Need (MVP Summary)

Based on analysis, here's what's truly needed for MVP:

**Must Have (MVP):**
- ✅ Create/Stop/Restart sessions
- ✅ Send messages/commands
- ✅ See real-time output
- ✅ Approve/Reject
- ✅ See file changes + diffs
- ✅ Model selection
- ✅ Queue messages when busy
- ✅ 3-stage kill

**Should Have (MVP+):**
- ✅ Session naming
- ✅ Continue session
- ✅ Dark mode
- ✅ Keyboard shortcuts

**Nice to Have (Future):**
- ⚠️ Session history
- ⚠️ Search
- ⚠️ Export
- ⚠️ Token/cost tracking
- ✅ Voice input
- ✅ PWA Push Notifications

---

## 2. Architecture Overview

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MVP ARCHITECTURE (OPENCODE ONLY)                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                              PWA (React)                                  │  │
│   │                                                                           │  │
│   │   VIEWS:                                                                  │  │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │  │
│   │   │ Dashboard    │  │ Session View │  │ Diff Viewer  │                  │  │
│   │   │ (sessions)   │  │ (terminal)   │  │ (modal)      │                  │  │
│   │   └──────────────┘  └──────────────┘  └──────────────┘                  │  │
│   │                                                                           │  │
│   │   COMPONENTS:                                                             │  │
│   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │  │
│   │   │ TerminalCard │ │ FileChange   │ │ ApprovalCard │ │ StatusBadge  │  │  │
│   │   │ (live output)│ │ Card         │ │              │ │              │  │  │
│   │   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │  │
│   │                                                                           │  │
│   │   State: Zustand + TanStack Query                                        │  │
│   │   Auth: QR code → token → IndexedDB (via idb-keyval)                    │  │
│   │   Comm: Socket.IO Client (auto-reconnect)                                │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                         │
│                              Socket.IO (with auth token)                         │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                        OPENSOFA CORE (Node.js)                            │  │
│   │                                                                           │  │
│   │   ┌────────────────────────────────────────────────────────────────────┐  │  │
│   │   │                    Session Manager                                 │  │  │
│   │   │                                                                     │  │  │
│   │   │   • createSession(repoPath) → AgentAPI instance                    │  │  │
│   │   │   • stopSession(id) → 3-stage kill                                 │  │  │
│   │   │   • sendMessage(id, content) → AgentAPI                           │  │  │
│   │   │   • queueMessage(id, content) → when stable                       │  │  │
│   │   │   • getStatus(id) → running/stable                                │  │  │
│   │   │   • listSessions() → all sessions                                 │  │  │
│   │   └────────────────────────────────────────────────────────────────────┘  │  │
│   │                                                                           │  │
│   │   ┌────────────────────────────────────────────────────────────────────┐  │  │
│   │   │              AgentAPI Client (Structured!)                         │  │  │
│   │   │                                                                     │  │  │
│   │   │   • SSE /events → message_update, status_change                  │  │  │
│   │   │   • POST /message → user/raw messages                             │  │  │
│   │   │   • GET /status → running/stable                                  │  │  │
│   │   │                                                                     │  │  │
│   │   │   Transforms: AgentAPI events → ActivityEvents                    │  │  │
│   │   └────────────────────────────────────────────────────────────────────┘  │  │
│   │                                                                           │  │
│   │   SERVICES:                                                              │  │
│   │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │  │
│   │   │ Process     │ │ Message     │ │ File        │ │ Approval    │       │  │
│   │   │ Lifecycle   │ │ Queue       │ │ Watcher     │ │ Tracker     │       │  │
│   │   │             │ │             │ │             │ │             │       │  │
│   │   │ 3-stage    │ │ Priority    │ │ chokidar    │ │ Sub-task    │       │  │
│   │   │ kill       │ │ Retry       │ │ git diff    │ │ History     │       │  │
│   │   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │  │
│   │                                                                           │  │
│   │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │  │
│   │   │ State      │ │ Git         │ │ Auth        │                       │  │
│   │   │ Persistence │ │ Service     │ │ Service     │                       │  │
│   │   │             │ │             │ │             │                       │  │
│   │   │ In-memory  │ │ simple-git  │ │ Token       │                       │  │
│   │   │ + disk     │ │             │ │ Validation  │                       │  │
│   │   └─────────────┘ └─────────────┘ └─────────────┘                       │  │
│   │                                                                           │  │
│   │   Socket.IO Server (rooms, broadcast, acks, auth)                         │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                         │
│                              AgentAPI HTTP + SSE                                 │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                 AgentAPI (Dynamic Internal Ports via IPC)                 │  │
│   │                                                                           │  │
│   │   agentapi server -- opencode (auto-sleep after 15m idle)                │  │
│   │   SSE /events → message_update, status_change                            │  │
│   │   POST /message → send user message                                      │  │
│   │   POST /message {type: "raw"} → send keystrokes                         │  │
│   │   GET /status → stable | running                                          │  │
│   │                                                                           │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                         │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                         OpenCode Agent                                      │  │
│   │                                                                           │  │
│   │   Terminal output → AgentAPI → Structured Events → PWA                   │  │
│   │                                                                           │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MESSAGE & RESPONSE FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER SENDS TERMINAL COMMAND (PWA → Laptop)                              │
│  ────────────────────────────────────────────────                           │
│     PWA Terminal Input                                                       │
│         ↓                                                                   │
│     Socket.IO "terminal:input" { sessionId, command }                        │
│         ↓                                                                   │
│     Session Manager                                                          │
│         ↓ (check agent status via /status)                                  │
│     If STABLE: send immediately                                             │
│     If RUNNING: queue, deliver when stable                                  │
│         ↓                                                                   │
│     AgentAPI POST /message { type: "raw", content: "command\n" }             │
│         ↓                                                                   │
│     OpenCode receives and executes command                                  │
│                                                                              │
│  2. AGENT RESPONDS (Laptop → PWA)                                          │
│  ─────────────────────────────────────────                                  │
│     OpenCode outputs to terminal                                            │
│         ↓                                                                   │
│     AgentAPI captures terminal output                                      │
│         ↓                                                                   │
│     AgentAPI SSE "message_update" event                                    │
│         ↓                                                                   │
│     ┌─────────────────────────────────────────────┐                         │
│     │ Event Transformer                            │                         │
│     │ • Extract structured message                 │                         │
│     │ • Transform to ActivityEvent                │                         │
│     │ • Detect approvals from content             │                         │
│     │ • Parse file changes from message            │                         │
│     │ Output: ActivityEvent[]                     │                         │
│     └─────────────────────────────────────────────┘                         │
│         ↓                                                                   │
│     Socket.IO broadcast to PWA                                             │
│         ↓                                                                   │
│     PWA renders live terminal output                                        │
│                                                                              │
│  3. USER INTERRUPTS (Ctrl+C)                                               │
│  ─────────────────────────────                                              │
│     User taps "Stop" button                                                 │
│         ↓                                                                   │
│     Socket.IO "session:interrupt" { sessionId }                             │
│         ↓                                                                   │
│     AgentAPI POST /message { type: "raw", content: "\x03" }                 │
│         ↓                                                                   │
│     OpenCode receives Ctrl+C                                                │
│                                                                              │
│  4. USER STOPS SESSION (3-stage kill)                                       │
│  ─────────────────────────────────                                          │
│     User taps "Stop" button                                                 │
│         ↓                                                                   │
│     Socket.IO "session:stop" { sessionId }                                  │
│         ↓                                                                   │
│     Session Manager:                                                         │
│       Stage 1: SIGINT (polite) - wait 2s                                    │
│       Stage 2: SIGTERM (force) - wait 3s                                    │
│       Stage 3: SIGKILL (nuclear)                                           │
│         ↓                                                                   │
│     Process killed, state cleaned                                           │
│                                                                              │
│  5. FILE CHANGES                                                            │
│  ─────────────                                                              │
│     OpenCode writes to file                                                 │
│         ↓                                                                   │
│     chokidar fires change event                                             │
│         ↓                                                                   │
│     simple-git computes diff                                                │
│         ↓                                                                   │
│     Socket.IO "file:change" → PWA                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Socket.IO Event Schema

This section defines all Socket.IO events for client↔server communication.

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session:create` | `{ repoPath: string, model?: string }` | Start new session |
| `session:stop` | `{ sessionId: string }` | Stop a session |
| `session:interrupt` | `{ sessionId: string }` | Send Ctrl+C |
| `session:list` | `{}` | Get all sessions |
| `message:send` | `{ sessionId: string, content: string }` | Send message to agent |
| `message:raw` | `{ sessionId: string, input: string }` | Send raw input (keystrokes) |
| `approval:respond` | `{ sessionId: string, approved: boolean }` | Approve/reject command |
| `sync:request` | `{ since: number }` | Request missed events since sequence |
| `auth:verify` | `{ token: string }` | Verify auth token |

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session:created` | `Session` | New session started |
| `session:stopped` | `{ sessionId: string }` | Session stopped |
| `session:status` | `{ sessionId: string, status: SessionStatus }` | Status changed |
| `message:received` | `ActivityEvent` | New agent message/output |
| `approval:needed` | `{ sessionId: string, command: string, id: string }` | Approval required |
| `file:changed` | `{ sessionId: string, files: FileChange[] }` | Files modified |
| `sync:events` | `{ events: ActivityEvent[], sequence: number }` | Missed events on reconnect |
| `error` | `{ code: string, message: string, sessionId?: string }` | Error occurred |
| `connected` | `{ serverVersion: string }` | Connection established |

#### TypeScript Interfaces

```typescript
// Socket event payloads
interface ClientEvents {
  'session:create': (config: SessionConfig) => void;
  'session:stop': (data: { sessionId: string }) => void;
  'session:interrupt': (data: { sessionId: string }) => void;
  'session:list': () => void;
  'message:send': (data: { sessionId: string; content: string }) => void;
  'message:raw': (data: { sessionId: string; input: string }) => void;
  'approval:respond': (data: { sessionId: string; approved: boolean; approvalId: string }) => void;
  'sync:request': (data: { since: number }) => void;
  'auth:verify': (data: { token: string }) => void;
}

interface ServerEvents {
  'session:created': (session: Session) => void;
  'session:stopped': (data: { sessionId: string }) => void;
  'session:status': (data: { sessionId: string; status: SessionStatus }) => void;
  'message:received': (event: ActivityEvent) => void;
  'approval:needed': (data: { sessionId: string; command: string; approvalId: string }) => void;
  'file:changed': (data: { sessionId: string; files: FileChange[] }) => void;
  'sync:events': (data: { events: ActivityEvent[]; sequence: number }) => void;
  'error': (error: { code: string; message: string; sessionId?: string }) => void;
  'connected': (data: { serverVersion: string }) => void;
}

// OpenCode Message format (from OpenCode Native Server to OpenSofa)
interface OpenCodeMessage {
  type: 'message' | 'status' | 'error';
  content: string;
  timestamp: number;
}

// File change from chokidar
interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  diff?: string;  // Git diff if requested
}
```

---

## 3. Key Components

### 3.0 Required Type Definitions

```typescript
// OpenCode Client - wraps HTTP+SSE communication with OpenCode Native Server
interface OpenCodeClient {
  connect(): Promise<void>;
  disconnect(): void;
  sendMessage(content: string, type: 'user' | 'raw'): Promise<void>;
  getStatus(): Promise<'running' | 'stable'>;
  onMessage(callback: (msg: AgentAPIMessage) => void): void;
  onStatusChange(callback: (status: 'running' | 'stable') => void): void;
  onClose(callback: () => void): void;
}

// Port allocator for AgentAPI instances
interface PortAllocator {
  allocate(): number;
  release(port: number): void;
  getUsedPorts(): number[];
}

// Error types
type ErrorType = 'transient' | 'recoverable' | 'user_error' | 'fatal';

interface ErrorContext {
  sessionId?: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

// Rate limiter result
interface RateLimitResult {
  allowed: boolean;
  queued?: boolean;
  reason?: string;
}

// Message queue item
interface QueuedMessage {
  id: string;
  sessionId: string;
  content: string;
  timestamp: number;
}
```

### 3.1 Session Manager

```typescript
// src/session-manager.ts

export interface SessionConfig {
  repoPath: string;
  model?: string;          // e.g., "anthropic/claude-sonnet-4-5"
  agent?: string;          // e.g., "build", "general"
  provider?: string;       // e.g., "anthropic", "openai"
}

interface Session {
  id: string;
  repoPath: string;
  agentAPIUrl: string;
  agentAPIPort: number;
  pid?: number;             // Process ID of AgentAPI (set when spawned)
  status: SessionStatus;
  createdAt: number;
  messageCount: number;
  config: SessionConfig;   // Store session config including model
}

type SessionStatus = 
  | 'starting'    // AgentAPI process starting
  | 'running'      // Agent ready, stable
  | 'thinking'    // Agent processing
  | 'waiting'      // Waiting for user input
  | 'stopping'    // Graceful shutdown
  | 'stopped';    // Fully stopped

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private agentAPIClients: Map<string, AgentAPIClient> = new Map();
  private messageQueues: Map<string, string[]> = new Map();
  private portAllocator: PortAllocator;
  private processManager: ProcessManager;

  async createSession(config: SessionConfig): Promise<Session> {
    const sessionId = this.generateId();
    const port = this.portAllocator.allocate();
    
    // Build OpenCode Native Server args
    const args = ['serve', '--port', port.toString()];
    
    // Add model if specified
    if (config.model) {
      args.push('--model', config.model);
    }
    
    // Add agent if specified
    if (config.agent) {
      args.push('--agent', config.agent);
    }
    
    // Start OpenCode Native Server process
    const agentProcess = await this.processManager.spawn({
      command: 'opencode',
      args,
      cwd: config.repoPath,
      // OPENCODE_SERVER_PASSWORD must be configured in environment for security
      env: { ...process.env },
    });
    
    // Wait for OpenCode server to be ready
    await this.waitForOpenCodeServer(port);
    
    const session: Session = {
      id: sessionId,
      repoPath: config.repoPath,
      openCodeUrl: `http://localhost:${port}`,
      openCodePort: port,
      pid: agentProcess.pid,  // Store the process ID
      status: 'starting',
      createdAt: Date.now(),
      messageCount: 0,
      config,
    };
    
    this.sessions.set(sessionId, session);
    
    // Connect client
    const client = new OpenCodeClient(session.openCodeUrl);
    
    client.onMessage((msg) => this.handleMessage(sessionId, msg));
    client.onStatusChange((status) => this.handleStatusChange(sessionId, status));
    client.onClose(() => this.handleSessionClose(sessionId));
    
    await client.connect();
    this.openCodeClients.set(sessionId, client);
    
    session.status = 'running';
    return session;
  }

  async sendMessage(sessionId: string, content: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const client = this.openCodeClients.get(sessionId);
    
    if (!session || !client) {
      throw new Error('Session not found');
    }
    
    // Check if agent is busy
    const status = await client.getStatus();
    
    if (status === 'running') {
      // Queue message for later
      const queue = this.messageQueues.get(sessionId) || [];
      queue.push(content);
      this.messageQueues.set(sessionId, queue);
      
      // Emit queued event to PWA
      this.emit(sessionId, {
        type: 'message_queued',
        content,
        queueLength: queue.length,
      });
      return;
    }
    
    // Send immediately
    await client.sendMessage(content, 'user');
    session.messageCount++;
    
    // Process any queued messages
    this.processQueue(sessionId);
  }

  async sendRawInput(sessionId: string, input: string): Promise<void> {
    // For terminal commands, Ctrl+C, etc.
    const client = this.openCodeClients.get(sessionId);
    if (!client) throw new Error('Session not found');
    
    await client.sendMessage(input, 'raw');
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.status = 'stopping';
    
    // 3-stage kill
    const killed = await this.processManager.gracefulKill(session.pid, {
      stage1: { signal: 'SIGINT', timeout: 2000 },
      stage2: { signal: 'SIGTERM', timeout: 3000 },
      stage3: { signal: 'SIGKILL', timeout: 0 },
    });
    
    if (!killed) {
      console.error(`Failed to kill session ${sessionId}`);
    }
    
    this.portAllocator.release(session.openCodePort);
    this.openCodeClients.delete(sessionId);
    this.messageQueues.delete(sessionId);
    
    session.status = 'stopped';
  }

  async interruptSession(sessionId: string): Promise<void> {
    // opencode serve does not have an API endpoint for 'interrupt'
    // We send a SIGINT to the monitored child process PID which safely aborts the generation
    // without killing the whole process.
    const session = this.sessions.get(sessionId);
    if (!session || !session.pid) return;
    
    await this.processManager.gracefulKill(session.pid, {
      stage1: { signal: 'SIGINT', timeout: 50 }, // Single SIGINT interrupts
    });
  }

  private async processQueue(sessionId: string): Promise<void> {
    const client = this.agentAPIClients.get(sessionId);
    const queue = this.messageQueues.get(sessionId);
    
    if (!client || !queue || queue.length === 0) return;
    
    const status = await client.getStatus();
    
    // Only process queue when agent is stable (not busy running)
    // Agent is stable when status !== 'running'
    if (status === 'running') return;
    
    // Process queued messages
    const nextMessage = queue.shift()!;
    await client.sendMessage(nextMessage, 'user');
    this.messageQueues.set(sessionId, queue);
    
    // Continue processing if more messages in queue
    if (queue.length > 0) {
      this.processQueue(sessionId);
    }
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
}
```

### 3.2 Process Manager (3-Stage Kill)

```typescript
// src/process-manager.ts

interface ProcessOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

interface KillStage {
  signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL';
  timeout: number;
}

export class ProcessManager {
  private processes: Map<string, ChildProcess> = new Map();

  async spawn(options: ProcessOptions): Promise<{ pid: number; kill: () => Promise<boolean> }> {
    const child = spawn(options.command, options.args || [], {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    const pid = child.pid!;
    this.processes.set(pid.toString(), child);
    
    return {
      pid,
      kill: () => this.kill(pid),
    };
  }

  async gracefulKill(
    pid: number, 
    stages: { stage1: KillStage; stage2: KillStage; stage3: KillStage }
  ): Promise<boolean> {
    // Stage 1: Polite (SIGINT)
    process.kill(pid, stages.stage1.signal);
    
    if (await this.waitForExit(pid, stages.stage1.timeout)) {
      return true;
    }
    
    // Stage 2: Force (SIGTERM) - also kill children
    const children = await this.getChildProcesses(pid);
    for (const child of children) {
      try { process.kill(child, stages.stage2.signal); } catch {}
    }
    process.kill(pid, stages.stage2.signal);
    
    if (await this.waitForExit(pid, stages.stage2.timeout)) {
      return true;
    }
    
    // Stage 3: Nuclear (SIGKILL)
    for (const child of children) {
      try { process.kill(child, stages.stage3.signal); } catch {}
    }
    process.kill(pid, stages.stage3.signal);
    
    return await this.waitForExit(pid, stages.stage3.timeout);
  }

  private async waitForExit(pid: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        process.kill(pid, 0); // Check if process exists
      } catch {
        resolve(true); // Process doesn't exist
        return;
      }
      
      if (timeout === 0) {
        resolve(false);
        return;
      }
      
      setTimeout(() => {
        try {
          process.kill(pid, 0);
          resolve(false);
        } catch {
          resolve(true);
        }
      }, timeout);
    });
  }

  private async getChildProcesses(pid: number): Promise<number[]> {
    // Use ps or similar to get child PIDs
    return new Promise((resolve) => {
      exec(`pgrep -P ${pid}`, (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        const pids = stdout
          .split('\n')
          .filter(Boolean)
          .map((line) => parseInt(line.trim()))
          .filter(Boolean);
        resolve(pids);
      });
    });
  }
}
```

### 3.3 Event Transformer (Simplified - Uses AgentAPI)

```typescript
// src/event-transformer.ts

interface ActivityEvent {
  id: string;
  sequence: number;       // Monotonically increasing for event recovery
  type: EventType;
  timestamp: number;
  sessionId: string;
  summary: string;
  icon: string;
  details?: Record<string, unknown>;
  actionable?: boolean;
}

type EventType = 
  | 'agent_message'
  | 'file_created'
  | 'file_edited'
  | 'approval_needed'
  | 'test_passed'
  | 'test_failed'
  | 'error'
  | 'command_output'
  | 'message_queued'
  | 'completion';

export class EventTransformer {
  private sequenceCounter = 0;
  
  // Note: EventTransformer MUST be instantiated once per session (Singleton per session).
  // If created inside the request handler, sequenceCounter resets to 0 every time, freezing the sequence.
  private getNextSequence(): number {
    return ++this.sequenceCounter;
  }

  transform(agentMessage: OpenCodeMessage, sessionId: string): ActivityEvent[] {
    const events: ActivityEvent[] = [];
    const now = Date.now();
    const content = agentMessage.content;
    const seq = this.getNextSequence();

    // Always emit agent message as terminal output
    events.push({
      id: this.generateId(),
      sequence: seq,
      type: 'agent_message',
      timestamp: now,
      sessionId,
      summary: content.slice(0, 200),
      icon: '🤖',
      details: { fullContent: content },
    });

    // Extract file operations
    events.push(...this.extractFileEvents(content, sessionId, now));

    // Detect approvals
    events.push(...this.detectApprovals(content, sessionId, now));

    // Detect test results
    events.push(...this.detectTestResults(content, sessionId, now));

    // Detect errors
    events.push(...this.detectErrors(content, sessionId, now));

    // Detect completion
    if (this.isCompletion(content)) {
      events.push({
        id: this.generateId(),
        sequence: this.getNextSequence(),
        type: 'completion',
        timestamp: now,
        sessionId,
        summary: 'Agent finished task',
        icon: '✅',
      });
    }

    return events;
  }

  transformStatus(status: 'running' | 'stable', sessionId: string): ActivityEvent {
    return {
      id: this.generateId(),
      sequence: this.getNextSequence(),
      type: status === 'stable' ? 'completion' : 'agent_message',
      timestamp: Date.now(),
      sessionId,
      summary: status === 'stable' ? 'Agent is ready' : 'Agent is thinking...',
      icon: status === 'stable' ? '✅' : '🤔',
    };
  }

  // Helper to create events with sequence
  private createEvent(type: EventType, sessionId: string, summary: string, icon: string, details?: Record<string, unknown>): ActivityEvent {
    return {
      id: this.generateId(),
      sequence: this.getNextSequence(),
      type,
      timestamp: Date.now(),
      sessionId,
      summary,
      icon,
      details,
      actionable: ['approval_needed', 'file_created', 'file_edited'].includes(type),
    };
  }

  private extractFileEvents(content: string, sessionId: string, now: number): ActivityEvent[] {
    const events: ActivityEvent[] = [];
    
    // File created: "✓ Created src/auth/login.tsx (+45 lines)"
    const created = content.match(/Created ([^\s]+)/g);
    if (created) {
      for (const match of created) {
        const filePath = match.replace('Created ', '');
        events.push(this.createEvent('file_created', sessionId, `Created ${filePath}`, '📄', { filePath }));
      }
    }

    // File modified: "Modified src/auth/types.ts (+12, -3)"
    const modified = content.match(/Modified ([^\s]+)/g);
    if (modified) {
      for (const match of modified) {
        const filePath = match.replace('Modified ', '');
        events.push(this.createEvent('file_edited', sessionId, `Modified ${filePath}`, '✏️', { filePath }));
      }
    }

    return events;
  }

  private detectApprovals(content: string, sessionId: string, now: number): ActivityEvent[] {
    const events: ActivityEvent[] = [];
    
    // Use AgentAPI's structured SSE events instead of fragile regex parsing
    // e.g. checking if msg.type === 'approval_request'
    // Fallback naive patterns if structured events are unsupported:
    const patterns = [
      /\b(?:Run|Execute)\b.*\[y\/n\]/i,
      /Confirm:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match) {
        events.push(this.createEvent('approval_needed', sessionId, `Run: ${match[1]?.trim() || 'command'}`, '⚠️', { command: match[1]?.trim() || 'command' }));
        break;
      }
    }

    return events;
  }

  private detectTestResults(content: string, sessionId: string, now: number): ActivityEvent[] {
    const events: ActivityEvent[] = [];
    
    // Test pass: "2 tests passed in 1.2s"
    const passMatch = content.match(/(\d+)\s+tests?\s+passed/i);
    if (passMatch) {
      // Fixed: use createEvent for consistent sequence numbers
      events.push(this.createEvent('test_passed', sessionId, `${passMatch[1]} tests passed`, '✅', { passed: parseInt(passMatch[1]) }));
    }

    // Test fail: "1 test failed"
    const failMatch = content.match(/(\d+)\s+tests?\s+failed/i);
    if (failMatch) {
      // Fixed: use createEvent for consistent sequence numbers
      events.push(this.createEvent('test_failed', sessionId, `${failMatch[1]} tests failed`, '❌', { failed: parseInt(failMatch[1]) }));
    }

    return events;
  }

  private detectErrors(content: string, sessionId: string, now: number): ActivityEvent[] {
    const events: ActivityEvent[] = [];
    
    const errorMatch = content.match(/(?:Error|ERROR|Failed|FAILED)[:\s]+([^\n]+)/i);
    if (errorMatch) {
      // Fixed: use createEvent for consistent sequence numbers
      events.push(this.createEvent('error', sessionId, errorMatch[1].slice(0, 100), '🔴', { errorMessage: errorMatch[1] }));
    }

    return events;
  }

  private isCompletion(content: string): boolean {
    const completionPatterns = [
      /✓ Done/,
      /Done!/,
      /Complete/,
      /All tasks finished/,
    ];
    
    return completionPatterns.some(p => p.test(content));
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
```

---

## 4. Handling User "Random Things"

### 4.1 Unexpected Inputs

The architecture handles users doing unexpected things:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HANDLING UNEXPECTED USER BEHAVIOR                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER DOES THIS:                              ARCHITECTURE HANDLES:         │
│  ────────────────                             ─────────────────────         │
│                                                                              │
│  "random" terminal command                → Pass through to AgentAPI        │
│                                           → Show output in terminal         │
│                                                                              │
│  Spams messages rapidly                   → Message queue + rate limit      │
│                                           → Warn user "agent busy"          │
│                                                                              │
│  Sends Ctrl+C while nothing running      → Ignored gracefully              │
│                                                                              │
│  Tries to stop non-existent session      → Error: "Session not found"      │
│                                                                              │
│  Sends empty message                      → Ignored                         │
│                                                                              │
│  Closes PWA while agent running           → Agent continues on laptop       │
│                                           → Session persists                │
│                                                                              │
│  Opens multiple tabs                      → Same token, same session state  │
│                                           → Socket.IO handles this          │
│                                                                              │
│  Browser crash/reload                     → Reconnect + fetch missed events │
│                                           → Sequence numbers ensure sync    │
│                                                                              │
│  Laptop sleep/wake                        → Socket.IO auto-reconnect        │
│                                           → Check agent status + sync       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Disconnection & Reconnection Handling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DISCONNECTION & RECONNECTION HANDLING                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DISCONNECT DETECTED                                                        │
│  ───────────────────                                                        │
│  Socket.IO 'disconnect' event                                              │
│      ↓                                                                       │
│  Is it expected? (user closed app)                                          │
│      ├─ YES → Clean up, no recovery needed                                  │
│      ↓                                                                       │
│      NO (network issue)                                                     │
│      ↓                                                                       │
│  Auto-reconnect with exponential backoff                                    │
│      ├─ Attempt 1: 1 second                                                 │
│      ├─ Attempt 2: 2 seconds                                                │
│      ├─ Attempt 3: 4 seconds                                                │
│      ├─ Attempt 4: 8 seconds                                                │
│      └─ Attempt 5: 16 seconds (max)                                         │
│      ↓                                                                       │
│  Connected?                                                                 │
│      ├─ YES → Request missed events (sequence-based)                        │
│      └─ NO  → Show "Connection failed" after 5 attempts                    │
│                                                                              │
│  FETCH MISSED EVENTS                                                        │
│  ───────────────────                                                        │
│  Client sends: { lastSequence: 123 }                                        │
│      ↓                                                                       │
│  Server returns: { events: [...], newSequence: 156 }                        │
│      ↓                                                                       │
│  PWA:                                                                       │
│      1. Show banner: "3 events occurred while you were away"               │
│      2. Merge events into timeline                                          │
│      3. Update UI                                                            │
│      4. Scroll to latest                                                     │
│                                                                              │
│  SPECIAL CASE: AGENT STILL RUNNING                                          │
│  ─────────────────────────────────                                          │
│  Even if PWA disconnected, agent continues on laptop                        │
│      ↓                                                                       │
│  On reconnect: Fetch current agent status                                   │
│      ↓                                                                       │
│  Show user: "Agent was working. Here's what happened..."                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 4.2.1 Sequence-Based Event Recovery

Each event has a sequence number. Client tracks last seen:

```typescript
interface EventSequence {
  sessionId: string;
  lastSequence: number;
  events: ActivityEvent[];
}

// Server stores last N events per session
class EventStore {
  private maxEvents = 1000;
  private events: Map<string, ActivityEvent[]> = new Map();

  addEvent(sessionId: string, event: ActivityEvent) {
    const events = this.events.get(sessionId) || [];
    events.push(event);
    
    // Trim to max size
    if (events.length > this.maxEvents) {
      events.shift();
    }
    
    this.events.set(sessionId, events);
  }

  getEventsSince(sessionId: string, sequence: number): ActivityEvent[] {
    const events = this.events.get(sessionId) || [];
    return events.filter(e => e.sequence > sequence);
  }

  getLatestSequence(sessionId: string): number {
    const events = this.events.get(sessionId) || [];
    return events.length > 0 ? events[events.length - 1].sequence : 0;
  }
}
```

#### 4.2.2 Handling Agent While Disconnected

The agent continues running even when PWA is disconnected. On reconnect:

```typescript
async function syncOnReconnect(sessionId: string) {
  // 1. Get current agent status
  const status = await sessionManager.getStatus(sessionId);
  
  // 2. Get missed events
  const missedEvents = await eventStore.getEventsSince(
    sessionId, 
    getLastSequence()
  );
  
  // 3. If agent was running, provide context
  if (status === 'running' && missedEvents.length > 0) {
    const lastUserMessage = missedEvents
      .filter(e => e.type === 'user_message')
      .pop();
    
    if (lastUserMessage) {
      showToast(`While you were away: Agent responded to "${lastUserMessage.summary}"`);
    }
  }
  
  // 4. Render missed events
  renderMissedEvents(missedEvents);
  
  // 5. Update sequence
  setLastSequence(eventStore.getLatestSequence(sessionId));
}
```

---

### 4.3 Error Recovery Scenarios

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR RECOVERY SCENARIOS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SCENARIO                          HANDLING                                  │
│  ─────────                          ────────                                  │
│                                                                              │
│  1. AgentAPI process crashes     → Detect via 'close' event                │
│     (npm install fails, etc.)       → Auto-restart (max 3 attempts)        │
│                                      → Notify user                           │
│                                      → Resume session                        │
│                                                                              │
│  2. Port allocation fails         → Try next available port                │
│     (all ports in use)              → If all used: "Close a session"       │
│                                                                              │
│  3. Git conflict                  → Show conflict details                  │
│     (merge conflict)                → User resolves via terminal            │
│                                                                              │
│  4. API key invalid               → Show error in terminal                 │
│     (OpenAI rate limit)            → User updates key                       │
│                                                                              │
│  5. File permission denied        → Show error in terminal                 │
│     (read-only repo)                → User fixes permissions                │
│                                                                              │
│  6. Session timeout               → If no activity for 30min               │
│     (user away)                     → Notify, offer to continue             │
│                                                                              │
│  7. Laptop sleeps/wakes           → Socket.IO auto-reconnect               │
│                                      → Sync state                            │
│                                                                              │
│  8. Server crashes                → Show error                              │
│                                      → User restarts OpenSofa               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 4.3.1 Graceful Degradation

When something fails, show user-friendly error rather than crash:

```typescript
class GracefulDegradation {
  handleError(error: Error, ui: UIComponent): void {
    switch (error.code) {
      case 'AGENT_CRASHED':
        ui.showErrorCard(
          'Agent crashed',
          'Restarting automatically...',
          [{ label: 'Restart Now', action: 'restart' }]
        );
        break;
        
      case 'PORT_EXHAUSTED':
        ui.showErrorCard(
          'Too many sessions',
          'Please close a session to continue',
          [{ label: 'View Sessions', action: 'dashboard' }]
        );
        break;
        
      case 'NETWORK_ERROR':
        ui.showReconnectingBanner();
        break;
        
      default:
        ui.showErrorCard(
          'Something went wrong',
          error.message,
          [{ label: 'Retry', action: 'retry' }]
        );
    }
  }
}
```

---

### 4.4 Unexpected User Behavior

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HANDLING UNEXPECTED USER BEHAVIOR                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER DOES THIS:                              ARCHITECTURE HANDLES:         │
│  ────────────────                             ─────────────────────         │
│                                                                              │
│  "random" terminal command                → Pass through to AgentAPI        │
│                                           → Show output in terminal         │
│                                                                              │
│  Spams messages rapidly                   → Adaptive rate limit            │
│                                           → Allow bursts + queue           │
│                                           → Warn user if queue full        │
│                                                                              │
│  Sends Ctrl+C while nothing running      → Ignored gracefully              │
│                                                                              │
│  Tries to stop non-existent session      → Error: "Session not found"     │
│                                                                              │
│  Sends empty message                      → Ignored                         │
│                                                                              │
│  Closes PWA while agent running           → Agent continues on laptop       │
│                                           → Session persists                │
│                                           → Reconnect + sync on return     │
│                                                                              │
│  Opens multiple tabs                      → Same token, same session state  │
│                                           → Socket.IO handles this          │
│                                                                              │
│  Browser crash/reload                     → Reconnect + fetch missed events│
│                                           → Sequence numbers ensure sync    │
│                                                                              │
│  Laptop sleep/wake                        → Socket.IO auto-reconnect        │
│                                           → Check agent status + sync       │
│                                                                              │
│  Phone locks while agent working          → Connection drops (expected)      │
│                                           → Reconnect + fetch missed events│
│                                                                              │
│  User switches WiFi to cellular          → Socket.IO reconnects            │
│                                           → Minimal interruption            │
│                                                                              │
│  Accidentally taps "Stop session"        → Confirmation dialog             │
│                                           → "Stop this session?"            │
│                                                                              │
│  Types very long message                  → Character limit (10000)         │
│                                           → Truncate + warn                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
// src/rate-limiter.ts

export class RateLimiter {
  private messageTimestamps: Map<string, number[]> = new Map();
  private readonly MAX_MESSAGES_PER_MINUTE = 60;  // Fixed: was 30
  private readonly QUEUE_LIMIT = 20;               // Fixed: was 10

  canSend(sessionId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(sessionId) || [];
    
    // Remove old timestamps (> 1 minute)
    const recent = timestamps.filter(t => now - t < 60000);
    
    if (recent.length >= this.MAX_MESSAGES_PER_MINUTE) {
      return { allowed: false, reason: 'Rate limited. Please wait.' };
    }
    
    recent.push(now);
    this.messageTimestamps.set(sessionId, recent);
    
    return { allowed: true };
  }

  getQueueLength(sessionId: string): number {
    return this.messageQueues.get(sessionId)?.length || 0;
  }

  isQueueFull(sessionId: string): boolean {
    return this.getQueueLength(sessionId) >= this.QUEUE_LIMIT;
  }
}
```

---

## 5. Authentication

### 5.1 QR Code Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QR CODE AUTHENTICATION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAPTOP:                                                                    │
│  ───────                                                                   │
│  1. Generate random token: "a1b2c3d4e5f6..."                               │
│  2. Store token in memory                                                  │
│  3. Generate QR with: http://localhost:3285?token=a1b2c3...               │
│  4. Display QR on screen                                                   │
│                                                                              │
│  PHONE:                                                                    │
│  ──────                                                                   │
│  1. Camera scans QR code                                                  │
│  2. Opens URL with token in query string                                  │
│  3. Extracts token, saves to IndexedDB (via idb-keyval)                   │
│  4. Cleans URL (removes token)                                            │
│  5. All API calls include token in Authorization header                   │
│                                                                              │
│  SECURITY NOTES:                                                           │
│  ─────────────                                                            │
│  • Token is 32 random bytes - unguessable                                │
│  • No token = 401 Unauthorized                                           │
│  • Token valid until server restart                                        │
│  • Local network only - no external access                                │
│  • For tunnel: HTTPS provided by Cloudflare                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Non-Functional Requirements

### 6.1 Performance Targets

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| End-to-end latency | < 200ms p95 | AgentAPI SSE is fast |
| Message throughput | 60 msg/min | Per-user rate limit (increased from 30) |
| Connection recovery | < 3s | Socket.IO auto-reconnect |
| Connection recovery (background) | < 10s | After phone wakes |
| Session startup | < 5s | Parallel process start |
| Memory per session | < 200MB | AgentAPI + Node |

### 6.2 Reliability

| Requirement | Implementation |
|-------------|----------------|
| Crash recovery | Session state in memory + disk |
| Message ordering | Sequence numbers |
| Idempotency | Dedupe by message ID |
| Graceful degradation | Show errors, don't crash |
| Disconnect handling | Auto-reconnect with backoff |
| Missed event recovery | Sequence-based sync |

### 6.3 Security

| Requirement | Implementation |
|-------------|----------------|
| Authentication | Token in URL + Authorization header |
| No external access | Local network only |
| Session isolation | Separate AgentAPI per session |

### 6.4 Limits

| Resource | Limit |
|----------|-------|
| Concurrent sessions | 5 (MVP) |
| Message queue per session | 20 (increased from 10) |
| Messages per minute | 60 (increased from 30) |
| AgentAPI ports | Dynamic (Internal IPC) |
| Agent state | Auto-sleeps after 15m idle |
| Reconnection attempts | 5 (exponential backoff) |
| Max event history | 1000 events per session |

### 6.5 Mobile-Specific Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Touch targets | ≥ 44px | iOS Human Interface Guidelines |
| Network recovery | < 10s | Phone wake from sleep |
| Offline queue | 20 messages | Allow queuing during commute |
| Diff scroll | Smooth 60fps | Virtual scrolling for large diffs |
| Keyboard handling | Predictable | Mobile keyboards vary wildly |
| Orientation | Portrait primary | Most mobile usage |
| Dark mode | Required | Developer preference |

---

## 7. Implementation Roadmap

### Phase 1: Core (Week 1-2)
- [ ] Session Manager
- [ ] AgentAPI integration
- [ ] Socket.IO with auth
- [ ] Event transformer
- [ ] Message queue

### Phase 2: Session Control (Week 2)
- [ ] 3-stage process kill
- [ ] Session interrupt (Ctrl+C)
- [ ] Rate limiting

### Phase 3: UI (Week 2-3)
- [ ] PWA terminal view
- [ ] Activity feed
- [ ] Approval cards
- [ ] File diff viewer

### Phase 4: Polish (Week 3-4)
- [ ] QR code generation
- [ ] Dashboard
- [ ] Error handling

---

## 8. What's NOT in MVP

| Feature | Reason |
|---------|--------|
| Offline support | Removed per requirements |
| Push notifications | ntfy.sh API |
| Full file browser | See changes only |
| Multiple laptops | Single laptop only |
| Cloud deployment | Local network only |
| Agent configuration | OpenCode only |
| Verbose logging | Debug mode not MVP |
| Resource monitoring | Not MVP |
| Diff Summarizer | Pre-change summary card |
| Voice input | MVP Core |
| Session sharing (Visual) | MVP Core (Share to Flex) |
| Pre-change diff preview | Diff Summarizer (MVP Core) |

---

## 9. Open Questions

1. **Port allocation**: Handled internally via dynamic port routing (e.g. `get-port` or standard IPC) to avoid collisions with 3000-range developer servers.
2. **Max sessions**: How many concurrent sessions? (MVP: 5, with 15m auto-sleep for battery preservation)
3. **Tunnel vs local**: Uses bundled Relay Tunnels for zero-config remote access instead of manual Cloudflare.
4. **PWA hosting**: How does PWA load? Embedded or separate server?
5. **Repo selection**: How does user pick repo? File picker or CLI path?
6. **Pre-change preview**: Resolved. Uses Diff Summarizer (Approve/Reject cards) for massive diffs.
7. **Background notifications**: Resolved. Uses `ntfy.sh` for rock-solid async updates.

---

## 10. Mobile UX Validation Checklist

Before declaring MVP complete, verify these mobile scenarios:

### 10.1 Core Mobile Flows

- [ ] Can start session from phone
- [ ] Can send message from phone
- [ ] Can see terminal output in real-time
- [ ] Can approve/reject commands from phone
- [ ] Can view file diffs on phone
- [ ] Can interrupt agent from phone
- [ ] Can stop session from phone

### 10.2 Network Failure Recovery

- [ ] App reconnects after brief network blip
- [ ] App reconnects after phone sleeps
- [ ] App reconnects after WiFi switch
- [ ] User sees "missed events" banner after reconnect
- [ ] Agent continues running while PWA disconnected

### 10.3 Mobile Terminal UX

- [ ] Custom "Send" button works
- [ ] Custom "Stop" button sends interrupt
- [ ] Input field handles multi-line correctly
- [ ] Terminal scrolls automatically
- [ ] Can copy terminal output

### 10.4 Error Handling

- [ ] Agent crash shows friendly error
- [ ] Agent auto-restarts after crash
- [ ] Port exhaustion shows helpful message
- [ ] Rate limiting shows queue position

---

## 11. Research Sources

- **PWA Best Practices**: Page Visibility API for background detection
- **GitHub Mobile**: Diff viewer patterns (hunk navigation, unified/split views)
- **Socket.IO Docs**: Reconnection strategies, disconnect handling
- **WebSocket Architecture**: Exponential backoff, message queue patterns
- **Real-world testing**: iOS Safari background behavior, Android Chrome patterns

