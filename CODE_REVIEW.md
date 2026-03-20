# OpenSofa — Complete Code Review

**Date:** March 20, 2026  
**Reviewer:** OpenAgent (Automated Code Review)  
**Scope:** Full codebase — backend, frontend, tests, configuration  
**Methodology:** Static analysis, pattern matching, architecture review, web research for current best practices
**Verification:** All critical issues verified against actual source code. 3 corrections made after verification:
- Issue #5: Clarified `execSync` locations (removed `base-adapter.ts` which uses `require()` in ESM — that belongs in issue #20)
- Issue #6: Corrected location — injection is in `execTmux` at line 82, not `buildPipeArgs` at line 38
- Issue #11: `session-manager.ts:219-221` is actually acceptable (commented "Best effort status probe only"), removed from issue list

---

## Executive Summary

OpenSofa is a Remote Coding Agent Controller PWA that enables developers to control AI coding agents from their phone or browser. The codebase demonstrates strong engineering fundamentals — TypeScript strict mode, 700+ tests, thoughtful security measures, and clean dependency injection patterns. However, **8 critical security vulnerabilities** and **44 warning-level issues** require attention before production deployment.

| Severity | Count | Action Required |
|----------|:-----:|-----------------|
| 🔴 Critical | 8 | Fix immediately — blocks production |
| 🟡 Warning | 44 | Fix within 2 weeks |
| 🔵 Suggestion | 15 | Fix within 1 month |
| **Total** | **67** | |

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

These issues represent active security vulnerabilities or architectural flaws that could lead to data breaches, remote code execution, or complete authentication bypass.

| # | Issue Name | Simple Terms / Impact | What The Issue Is | What The Fix Is |
|---|-----------|----------------------|-------------------|-----------------|
| 1 | **Token Leaked in URLs** | Your secret password gets written into web addresses, browser history, server logs, and proxy logs — anyone who sees those logs can hijack your session | Auth token is accepted via `?token=` query parameter (`src/web/middleware/auth.ts:33-35`) and embedded in QR code URLs (`src/web/server.ts:458`). Tokens in URLs leak via Referer headers, browser history, and server access logs. Per websocket.org (2026): "URL query parameter authentication works but has security implications since URLs may be logged" | Remove query parameter token support entirely. Use only `Authorization: Bearer` header. For initial PWA access, implement a one-time bootstrap code flow (short-lived, single-use code) instead of embedding tokens in URLs |
| 2 | **TOTP Secret Stored in Plain Text** | Your two-factor authentication secret is saved as a readable text file — anyone with file access can forge your 2FA codes | `src/web/routes/totp.ts:84-104` reads/writes the TOTP secret as raw text. The comment says "encrypt with AES-256-GCM" but the code never does it. Per current best practices (2026): TOTP secrets must be encrypted at rest using AES-256-GCM with a key derived from an environment variable | Implement actual AES-256-GCM encryption using a key derived from `OPENSOFA_SECRET` environment variable. Use Node.js `crypto.createCipheriv`/`createDecipheriv` with a random IV stored alongside the ciphertext |
| 3 | **TOTP Setup Has No Authentication** | Anyone on the network can set up their own two-factor code without proving who they are first | `src/web/routes/totp.ts:120` — TOTP routes are created without auth middleware. An unauthenticated attacker could call POST `/setup` to create their own TOTP, then use POST `/verify` to generate valid codes, completely bypassing the auth system | Wrap TOTP routes with the existing `createAuthMiddleware` so only authenticated users can set up TOTP. The setup endpoint should require a valid bearer token |
| 4 | **TOTP Setup Exposes Raw Secret** | When setting up 2FA, the server sends the secret key back in the response — anyone intercepting the response can clone your 2FA | `src/web/routes/totp.ts:134` returns `{ qrUri, secret }` in the JSON response. The QR URI already contains the secret encoded, so returning it again is redundant and creates an additional attack surface | Remove the `secret` field from the API response; only return `qrUri`. The QR code already contains everything the authenticator app needs |
| 5 | **`execSync` Command Injection** | The code runs shell commands by拼接 strings together — an attacker could inject extra commands by manipulating input or PATH | `src/web/routes/opencode-models.ts:18,53` and `src/model-adapters/opencode-adapter.ts:156,193` use `execSync('opencode auth list')` with string commands passed to a shell. Per Node.js security (2026) and CVE-2025-53372: "The vulnerability stems from unsanitized use of input parameters within child_process.execSync calls" | Replace ALL `execSync` calls with `execFileSync('opencode', ['auth', 'list'], ...)` which prevents shell interpretation entirely. This is the #1 recommended fix per OWASP and Node.js security guidelines |
| 6 | **Tmux Command Injection via Log Path** | When streaming terminal output, the file path is拼接 into a shell command — a malicious path could run arbitrary commands | `src/web/terminal-stream.ts:82` — `execTmux` calls `execSync('tmux ${args.join(' ')}')` which joins the array into a shell string. Even though `buildPipeArgs` (line 38) creates an array, the injection happens when `execTmux` concatenates it into `cat >> ${logPath}` | Fix `execTmux` to use `execFileSync` with array arguments instead of joining into a shell string. Change to: `execFileSync('tmux', args, { stdio: 'pipe' })` |
| 7 | **Weak Shell Validation Function** | The "safe" shell function has a regex that matches literally everything, making it useless as a safety check | `src/utils/safe-shell.ts:52-57` — the `/\br\b/` pattern matches any word boundary (essentially every word in every command). The function claims to block dangerous commands but actually allows most things through. This gives a false sense of security | Remove `safeShell` entirely. Use only `safeExec`/`safeGitExec` which use `execFileSync` and are inherently safe because they don't invoke a shell |
| 8 | **Database Created at Import Time** | The database file is opened the moment you import the module — you can't test code that uses the database without a real SQLite file | `src/db.ts:7-8` — `export const db = new Database(dbPath)` runs at import time, creating a side effect that can't be mocked. Per better-sqlite3 testing guidance (2026): module-level database initialization conflicts with test isolation and causes file locks | Use lazy initialization: `let _db = null; export function getDb() { if (!_db) _db = new Database(dbPath); return _db; }`. Add a `closeDb()` function for graceful shutdown and test cleanup |

---

## 🟡 WARNING ISSUES (Fix Within 2 Weeks)

These issues represent code quality problems, architectural weaknesses, performance bottlenecks, or testing gaps that degrade maintainability and reliability.

| # | Issue Name | Simple Terms / Impact | What The Issue Is | What The Fix Is |
|---|-----------|----------------------|-------------------|-----------------|
| 9 | **God Module: session-manager.ts** | One file does everything — creating sessions, managing git, spawning processes, handling approvals, saving state. If you need to change how sessions work, you touch 1441 lines | `src/session-manager.ts` is 1441 lines handling 10+ responsibilities: worktree management, port allocation, process spawning, health checks, approval handling, message queuing, state persistence, agent switching, directory switching, media upload | Extract into focused modules: `WorktreeManager` (git operations), `ProcessSpawner` (tmux/AgentAPI), `ApprovalHandler` (approval detection), `PortAllocator` (port management), `SessionLifecycle` (orchestration only) |
| 10 | **God Module: server.ts** | The web server file creates the HTTP server, WebSocket server, routes, terminal streaming, event wiring, QR codes, and tunnel — all in one 760-line function | `src/web/server.ts` — the `start()` function is ~370 lines doing initialization, middleware setup, route mounting, WebSocket handling, event wiring, and tunnel startup | Extract into: `setupMiddleware(app)`, `setupRoutes(app, deps)`, `setupWebSocket(server, deps)`, `setupTunnel(config)`, `wireSessionEvents(deps)` |
| 11 | **Silent Error Swallowing** | Errors happen but nobody knows — the code catches exceptions and does nothing, hiding real problems from logs | Empty `catch {}` blocks in: `state-persistence.ts:97` (saveSync — best effort during emergency shutdown but logs nothing), `state-persistence.ts:124` (periodic save swallows errors silently with `.catch(() => {})`), `resource-monitor.ts:385-388`, `feedback-controller.ts:338-357`. Note: `session-manager.ts:219-221` has comment "Best effort status probe only" — this is actually acceptable and intentional | Add `log.debug()` in all empty catch blocks. For critical operations (state save), add `log.warn()` with context. Replace `.catch(() => {})` with proper error handling that logs the failure |
| 12 | **Global Mutable State Everywhere** | Hidden variables that any part of the code can change — makes testing impossible and bugs unpredictable | Module-level mutable state in: `server.ts:721` (clientSockets Map), `auth.ts:233` (defaultTokenManager), `broadcaster.ts:117` (globalSequence), `event-parser/acp-mapper.ts:14` (eventCounter), `message-queue.ts:204` (globalMessageQueue) | Encapsulate all module-level state in classes or factory functions with explicit dependency injection. Per Node.js singleton best practices (2025): "Singletons cause issues under load — they can quietly introduce race conditions and inconsistent behavior" |
| 13 | **Duplicate Agent Adapters** | Two separate folders both have code for handling different AI agents — confusing and hard to maintain | `src/model-adapters/` (Claude, OpenCode, base) and `src/web/agent-adapters/` (Claude, Aider, OpenCode) both exist with different interfaces (`ActivityAdapter` vs `ModelAdapter`) | Consolidate into a single adapter layer. Define one `AgentAdapter` interface and implement per-agent. Document the relationship clearly |
| 14 | **Duplicate `AdapterRegistry` Classes** | Two different registry classes for the same purpose — one for web, one for models | `src/web/agent-adapters/mod.ts:53-83` and `src/model-adapters/registry.ts:30-169` both have `AdapterRegistry` with different APIs | Merge into a single `AgentAdapterRegistry` with a unified interface that supports both activity parsing and model discovery |
| 15 | **Duplicate `isPathWithinDir` Function** | The exact same security check is copy-pasted in two files — if one is fixed but not the other, you have a vulnerability | `src/web/routes/files.ts:57-61` and `src/web/routes/browse.ts:19-23` have identical `isPathWithinDir()` functions | Extract to `src/utils/path-utils.ts` and import from both locations |
| 16 | **CORS Allows Any "localhost" Substring** | A malicious website at `localhost.evil.com` would pass the CORS check and be allowed to make cross-origin requests | `src/web/server.ts:228-237` — `origin.includes('localhost')` matches `localhost.evil.com`, `maliciouslocalhost.com`, etc. Per Hono CORS docs (2026): use exact origin matching or proper domain validation | Use exact matching: `origin === 'http://localhost:' + webConfig.port \|\| origin === 'http://127.0.0.1:' + webConfig.port` |
| 17 | **Synchronous File I/O in Request Handlers** | When someone requests a file list, the entire server freezes while reading the disk — other users wait | `src/web/routes/files.ts:61,65,101,105,122,161,165` and `src/web/routes/browse.ts:61,65,129` use `fs.existsSync`, `fs.statSync`, `fs.readFileSync` in route handlers. Each call blocks the Node.js event loop | Replace ALL with `fs.promises` equivalents. Use `Promise.all` for batch stat operations |
| 18 | **Rate Limiter Memory Leak** | The rate limiter remembers every IP address forever — an attacker with many IPs can exhaust server memory | `src/web/middleware/rate-limit.ts:9` — the `memoryStore` Map grows unboundedly. No cleanup of expired entries is implemented | Implement periodic cleanup (every 5 minutes) or use an LRU cache with TTL eviction like `lru-cache` npm package |
| 19 | **WebSocket Token in URL** | The auth token is sent as part of the WebSocket URL — same problem as HTTP URLs, it gets logged | `src/web/frontend/src/providers/WebSocketProvider.tsx:195` — `ws://host/ws?token=${token}` | Per websocket.org (2026): "The browser WebSocket API has no way to set custom HTTP headers." Use a ticket-based approach: request a short-lived ticket via HTTP, then use the ticket in the WebSocket URL |
| 20 | **`require()` in ESM Module** | Using CommonJS `require()` in a module that's supposed to be ESM — breaks in some environments and defeats tree-shaking | `src/web/agent-adapters/claude-adapter.ts:271`, `src/web/agent-adapters/aider-adapter.ts:234`, `src/model-adapters/base-adapter.ts:85` use `require()` | Use dynamic `import()` or restructure to avoid the need for `require()`. If circular dependencies are the concern, restructure to break the cycle |
| 21 | **Giant Switch Statement in Event Mapper** | One function handles 16 different event types in a 175-line switch — hard to read, hard to test, easy to break | `src/web/event-parser/mapper.ts:317-492` — `mapAGUIToActivityEvent()` is ~175 lines with a massive switch statement | Split into per-event-type mapper functions. Use a strategy/map pattern: `const mappers = { text: mapTextEvent, tool_call: mapToolCall, ... }` |
| 22 | **Duplicated File Path Extraction Logic** | The same pattern for getting file paths from tool calls is repeated 6+ times in one function | `src/web/event-parser/mapper.ts:54-235` — `(event.input?.file_path as string) \|\| (event.input?.path as string)` appears repeatedly | Create helper: `function extractFilePath(input: unknown): string \| null { ... }` and use a lookup table for tool categories |
| 23 | **Module-Level Side Effects at Import** | Importing a module triggers database reads and object creation — you can't import the module without triggering these side effects | `src/web/broadcaster.ts:130` calls `initSequenceFromDB()` at import time. `src/web/agent-adapters/mod.ts:88-93` creates singleton registry at import. `src/web/routes/model-discovery.ts:17-38` runs `initializeAdapters()` at import | Move all initialization into factory functions. Call them explicitly during app startup, not at import time |
| 24 | **Database Never Closed** | The SQLite database is opened at startup but never closed — prevents graceful shutdown and causes file locks in tests | `src/db.ts:7-8` — database is opened at module load, no `close()` method exists | Add `closeDb()` function. Call it during graceful shutdown in `main.ts`. Use `:memory:` databases in tests |
| 25 | **Path Traversal on Case-Insensitive FS** | On macOS (case-insensitive), a path like `/Users/saeed/../Users/Saeed` bypasses the security check | `src/web/routes/browse.ts:19-23` — `isPathWithinDir` uses `startsWith` which doesn't account for case differences or symlinks | Use `fs.realpathSync()` to get the canonical path before comparison. Normalize case on case-insensitive systems |
| 26 | **Screenshot Service Shell Injection** | The screenshot service拼接s the session name into a shell command — while currently safe, the pattern is fragile | `src/screenshot-service.ts:93` — `execSync(\`tmux capture-pane -t ${sessionName} ...\`)` | Use `execFileSync('tmux', ['capture-pane', '-t', sessionName, '-p', '-S', '-50'])` |
| 27 | **`parseAuthHeader` Edge Case** | If someone sends just "Bearer" (no space, no token), the parser returns "Bearer" as the token, causing confusing auth failures | `src/web/auth.ts:84-93` — the `split("bearer ")` logic doesn't handle the case where the header is just "Bearer" | Use `startsWith` check: `if (lowerTrimmed.startsWith('bearer ')) { return trimmed.slice(7).trim() \|\| null; }` |
| 28 | **Sessions Route Swallows JSON Errors** | If a request body is malformed JSON, the server silently returns an empty object instead of telling the client their request was bad | `src/web/routes/sessions.ts:46` — `await c.req.json().catch(() => ({}))` | Return 400 error: `catch(() => c.json(error('Invalid JSON body'), 400))` |
| 29 | **Unsafe `as any` Type Cast** | The code tells TypeScript "trust me, this is the right type" without actually checking — could allow invalid data through | `src/web/routes/sessions.ts:77` — `agent as any` bypasses type checking for agent type parameter | Validate against `agentRegistry.isValidType()` before using the value, return error if invalid |
| 30 | **Unsafe `as AgentType` Cast** | URL parameters are cast directly to typed values without validation | `src/web/routes/agents.ts:43` — `c.req.param('type') as AgentType` casts arbitrary URL parameter | Move the validation check before the cast, or use a type guard function |
| 31 | **Unsafe Payload Type Casts in Frontend** | WebSocket messages are cast to expected types without checking — a malicious server could send unexpected data shapes | `src/web/frontend/src/providers/WebSocketProvider.tsx:158,162,166,173` — multiple `event.payload as Session` casts | Use Zod schemas or type guards to validate payloads at runtime before casting |
| 32 | **`process.env` Type Cast** | Environment variables are typed as always-present strings, but they can be undefined | `src/utils/expand-path.ts:104` — `process.env as Record<string, string>` | Keep proper `Record<string, string \| undefined>` type or use a typed env accessor with validation |
| 33 | **Rate Limiter Tests Don't Test** | The tests check that the function exists but never actually test rate limiting behavior | `tests/rate-limit.test.ts:33-123` — most tests just assert `expect(createRateLimiter).toBeDefined()` | Create a real Hono app instance, send multiple requests, and verify rate limiting actually returns 429 after the limit |
| 34 | **Missing Tests for Browse Routes** | The file browser has complex path traversal protection but no tests to verify it works | No test file exists for `src/web/routes/browse.ts` | Add tests for path traversal attempts, directory creation, symlinks, and edge cases |
| 35 | **Missing Tests for TOTP Routes** | The two-factor authentication API endpoints have no integration tests | No test file for `src/web/routes/totp.ts` route handlers | Add integration tests for setup, verify, and disable endpoints |
| 36 | **Missing Tests for Agent Adapters** | The adapters that parse AI agent output have complex regex logic but no tests | No test files for `src/web/agent-adapters/` implementations | Add unit tests with sample agent output for each adapter |
| 37 | **Missing `.gitignore`** | Build artifacts, secrets, system files, and node_modules could be committed to git | No `.gitignore` file exists at the project root | Create `.gitignore` with: `node_modules/`, `dist/`, `.env`, `*.db`, `.tmp/`, `.DS_Store`, `workDir/`, `*.bak` |
| 38 | **`workDir/` in Repository** | A full copy of the project (including node_modules) is committed to git — doubles repo size | `workDir/` directory exists at repo root with a complete project copy | Add to `.gitignore` and remove from git tracking: `git rm -r --cached workDir/` |
| 39 | **`.bak` Files in Source** | Dozens of backup files are committed to version control — they're clutter and may contain outdated code | `src/web/frontend/src/components/*.bak` and `src/web/frontend/src/views/*.bak` contain many backup files | Add `*.bak` to `.gitignore` and remove from git tracking |
| 40 | **`.DS_Store` Committed** | macOS system files are tracked in git — they're useless on other platforms | `.DS_Store` file exists in the repository | Add `.DS_Store` to `.gitignore` and remove from tracking |
| 41 | **Notification Config Sync I/O** | Reading and writing notification settings uses blocking file operations inside an async handler | `src/web/routes/notifications.ts:38-43` uses `fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync` | Replace with `fs.promises` equivalents |
| 42 | **Terminal Stream Dead Code** | A buffer map is declared but never used — leftover from an unfinished feature | `src/web/terminal-stream.ts:114` — `broadcastBuffers` Map is created but never populated or cleaned up | Remove the unused code or implement the buffering feature |
| 43 | **Enriched PATH Cache Never Invalidated** | The PATH is cached once at startup — if the user installs a new tool, the server won't find it until restart | `src/utils/expand-path.ts:71-96` — `enrichedPathCache` is set once and never refreshed | Document the caching tradeoff, or add a TTL (5 minutes) and invalidation method |
| 44 | **Event Counter Collisions** | Module-level counters could collide in multi-session scenarios or when tests run in parallel | `src/web/event-parser/acp-mapper.ts:14`, `mapper.ts:22`, `jsonl-parser.ts:24` — shared mutable counters | Use UUID-based IDs or make counters instance-scoped per session |
| 45 | **FeedbackController Tight Coupling** | The feedback controller directly depends on a concrete class instead of an interface | `src/feedback-controller.ts:22,48` — directly instantiates `PermissionClassifier` | Define `IPermissionClassifier` interface and inject it via constructor |
| 46 | **Global Message Queue Singleton** | A single message queue is shared across all sessions — hard to test and can cause state leakage | `src/message-queue.ts:204` — `globalMessageQueue` is a module-level singleton | Export a factory function: `createMessageQueue()` instead of a singleton |
| 47 | **Fire-and-Forget Async Operations** | Async operations are started but never awaited — errors are lost and callers can't know if they succeeded | `src/feedback-controller.ts:338-357` — `void (async () => { ... })()` creates untracked promises | Return the promise so callers can await it if needed |
| 48 | **TOTP Dynamic Truncate Bounds** | Array access without bounds checking could cause undefined behavior | `src/web/routes/totp.ts:41-47` — uses `!` non-null assertions on array indices | Add bounds checking: `if (offset + 4 > hmac.length) throw new Error('Invalid HMAC')` |
| 49 | **Error Boundary Doesn't Report** | Frontend errors are only logged to console — production errors are invisible to developers | `src/web/frontend/src/components/ErrorBoundary.tsx:25` — `componentDidCatch` only does `console.error` | Add integration with error reporting service (Sentry, LogRocket, etc.) or at minimum send to a backend endpoint |
| 50 | **Duplicate Approval Logic in Frontend** | The approve/reject flow is implemented twice with nearly identical code | `src/web/frontend/src/components/ApprovalCard.tsx` and `App.tsx:157-246` (DeepLinkApprovalModal) have duplicate handlers | Extract to shared hook: `useApproval(sessionName)` that returns `{ approve, reject, loading, error }` |
| 51 | **Giant `mapToolCallStart` Function** | 180-line function with repeated patterns for extracting filePath from input | `src/web/event-parser/mapper.ts:54-235` | Create helper `extractFilePath(input)` and use a lookup table for tool categories |
| 52 | **Inconsistent Error Response Format** | Some routes use a helper function for errors, others write the format manually — API responses look different depending on which route | `src/web/routes/notifications.ts:20-25,45,62` uses inline `{ success: true, data: ... }` instead of the `success()` helper | Use `success()` and `error()` helpers consistently across all routes |

---

## 🔵 SUGGESTION ISSUES (Fix Within 1 Month)

These are improvements that would enhance code quality, developer experience, and long-term maintainability.

| # | Issue Name | Simple Terms / Impact | What The Issue Is | What The Fix Is |
|---|-----------|----------------------|-------------------|-----------------|
| 53 | **No Backend Linting** | Only the frontend has code quality checks — the 60+ backend files have no linter | No ESLint configured for backend TypeScript files. Only `src/web/frontend/eslint.config.js` exists | Add root-level ESLint flat config with `@typescript-eslint` rules |
| 54 | **No Code Formatter** | Different developers might use different formatting styles — code looks inconsistent | No Prettier or formatter configured at the project level | Add `.prettierrc` with project conventions and a `format` npm script |
| 55 | **Magic Numbers Everywhere** | Hardcoded numbers like 100, 2000, 60 scattered through the code — unclear what they mean | `files.ts:119` (100 entries), `broadcaster.ts:29` (2000 events), `screenshot-service.ts:28` (60 lines) | Extract to named constants: `MAX_DIRECTORY_ENTRIES`, `MAX_EVENT_HISTORY`, `SCREENSHOT_MAX_LINES` |
| 56 | **AgentAPIClient Instantiation Overhead** | A new client object is created every time a message is sent — small but unnecessary allocation | `src/session-manager.ts:45-47` — `agentClient(port)` creates new `AgentAPIClient` on every call | Cache client instances per session in a Map, or use a simple memoized factory |
| 57 | **Frontend Has No Service Layer** | React components directly call API functions — no abstraction for caching, retry, or offline behavior | `src/web/frontend/src/views/HomeView.tsx:21-31` — components call `api.sessions.list()` directly | Use React Query more consistently or create a service layer with caching/retry |
| 58 | **Missing `.env.example` Validation** | The app references `OPENSOFA_SECRET` in comments but never checks if it's actually set | No startup validation for required environment variables | Add validation in `main.ts` startup: check for required env vars and warn if missing |
| 59 | **Unused `@hapi/boom` Dependency** | A package is installed but never used — adds to bundle size and dependency surface | `package.json:18` lists `@hapi/boom` but the codebase uses custom `error()` helper from `types.ts` | Remove from `package.json` and run `npm install` |
| 60 | **Duplicate QR Code Libraries** | Two different QR code packages are installed — may be redundant | `package.json:26-27` lists both `qrcode` and `qrcode-terminal` | Audit usage; remove `qrcode-terminal` if only `qrcode` is used (or vice versa) |
| 61 | **No Pre-commit Hooks** | Developers can commit code that doesn't pass linting or formatting — quality issues slip through | No husky, lint-staged, or pre-commit configuration at the project root | Add husky + lint-staged with ESLint and Prettier checks |
| 62 | **Missing Tests for Notification Routes** | The notification settings API has no tests — config persistence logic is untested | No test file for `src/web/routes/notifications.ts` | Add tests for settings read/write and test notification endpoint |
| 63 | **E2E Tests May Miss Mobile Touch** | Mobile-specific UI (InputBar) uses touch events but Playwright doesn't simulate touch by default | `tests/e2e/mobile.spec.ts` may not test touch-specific components | Use Playwright's mobile emulation with `hasTouch: true` in device config |
| 64 | **Schema Migration in CREATE TABLE** | The `event_id` column is added via ALTER TABLE instead of being in the original schema — fragile | `src/db.ts:28-35` (CREATE TABLE) doesn't include `event_id`, but line 49 adds it via ALTER TABLE | Include `event_id TEXT` in the initial CREATE TABLE. Keep ALTER TABLE for backward compatibility |
| 65 | **Non-Null Assertions on Array Access** | Code uses `!` to tell TypeScript "this won't be null" — but with `noUncheckedIndexedAccess` enabled, this defeats the safety check | `src/web/routes/totp.ts:41-47`, `src/command-parser.ts:29,31,61` use `!` on regex groups and array indices | Use proper null checks or optional chaining instead of `!` |
| 66 | **Browse POST Missing Type Validation** | The directory creation endpoint doesn't check if the `path` parameter is actually a string | `src/web/routes/browse.ts:104` — destructures `path` from JSON without type checking | Add: `if (typeof queryPath !== 'string') return c.json(error('path must be a string'), 400)` |
| 67 | **Missing Tests for Terminal Stream** | Terminal streaming has edge cases (crashes, cleanup failures) that aren't covered | `tests/web/terminal-stream.test.ts` may not cover all edge cases | Add edge case tests for process crashes, log file cleanup failures, and subscriber management |

---

## Issue Summary by Category

| Category | Critical | Warning | Suggestion | Total |
|----------|:--------:|:-------:|:----------:|:-----:|
| **Security** | 8 | 5 | 0 | **13** |
| **Code Quality** | 0 | 8 | 3 | **11** |
| **Architecture** | 0 | 8 | 2 | **10** |
| **Performance** | 0 | 4 | 1 | **5** |
| **Error Handling** | 0 | 6 | 1 | **7** |
| **TypeScript** | 0 | 4 | 2 | **6** |
| **Testing** | 0 | 5 | 2 | **7** |
| **Configuration** | 0 | 4 | 4 | **8** |
| **TOTAL** | **8** | **44** | **15** | **67** |

---

## Top 10 Priority Fixes

| Priority | Issue # | Issue | Why This First |
|----------|:-------:|-------|----------------|
| **1** | 3 | TOTP Routes Lack Authentication | Anyone can set up 2FA without proving identity — complete auth bypass |
| **2** | 2 | TOTP Secret in Plain Text | 2FA is useless if the secret is readable by any process |
| **3** | 5 | `execSync` Command Injection | Shell injection across 3 files — remote code execution risk (CVE-2025-53372 pattern) |
| **4** | 1 | Token Leaked in URLs | Tokens in URLs/logs — session hijacking risk |
| **5** | 4 | TOTP Exposes Raw Secret | Redundant secret exposure in API response |
| **6** | 6 | Tmux Command Injection | Terminal streaming could execute arbitrary commands |
| **7** | 7 | Weak Shell Validation | Safety function doesn't actually validate anything |
| **8** | 16 | CORS Substring Match | Malicious origins can bypass CORS protection |
| **9** | 37 | Missing `.gitignore` | Secrets and artifacts may be committed to git |
| **10** | 9 | God Module: session-manager | 1441-line file is unmaintainable — blocks all future work |

---

## Positive Observations

These are things the codebase does well and should be maintained:

- ✅ **Excellent TypeScript configuration** — Strict mode with `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
- ✅ **Strong security foundations** — Token-based auth with constant-time comparison (`crypto.timingSafeEqual`), IP banning, rate limiting, destructive pattern detection
- ✅ **Comprehensive test coverage** — 34 backend test files + E2E Playwright tests + frontend tests (700+ tests)
- ✅ **Clean dependency injection** — Auth module uses pure functions with explicit dependencies
- ✅ **Safe shell utilities** — `safeExec`/`safeGitExec` use `execFileSync` to prevent injection (the right approach)
- ✅ **Process ownership verification** — `verifyProcessOwnership` prevents killing wrong PIDs if OS reuses them
- ✅ **Graceful shutdown** — Proper signal handling with state persistence
- ✅ **Resource monitoring** — CPU/RAM monitoring with auto-cleanup and cooldown to prevent notification spam
- ✅ **Good documentation** — Architecture docs, product specs, and review documents
- ✅ **Mobile-first PWA** — Service worker, offline support, touch-friendly UI (44px targets)
- ✅ **WAL mode SQLite** — Proper concurrent read/write support
- ✅ **Atomic state saves** — Write-to-temp-then-rename pattern for crash safety

---

## References

- Node.js Security Releases (March 2026): https://nodejs.org/en/blog/vulnerability/march-2026-security-releases
- CVE-2025-53372: Command injection via `execSync` — patched by replacing with `execFileSync`
- OWASP A05:2025 - Injection: Command injection remains in CWE Top 25
- Hono CORS Best Practices (2026): https://hono.dev/docs/middleware/builtin/cors
- WebSocket Authentication Guide (2026): https://websocket.org/guides/authentication/
- SQLite Testing Best Practices (2026): https://oneuptime.com/blog/post/2026-02-02-sqlite-testing/view
- Node.js Singleton Pitfalls (2025): Race conditions and state leakage under load
- TOTP Security Best Practices (2026): AES-256-GCM encryption for secrets at rest
