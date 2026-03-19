# Task Context: AG-UI ACP Architecture Implementation

Session ID: 2026-03-19-ag-ui-acp-implementation
Created: 2026-03-19T00:00:00Z
Status: in_progress (fixes completed, testing remaining)

## Current Request
Implement @docs/AG-UI-ACP-ARCHITECTURE.md - Replace fragile regex-based terminal parsing with structured AG-UI events using AgentAPI's ACP transport.

## Context Files (Standards to Follow)
- docs/AG-UI-ACP-ARCHITECTURE.md - Complete architecture document
- src/web/ag-ui-events.ts - Zod schemas for AG-UI events
- src/web/event-parser/acp-parser.ts - ACP Event Parser
- src/web/event-parser/acp-mapper.ts - ACP → AG-UI mapping
- src/web/event-parser/mapper.ts - AG-UI to ActivityEvent mapper
- src/web/server.ts - Main server file (wire ACP events here)
- src/agent-registry.ts - Add --experimental-acp flag here
- src/web/activity-parser.ts - Delete regex parser from here

## Reference Files (Source Material)
- src/web/event-parser/jsonl-parser.ts - JSONL parser reference
- src/web/agent-adapters/mod.ts - Adapter registry pattern
- src/session-manager.ts - Session spawn logic
- src/web/terminal-stream.ts - Terminal capture (keep)

## Implementation Status

### ✅ COMPLETED (7/10 tasks)
- 01 - Add --experimental-acp flag (agent-registry.ts:293)
- 02 - Create acp-parser.ts (148 lines)
- 03 - Create acp-mapper.ts (97 lines)
- 04 - Wire ACP events in server.ts (lines 578-660)
- 06 - Remove parseTerminalOutput() (activity-parser.ts)
- 07 - Update server.ts regex references (line 209)
- 08 - Update exports in mod.ts

### ✅ CRITICAL FIXES COMPLETED
1. Added `lastToolName` tracking in ACPEventParser (fixes toolName correlation)
2. Added `status_change` handler in server.ts
3. Changed `log.debug` to `log.warn` for parse failures

### 🔄 REMAINING (3 tasks)
- 05 - Test OpenCode with ACP (manual testing required)
- 09 - Verify PTY fallback works (manual testing required)
- 10 - Run E2E tests (tests timeout due to server startup)

### Test Coverage Added
- tests/event-parser/acp-parser.test.ts (21 tests)
- tests/event-parser/acp-mapper.test.ts (24 tests)
- All 726 tests passing ✅

## Exit Criteria
- [x] --experimental-acp flag added to agentapi spawn
- [x] ACP parser correctly parses agentapi /events SSE stream
- [x] ACP mapper transforms events to AG-UI format
- [x] server.ts wires ACP events to activity feed
- [x] parseTerminalOutput deleted from activity-parser.ts
- [ ] OpenCode session produces structured AG-UI events (manual test)
- [ ] Terminal display still works via tmux pipe-pane (manual test)
