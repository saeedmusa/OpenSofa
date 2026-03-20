# Task Context: Unified Model Discovery API

Session ID: 2026-03-19-unified-model-discovery
Created: 2026-03-19T00:00:00.000Z
Status: in_progress

## Subtask 06: Frontend API Integration for Model Discovery

## Current Request
Implement a unified model discovery system that allows the OpenSofa PWA to access and use models from all coding agents (OpenCode, Claude Code, Codex, etc.) installed on the laptop, using their existing API keys and configurations.

## Context Files (Standards to Follow)
- No standard context directory found. Project conventions from existing code.

## Reference Files (Source Material to Look At)
- src/agent-registry.ts - Existing agent definitions and patterns
- src/types.ts - Type definitions (AgentType, Session, etc.)
- src/agentapi-client.ts - AgentAPI client pattern
- src/web/routes/opencode-models.ts - Existing OpenCode model discovery
- src/web/frontend/src/components/NewSessionModal.tsx - Existing UI
- src/session-manager.ts - Session creation logic
- src/utils/logger.ts - Logger pattern
- src/utils/expand-path.ts - Path utilities

## External Docs Fetched
- OpenCode has `opencode models` and `opencode auth list` commands
- Claude Code uses Z.AI provider with GLM models
- AgentAPI spawns agents with --model flag

## Components
1. Model Discovery Infrastructure (interfaces, base adapter, registry)
2. OpenCode Adapter (opencode models + auth list)
3. Claude Code Adapter (parse ~/.claude/settings.json)
4. Unified Discovery Endpoint (/api/models/discover)
5. Frontend Model Selector (grouped dropdown UI)
6. Frontend API Integration
7. Testing
8. Code Review

## Constraints
- API keys must NEVER leave the laptop
- Must work with existing agent configurations
- Must be extensible for future agents
- Must handle errors gracefully

## Exit Criteria
- [ ] GET /api/models/discover returns models grouped by provider
- [ ] OpenCode models discoverable via opencode models
- [ ] Claude Code models discoverable via settings.json parsing
- [ ] Frontend shows model selector grouped by provider
- [ ] Session creation works with selected model
- [ ] Tests pass for adapters and endpoint
- [ ] Code reviewed and approved
