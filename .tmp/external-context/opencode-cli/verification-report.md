---
source: Web Research
library: OpenCode CLI
package: opencode-ai
topic: CLI capabilities verification
fetched: 2026-02-21T12:00:00Z
official_docs: https://opencode.ai/docs/
---

# OpenCode CLI Verification Report

## Summary

Verified the existence and capabilities of the OpenCode CLI tool against claims made in architecture documentation.

---

## 1. Does OpenCode CLI Actually Exist?

### ✅ VERIFIED - YES

**Evidence:**
- **Official Website**: https://opencode.ai - Active and maintained
- **GitHub Repository**: 
  - Original: `github.com/opencode-ai/opencode` (archived Sep 2025, moved to "Crush")
  - Current: `github.com/anomalyco/opencode` (active fork by Anomaly)
- **NPM Package**: `opencode-ai` available
- **Homebrew**: `brew install anomalyco/tap/opencode`
- **Download Stats**: Claims 100K GitHub stars, 2.5M monthly developers

**Installation Methods:**
```bash
# Install script
curl -fsSL https://opencode.ai/install | bash

# NPM
npm install -g opencode-ai

# Homebrew
brew install anomalyco/tap/opencode

# Arch Linux
paru -S opencode-bin
```

**Note:** The original `opencode-ai/opencode` repo was archived and rebranded as "Crush" by Charmbracelet, but the opencode.ai domain and `anomalyco/opencode` fork continue active development.

---

## 2. Does it Have a `serve` Command with HTTP/SSE API?

### ✅ VERIFIED - YES

**CLI Command:**
```bash
opencode serve [--port <number>] [--hostname <string>] [--mdns] [--cors <origin>]
```

**Default Settings:**
- Port: 4096
- Hostname: 127.0.0.1

**SSE Endpoints:**
| Endpoint | Description |
|----------|-------------|
| `GET /global/event` | Global SSE event stream |
| `GET /event` | Server-sent events stream |

**Full HTTP API Includes:**
- `/global/health` - Health check
- `/project`, `/project/current` - Project management
- `/session` - Session CRUD operations
- `/session/:id/message` - Send/receive messages
- `/file`, `/file/content` - File operations
- `/find`, `/find/file`, `/find/symbol` - Search
- `/provider`, `/auth/:id` - Provider management
- `/mcp`, `/lsp`, `/formatter` - Tool integrations
- `/agent` - Agent management
- `/tui/*` - TUI control endpoints
- `/doc` - OpenAPI 3.1 spec

**Authentication:**
Set `OPENCODE_SERVER_PASSWORD` for HTTP basic auth (username defaults to `opencode`)

---

## 3. Does it Support `--model`, `--agent`, `--continue`, `--fork` Flags?

### ✅ VERIFIED - YES (All Four)

**TUI Mode Flags:**
```bash
opencode [project] [options]

Options:
  --continue, -c    Continue the last session
  --session, -s     Session ID to continue
  --fork           Fork the session when continuing (use with --continue or --session)
  --prompt         Prompt to use
  --model, -m      Model to use in the form of provider/model
  --agent          Agent to use
  --port           Port to listen on
  --hostname       Hostname to listen on
```

**Run Command Flags:**
```bash
opencode run [message..] [options]

Options:
  --continue, -c    Continue the last session
  --session, -s     Session ID to continue
  --fork           Fork the session when continuing
  --model, -m      Model to use (provider/model format)
  --agent          Agent to use
  --file, -f       File(s) to attach
  --format         Output format (default/json)
  --attach         Attach to running server
```

**Example Usage:**
```bash
# Continue last session with specific model
opencode --continue --model anthropic/claude-sonnet-4

# Fork and continue a session
opencode --session abc123 --fork

# Run with specific agent
opencode run --agent coder "Fix the bug"
```

---

## 4. What Providers Does it Actually Support?

### ✅ VERIFIED - 75+ Providers

**Provider Categories:**

### Major Cloud Providers
- **OpenAI**: GPT-4o, GPT-4.1, O1, O3, O4-Mini
- **Anthropic**: Claude 4, Claude 3.5/3.7 Sonnet/Haiku/Opus
- **Google**: Gemini 2.5, Gemini 2.0 Flash
- **Amazon Bedrock**: Claude models via AWS
- **Azure OpenAI**: All OpenAI models via Azure
- **Google Vertex AI**: Gemini via GCP

### Subscription-Based
- **GitHub Copilot**: Uses existing Copilot subscription
- **ChatGPT Plus/Pro**: Uses existing OpenAI subscription
- **Claude Pro/Max**: Uses existing Anthropic subscription
- **GitLab Duo**: GitLab's AI assistant

### AI Startups
- **xAI**: Grok models
- **DeepSeek**: DeepSeek Reasoner, DeepSeek Chat
- **Groq**: Llama models with fast inference
- **Cerebras**: Qwen 3 Coder 480B
- **Together AI**: Various open models
- **Fireworks AI**: Kimi K2, etc.
- **Moonshot AI**: Kimi K2

### Local/Self-Hosted
- **Ollama**: Local models
- **LM Studio**: Local models
- **llama.cpp**: Self-hosted via llama-server

### Aggregators/Gateways
- **OpenRouter**: Access to many providers
- **OpenCode Zen**: Curated models by OpenCode team
- **Helicone**: AI Gateway with observability
- **Vercel AI Gateway**: Unified endpoint
- **Cloudflare AI Gateway**: Unified endpoint with billing

### Others
- 302.AI, Baseten, Cortecs, Deep Infra, Firmware, Hugging Face, IO.NET, MiniMax, Nebius, OVHcloud, Scaleway, STACKIT, Venice AI, Z.AI, ZenMux

---

## 5. Is There Official Documentation?

### ✅ VERIFIED - YES

**Official Docs URL**: https://opencode.ai/docs/

**Documentation Structure:**
- **Intro**: Installation, configuration, initialization
- **Usage**: TUI, CLI, Web, IDE, Share, GitHub, GitLab
- **Configure**: Tools, Rules, Agents, Models, Themes, Keybinds, Commands, Formatters, Permissions, LSP Servers, MCP servers, ACP Support, Skills, Custom Tools
- **Develop**: SDK, Server, Plugins, Ecosystem

**Key Documentation Pages:**
- CLI Reference: https://opencode.ai/docs/cli/
- Server API: https://opencode.ai/docs/server/
- Providers: https://opencode.ai/docs/providers/
- Configuration: https://opencode.ai/docs/config/
- SDK: https://opencode.ai/docs/sdk/

---

## Conclusion

| Claim | Status | Notes |
|-------|--------|-------|
| OpenCode CLI exists | ✅ Verified | Active development, multiple install methods |
| `serve` command with HTTP/SSE | ✅ Verified | Full REST API + SSE endpoints |
| `--model` flag | ✅ Verified | Provider/model format |
| `--agent` flag | ✅ Verified | Custom agent support |
| `--continue` flag | ✅ Verified | Session continuation |
| `--fork` flag | ✅ Verified | Fork sessions on continue |
| 75+ providers | ✅ Verified | Comprehensive provider list |
| Official documentation | ✅ Verified | Full docs at opencode.ai/docs |

**All claims in the architecture documentation appear to be accurate and verifiable against official sources.**
