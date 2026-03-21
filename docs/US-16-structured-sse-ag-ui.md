# US-16: Structured SSE & AG-UI Integration

## Phase 5: Deprecation of Regex-Based Parser

### Overview

The legacy regex-based event parser has been deprecated in favor of the new AG-UI (Agent-User Interface) structured event system. This document outlines the migration path and deprecation timeline.

### What Changed

**Deprecated (Phase 5):**
- Regex-based permission detection in `permission-classifier.ts`
- String matching for destructive command detection
- Manual event parsing with fragile regex patterns

**New (AG-UI):**
- State machine-based permission detection (`agent-state-machine.ts`)
- Token-based destructive command detection (`destructive-tokens.ts`)
- Structured AG-UI event parsing (`acp-parser.ts`, `mapper.ts`)
- ACP Kind-based activity categorization

### Migration Guide

1. **Permission Detection**: Replace `isPermissionRequest()` regex calls with `AgentStateMachine.isApprovalRequest()` state transitions
2. **Destructive Detection**: Replace regex patterns with `DestructiveTokenDetector` token matching
3. **Event Parsing**: Use `JsonlParser` + `mapAGUIToActivityEvent()` for structured event handling

### Timeline

- Phase 5.0: Regex parser marked deprecated (warnings added)
- Phase 5.1: AG-UI parser becomes default
- Phase 6.0: Regex parser removed entirely

### Benefits

- **Zero regex**: No catastrophic backtracking, predictable performance
- **ACP-first**: Native support for Agent Client Protocol
- **Type-safe**: Full TypeScript coverage with no `any` types
- **Testable**: Pure functions, deterministic behavior
