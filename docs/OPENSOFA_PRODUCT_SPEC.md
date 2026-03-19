# OpenSofa: Product Specification

**Phase**: MVP Version 1.0  
**Core Identity**: The Mobile-First Remote Control for your AI Desktop Agents.

---

## 🛋️ What is OpenSofa?

OpenSofa solves the "chained to the desk" problem of AI-assisted coding. 
When you run complex, multi-step coding agents (like `opencode` or `cline`), they frequently pause to ask for your approval or crash when they hit a snag. If you step away to get a coffee or go to the gym, your agent sits idle.

OpenSofa bridges the gap. It is a **Node.js + React Progressive Web App (PWA)** that runs on your laptop alongside your code. It securely punches a hole through your firewall using a bundled zero-config tunnel, allowing you to monitor real-time terminal outputs, approve commands, and talk to your agent from an optimized mobile web interface anywhere in the world.

---

## ✨ What OpenSofa Can Do (Desktop Parity on Mobile)

To provide a true desktop-class agent experience on your phone, OpenSofa supports the following core capabilities natively through the PWA:

### 1. Repository Workspace & Project Explorer
You aren't restricted to a single project. The PWA includes a native file-browser interface that securely communicates with your laptop, allowing you to navigate your local filesystem, discover Git repositories, and spawn a new coding agent directly into the correct folder. It also includes a **Read-Only Project Explorer** tab, so you can explore existing files and reference specific functions without sending them to the agent first.

### 2. Live File, Diff Viewer & Merge Conflict Resolution
Reviewing 500 lines of modified code on a phone is impossible. When the agent applies or proposes a code change, OpenSofa intercepts the raw diff and presents a highly summarized, swipe-friendly GitHub-style Diff View. Furthermore, if the agent runs into a git merge conflict, instead of dumping `<<<<<<< HEAD` markers into the terminal, the PWA intercepts the state and presents a dedicated **Mobile Merge Conflict UI** with simple "Accept Incoming" or "Accept Current" buttons.

### 3. MCP Management & Visual Tool Passthrough
Modern coding agents rely heavily on MCP to access external tools (browsers, databases, GitHub). The OpenSofa PWA allows you to dynamically configure MCP servers remotely. Crucially, it solves the "Blind Agent" problem: when an agent spawns a headless browser (e.g. Playwright) to test a login flow, the backend captures real-time screenshots of the DOM and streams them inline into the PWA's chat UI. 

### 4. Multimodal Input: Voice & Camera Uploads
Typing long, complex architectural instructions on a mobile screen is frustrating. OpenSofa's PWA includes a native Microphone button leveraging the browser's Speech Recognition API *(Note: This is best for quick foreground commands, as iOS requires an active internet connection and strictly halts voice processing if the screen locks).* Beyond voice and text, it supports **Multimodal Mobile Uploads**. You can snap a screenshot of a bug on your phone or take a picture of an architectural diagram and upload it directly into the agent's context window.

### 5. Preview Apps (Localhost Port Forwarding)
When an agent builds a web app on your laptop and runs `npm run dev` on `localhost:3000`, checking the UI from a phone on cellular data was traditionally impossible. OpenSofa detects when the agent opens a web server and instantly establishes a secondary dynamic ingress rule inside the `cloudflared` tunnel, exposing a secure "Preview App" button localized to your PWA.

### 6. Zero-Config Security & The 256-bit Blast Radius Shield
OpenSofa spins up a secure `cloudflared` tunnel with end-to-end WSS encryption. To prevent RCE (Remote Code Execution) exposure, the backend eschews complex custom login flows in favor of an auto-generated cryptographically secure 256-bit Bearer Token. This token is bundled dynamically into the CLI-generated QR code URL. Upon scanning, the PWA extracts the token, hides it in IndexedDB (removing it from the URL bar), and injects it into every request. A ruthless Express middleware instantly drops any WebSocket or HTTP request missing this exact Bearer Token (`401 Unauthorized`), and an auto-ban memory feature instantly IP-bans any bot that fails 5 consecutive guess attempts for 24 hours. For destructive commands, the PWA utilizes **Time-Based TOTP Step-Up Authentication** (e.g. Google Authenticator) due to notorious conditional UI bugs in iOS Safari's native WebAuthn implementation.

### 7. Asynchronous Waiting & Hybrid Native Push Architecture
Because iOS heavily restricts background PWA WebSockets (Apple kills WebSockets 30 seconds after the screen locks), OpenSofa utilizes a **Real-Time / Push Hybrid Architecture**.
- **1. The Foreground State**: When the PWA is open, it connects directly via WebSockets. The agent types code, and it streams instantly. If the agent asks for approval, the UI simply pops up a modal. No `ntfy` message is sent.
- **2. The Background State**: The user locks their screen. 30 seconds later, Apple kills the WebSocket. The Node.js server detects the `socket.on('disconnect')` event and marks the user as offline. When the agent later gets stuck, the backend skips the WebSocket and instantly fires an HTTP POST payload to a third-party native push bridge (e.g., `ntfy.sh` or Telegram). Your phone vibrates natively.
- **3. The Reconnection State**: The user taps the `ntfy` notification. Because the backend included a deep-linking `Click: https://...` header, this opens the exact agent session in the OpenSofa PWA. The PWA instantly fetches the missed SQLite logs to synthesize a **Catch-Up Summary**, re-establishes the WebSocket, and the backend marks the user as online again.
*(Note: To set this up, users simply subscribe to a unique topic in the free `ntfy` iOS/Android app and run `opensofa config --notify ntfy://topic_name` on their laptop).*

### 8. "Oh Crap" Undo (Auto-Snapshots)
Running unmonitored agents can destroy code. If you return to see an agent wrote terrible code, the backend maintains auto-snapshots (git stashes) before execution, allowing you to hit a giant **"Undo Last Action"** button to instantly kill the agent and cleanly revert the file tree.

### 9. Dynamic Agent Handoff & State Management
Interacting with agents is rarely fire-and-forget. The active stream parsing detects "Human-in-the-Loop" (HITL) states like clarification questions and halts. If a fast model (like Haiku) gets stuck, the PWA provides a **"Promote Agent" (Mid-Session Dynamic Handoff)** button, which pauses the Node backend, serializes context, and hands off execution to an advanced model (like Opus) without disconnecting your WebSocket stream.

### 10. "Share to Flex" (Built-in Virality)
When your agent completes an incredibly complex task, OpenSofa provides a 1-click button to generate a beautiful, styled image card of the achievement, instantly shareable to Twitter or group chats.

---

## 🏗️ How it Works (Under the Hood)

1. **The Backend (Node.js/Express)**: 
   Runs locally on your laptop. It generates a 256-bit Bearer token on startup, coordinates the `cloudflared` tunnel, safely stores API keys cross-platform using `keytar`, and manages persistent SQLite sessions. It intercepts every single incoming connection natively to enforce the Bearer token authorization and IP rate-limiting.
   
2. **The Connection (WebSocket + ntfy Push Fallback)**:
   The backend auto-detects your local network. It validates Bearer Tokens during the `io.use()` handshake and strictly verifies origins. For active sessions, it streams output via WebSockets. If the socket drops (`disconnect` event), the backend tags the user as "offline/away" and queues messages. If an approval is subsequently required, it triggers the native push API to your pre-configured `ntfy.sh` topic to wake up your phone.
   
3. **The Agent Hook**:
   OpenSofa completely replaces fragile screen-scraping by talking directly to the agents (e.g. `opencode serve`) via their native HTTP/SSE APIs. It spawns the agent cleanly and captures structured JSON events, making the system incredibly resilient to terminal quirks.
   
4. **The Frontend (React + Vite PWA)**:
   The user interface is indistinguishable from a native iOS/Android app. It features bottom-tab navigation, offline message queueing (via `idb-keyval`), voice APIs, and Mobile Diff components.

---

## 🎯 Target Audience
Senior developers and tech leads who leverage AI coding agents heavily, but value their time and physical mobility. They want the power of their desktop coding agent (MCPs, Diffs, Repo selection) without being physically anchored to a keyboard.
