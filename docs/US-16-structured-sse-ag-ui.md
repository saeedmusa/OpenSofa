# US-16: Structured SSE Implementation with AG-UI Protocol

## Executive Summary

This document outlines the implementation of structured event streaming for OpenSofa using the AG-UI (Agent-User Interaction) Protocol. This replaces the current regex-based terminal parsing approach with a clean, standardized event stream from agents.

**Current Problem:** ActivityParser relies on fragile regex patterns to scrape ANSI-colored terminal output, causing missed events, incorrectly formatted UI cards, and race conditions in detecting approval requests.

**Solution:** Use native structured JSON events from agents, mapped to AG-UI protocol events for frontend consumption.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [AG-UI Protocol Overview](#2-ag-ui-protocol-overview)
3. [Event Mapping: Agent Events → AG-UI → OpenSofa](#3-event-mapping-agent-events--ag-ui--opensofa)
4. [Detailed Architecture](#4-detailed-architecture)
5. [Implementation Changes](#5-implementation-changes)
6. [Migration Path](#6-migration-path)
7. [Use Case Coverage](#7-use-case-coverage)
8. [Error Handling & Fallbacks](#8-error-handling--fallbacks)
9. [Testing Strategy](#9-testing-strategy)

---

## 1. Current Architecture Analysis

### 1.1 Current Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CURRENT ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐      ┌─────────────┐      ┌─────────────────────────────┐
  │   Agent     │      │  AgentAPI   │      │     OpenSofa Backend       │
  │ (OpenCode,  │      │  (tmux +    │      │                            │
  │  Claude,    │─────▶│  HTTP       │─────▶│  ┌─────────────────────┐  │
  │  Aider...)  │      │  Server)    │      │  │ ActivityParser      │  │
  │             │      │             │      │  │ (REGEX PATTERNS!)  │  │
  └─────────────┘      └─────────────┘      │  └──────────┬──────────┘  │
                                              │             │             │
                                              │   ┌────────▼────────┐   │
                                              │   │ Permission      │   │
                                              │   │ Classifier      │   │
                                              │   │ (REGEX!)        │   │
                                              │   └────────┬────────┘   │
                                              └─────────────┼───────────┘
                                                            │
                                                            ▼
                                              ┌─────────────────────────────┐
                                              │   WebSocket Broadcaster     │
                                              └─────────────┬───────────────┘
                                                            │
                                                            ▼
                                              ┌─────────────────────────────┐
                                              │       PWA Frontend          │
                                              │  ┌───────────────────────┐  │
                                              │  │    ActivityFeed      │  │
                                              │  │  (ActivityCard)     │  │
                                              │  └───────────────────────┘  │
                                              └─────────────────────────────┘
```

### 1.2 Current Issues

| Issue | Description | Impact |
|-------|-------------|--------|
| **Brittle Regex** | 60+ regex patterns across 3 files | Missed events, false positives |
| **Double Parsing** | AgentAPI parses terminal → OpenSofa parses again | Information loss |
| **Agent-Specific** | Different patterns per agent | Hard to maintain |
| **No Structured Data** | Can't distinguish tool input/output | Poor UI cards |
| **Approval Race Conditions** | Timing-dependent regex matching | Missed approval prompts |

### 1.3 Current Files to Replace

| File | Lines | Purpose | New Implementation |
|------|-------|---------|-------------------|
| `src/web/activity-parser.ts` | 334 | Regex parsing | `src/web/ag-ui-event-parser.ts` |
| `src/permission-classifier.ts` | 143 | Approval detection | Removed (use AG-UI events) |
| `src/agent-registry.ts` | ~100 | Agent spawn args | Add JSON flags |

### 1.4 Current Event Types (ActivityEvent)

```typescript
// Current ActivityEvent interface
interface ActivityEvent {
  id: string;
  type: 'agent_message' | 'file_created' | 'file_edited' | 'file_deleted'
     | 'test_result' | 'build_result' | 'approval_needed' | 'error' | 'command_run';
  timestamp: number;
  sessionName: string;
  summary: string;
  icon: string;
  details?: {
    diff?: string;
    command?: string;
    filePath?: string;
    lines?: number;
    testResults?: { file: string; passed: number; failed: number }[];
    errorStack?: string;
  };
  actionable?: boolean;
}
```

---

## 2. AG-UI Protocol Overview

### 2.1 What is AG-UI?

AG-UI (Agent-User Interaction Protocol) is an open, lightweight, event-based protocol that standardizes real-time communication between AI agents and user-facing applications.

**Key Features:**
- 17 defined event types covering full agent lifecycle
- Streaming JSON over SSE or WebSocket
- Framework-agnostic (LangGraph, CrewAI, Mastra, custom)
- Industry adoption growing

### 2.2 AG-UI Event Categories

| Category | Events | Use in OpenSofa |
|----------|--------|-----------------|
| **Lifecycle** | `RunStarted`, `RunFinished`, `RunError`, `StepStarted`, `StepFinished` | Session state, agent phases |
| **Text Message** | `TextMessageStart`, `TextMessageContent`, `TextMessageEnd` | Agent thinking, responses |
| **Tool Call** | `ToolCallStart`, `ToolCallArgs`, `ToolCallEnd`, `ToolCallResult` | File edits, commands |
| **State** | `StateSnapshot`, `StateDelta` | Real-time progress |
| **Special** | `RawEvent`, `CustomEvent` | Fallback, extensions |

### 2.3 AG-UI Event Schemas (Zod)

```typescript
// Core event types (simplified)
type AGUIEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | StepStartedEvent
  | StepFinishedEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | StateSnapshotEvent
  | StateDeltaEvent;

// Example: ToolCallStartEvent
interface ToolCallStartEvent {
  type: 'TOOL_CALL_START';
  runId?: string;
  threadId?: string;
  timestamp: number;
  toolCallId: string;
  toolName: string;
  input?: Record<string, unknown>;
}

// Example: ToolCallResultEvent
interface ToolCallResultEvent {
  type: 'TOOL_CALL_RESULT';
  runId?: string;
  threadId?: string;
  timestamp: number;
  toolCallId: string;
  toolName: string;
  result: {
    output?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  };
}
```

---

## 3. Event Mapping: Agent Events → AG-UI → OpenSofa

### 3.1 OpenCode Events → AG-UI Mapping

OpenCode emits JSONL with these event types:

| OpenCode Event | AG-UI Event | OpenSofa ActivityEvent |
|---------------|--------------|----------------------|
| `step_start` | `StepStarted` | `agent_message` (thinking) |
| `step_finish` | `StepFinished` | Derived from reason |
| `tool_use` | `ToolCallStart` + `ToolCallEnd` | `file_created`, `file_edited`, `command_run` |
| `tool_use.state.output` | `ToolCallResult` | Details in event |
| `text` | `TextMessageContent` | `agent_message` |
| `error` | `RunError` | `error` |

### 3.2 Detailed Mapping Table

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EVENT MAPPING FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────┘

  OpenCode JSON              AG-UI Protocol              OpenSofa UI
  ─────────────             ─────────────               ────────────

  {"type":"step_start",    StepStartedEvent          ActivityEvent
   "part":{                  ─────────────────         ─────────────
    "type":"step-start",    type: "STEP_START"       type: "agent_message"
    "id":"prt_xxx",         stepId: "prt_xxx"        summary: "Thinking..."
    "messageID":"msg_xxx"                          icon: "🤔"
   }                       }
  }

  ───────────────────────────────────────────────────────────────────────────

  {"type":"tool_use",      ToolCallStartEvent         ActivityEvent
   "part":{                ─────────────────          ─────────────
    "tool":"Edit",         type: "TOOL_CALL_START"   type: "file_edited"
    "state":{              toolCallId: "call_xxx"    summary: "Edited src/main.ts"
     "input":{             toolName: "Edit"          icon: "✏️"
      "filePath":"..."     input: {filePath:...}     details: {filePath, diff}
     }                                             actionable: false
   }
  }

  {"type":"tool_use",      ToolCallResultEvent        ActivityEvent
   "part":{                ─────────────────          ─────────────
    "state":{              type: "TOOL_CALL_RESULT"  type: "file_edited"
     "output":"...",       toolCallId: "call_xxx"    summary: "Edited src/main.ts"
     "status":"completed"  result: {output:"..."}    icon: "✏️"
   }                        }
  }

  ───────────────────────────────────────────────────────────────────────────

  {"type":"text",          TextMessageContentEvent    ActivityEvent
   "part":{                ─────────────────────────  ─────────────
    "type":"text",         type: "TEXT_MESSAGE_       type: "agent_message"
    "text":"I'll create..."  CONTENT"               summary: "I'll create..."
   }                       delta: "I'll create..."    icon: "💬"
                          }

  ───────────────────────────────────────────────────────────────────────────

  {"type":"error",         RunErrorEvent              ActivityEvent
   "error":{              ─────────────              ─────────────
    "name":"APIError",    type: "RUN_ERROR"         type: "error"
    "data":{              error: {name, message}    summary: "Rate limit exceeded"
     "message":"Rate..."                          icon: "🔴"
   }                       }                          details: {errorStack}
  }

  ───────────────────────────────────────────────────────────────────────────

  (Approval prompts are embedded in tool_use with special status)

  {"type":"tool_use",     ToolCallStartEvent          ActivityEvent
   "part":{                ─────────────────          ─────────────
    "tool":"bash",        type: "TOOL_CALL_START"   type: "approval_needed"
    "state":{             toolName: "Bash"         summary: "Run: rm -rf /"
     "input":{            input: {command:...}     icon: "⚠️"
      "command":"..."                                actionable: true
     },
     "status":"pending_approval"
   }
  }
```

### 3.3 Agent-Specific Mapping Adapters

Each agent requires a specific adapter to normalize to AG-UI:

```typescript
// src/web/adapters/opencode-adapter.ts
interface AgentAdapter {
  // Parse raw agent output to AG-UI events
  parse(raw: string): AGUIEvent[];
  
  // Check if output contains approval request
  isApprovalRequest(event: AGUIEvent): boolean;
  
  // Extract command from approval event
  extractApprovalCommand(event: AGUIEvent): string | null;
}

// Implemented per agent:
// - OpenCodeAdapter (--format json)
// - ClaudeAdapter (--print --output-format=stream-json)
// - GeminiAdapter (--output-format stream-json)
// - AiderAdapter (--json)
// - FallbackAdapter (regex - deprecated)
```

---

## 4. Detailed Architecture

### 4.1 New Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEW ARCHITECTURE                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐
  │   Agent     │      ┌─────────────────────────────────────────────────────┐
  │ (OpenCode,  │      │              OpenSofa Backend                       │
  │  Claude,    │      │                                                          │
  │  Aider...)  │      │  ┌──────────────────────────────────────────────┐   │
  │             │      │  │         Agent Spawner (agent-registry)       │   │
  │ --format    │      │  │  • Spawns agent with JSON flags             │   │
  │  json       │─────▶│  │  • Captures stdout directly                 │   │
  └─────────────┘      │  └──────────────────────────────────────────────┘   │
                       │                         │                              │
                       │                         ▼                              │
                       │  ┌──────────────────────────────────────────────┐    │
                       │  │       AG-UI Event Parser Layer             │    │
                       │  │  ┌────────────────────────────────────┐    │    │
                       │  │  │    Adapter Registry                │    │    │
                       │  │  │  • opencode-adapter               │    │    │
                       │  │  │  • claude-adapter                 │    │    │
                       │  │  │  • gemini-adapter                 │    │    │
                       │  │  │  • aider-adapter                  │    │    │
                       │  │  └────────────────────────────────────┘    │    │
                       │  │                    │                         │    │
                       │  │                    ▼                         │    │
                       │  │  ┌────────────────────────────────────┐    │    │
                       │  │  │    AG-UI Event Normalizer         │    │    │
                       │  │  │  • Validates Zod schemas          │    │    │
                       │  │  │  • Maps to OpenSofa events        │    │    │
                       │  │  │  • Handles fallbacks              │    │    │
                       │  │  └────────────────────────────────────┘    │    │
                       │  └──────────────────────────────────────────────┘   │
                       │                         │                              │
                       │                         ▼                              │
                       │  ┌──────────────────────────────────────────────┐    │
                       │  │         AG-UI Event Emitter                 │    │
                       │  │  • Broadcasts via WebSocket                 │    │
                       │  │  • Stores to SQLite (US-13)                │    │
                       │  │  • Push notifications                       │    │
                       │  └──────────────────────────────────────────────┘   │
                       └───────────────────────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         PWA Frontend                                    │
  │  ┌─────────────────────────────────────────────────────────────────┐  │
  │  │                    AG-UI Client Layer                            │  │
  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │  │
  │  │  │ ActivityFeed   │  │ TerminalView    │  │ StateSync      │  │  │
  │  │  │ (Cards)        │  │ (Raw output)   │  │ (Progress)     │  │  │
  │  │  └─────────────────┘  └─────────────────┘  └────────────────┘  │  │
  │  └─────────────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 New File Structure

```
src/
├── web/
│   ├── ag-ui-events.ts           # NEW: Zod schemas for AG-UI events
│   ├── agent-adapters/
│   │   ├── mod.ts               # NEW: Adapter registry
│   │   ├── opencode-adapter.ts  # NEW: OpenCode → AG-UI
│   │   ├── claude-adapter.ts    # NEW: Claude → AG-UI
│   │   ├── gemini-adapter.ts    # NEW: Gemini → AG-UI
│   │   └── aider-adapter.ts     # NEW: Aider → AG-UI
│   ├── event-parser/
│   │   ├── mod.ts               # NEW: Parser entry point
│   │   ├── jsonl-parser.ts      # NEW: Parse JSONL lines
│   │   ├── validator.ts         # NEW: Zod validation
│   │   └── mapper.ts            # NEW: AG-UI → OpenSofa mapping
│   ├── activity-parser.ts        # MODIFIED: Keep for backward compat (deprecated)
│   ├── ag-ui-emitter.ts         # NEW: Broadcast events
│   └── terminal-stream.ts       # MODIFIED: Support dual mode
│
├── agent-registry.ts             # MODIFIED: Add JSON flags
├── permission-classifier.ts      # DELETED: Replaced by adapter
└── session-manager.ts            # MODIFIED: Wire new parser
```

### 4.3 Key Classes/Modules

```typescript
// src/web/ag-ui-events.ts

// AG-UI Event Schemas (Zod)
export const RunStartedEventSchema = z.object({
  type: z.literal('RUN_STARTED'),
  runId: z.string().optional(),
  threadId: z.string().optional(),
  timestamp: z.number(),
});

export const StepStartedEventSchema = z.object({
  type: z.literal('STEP_STARTED'),
  runId: z.string().optional(),
  threadId: z.string().optional(),
  timestamp: z.number(),
  stepId: z.string(),
  stepName: z.string().optional(),
});

export const ToolCallStartEventSchema = z.object({
  type: z.literal('TOOL_CALL_START'),
  runId: z.string().optional(),
  threadId: z.string().optional(),
  timestamp: z.number(),
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.record(z.unknown()).optional(),
});

export const ToolCallResultEventSchema = z.object({
  type: z.literal('TOOL_CALL_RESULT'),
  runId: z.string().optional(),
  threadId: z.string().optional(),
  timestamp: z.number(),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.object({
    output: z.string().optional(),
    error: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

// ... etc for all AG-UI events

// Union type
export const AGUIEventSchema = z.discriminatedUnion('type', [
  RunStartedEventSchema,
  RunFinishedEventSchema,
  RunErrorEventSchema,
  StepStartedEventSchema,
  StepFinishedEventSchema,
  TextMessageStartEventSchema,
  TextMessageContentEventSchema,
  TextMessageEndEventSchema,
  ToolCallStartEventSchema,
  ToolCallArgsEventSchema,
  ToolCallEndEventSchema,
  ToolCallResultEventSchema,
  StateSnapshotEventSchema,
  StateDeltaEventSchema,
  RawEventSchema,
]);

export type AGUIEvent = z.infer<typeof AGUIEventSchema>;
```

```typescript
// src/web/event-parser/jsonl-parser.ts

export class JsonlParser {
  private buffer: string = '';
  
  /**
   * Parse JSONL (newline-delimited JSON) from agent stdout
   * Each line is a complete JSON object
   */
  feed(chunk: string): AGUIEvent[] {
    this.buffer += chunk;
    const events: AGUIEvent[] = [];
    
    // Split by newlines, keeping incomplete lines in buffer
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const parsed = JSON.parse(line);
        const result = AGUIEventSchema.safeParse(parsed);
        
        if (result.success) {
          events.push(result.data);
        } else {
          // Try agent-specific schemas
          const agentEvent = this.tryParseAgentEvent(parsed);
          if (agentEvent) {
            events.push(agentEvent);
          } else {
            log.warn('Invalid event schema', { 
              error: result.error, 
              line: line.slice(0, 100) 
            });
          }
        }
      } catch (e) {
        // Not valid JSON - wrap as RawEvent
        events.push({
          type: 'RAW',
          timestamp: Date.now(),
          event: { raw: line },
        });
      }
    }
    
    return events;
  }
  
  private tryParseAgentEvent(parsed: unknown): AGUIEvent | null {
    // Try OpenCode events
    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
      const obj = parsed as { type: string };
      
      // OpenCode event mapping
      if (obj.type === 'step_start') {
        return mapOpenCodeStepStart(parsed);
      }
      if (obj.type === 'tool_use') {
        return mapOpenCodeToolUse(parsed);
      }
      if (obj.type === 'text') {
        return mapOpenCodeText(parsed);
      }
      if (obj.type === 'step_finish') {
        return mapOpenCodeStepFinish(parsed);
      }
      if (obj.type === 'error') {
        return mapOpenCodeError(parsed);
      }
    }
    return null;
  }
}
```

```typescript
// src/web/event-parser/mapper.ts

/**
 * Maps AG-UI events to OpenSofa ActivityEvent
 */
export function mapAGUIToActivityEvent(aguiEvent: AGUIEvent, sessionName: string): ActivityEvent {
  switch (aguiEvent.type) {
    case 'STEP_STARTED':
      return {
        id: generateId(),
        type: 'agent_message',
        timestamp: aguiEvent.timestamp,
        sessionName,
        summary: `Step: ${aguiEvent.stepName || aguiEvent.stepId}`,
        icon: '🤔',
      };
      
    case 'TOOL_CALL_START':
      return mapToolCallToActivity(aguiEvent, sessionName);
      
    case 'TOOL_CALL_RESULT':
      return mapToolResultToActivity(aguiEvent, sessionName);
      
    case 'TEXT_MESSAGE_CONTENT':
      return {
        id: generateId(),
        type: 'agent_message',
        timestamp: aguiEvent.timestamp,
        sessionName,
        summary: aguiEvent.delta.slice(0, 100),
        icon: '💬',
      };
      
    case 'RUN_ERROR':
      return {
        id: generateId(),
        type: 'error',
        timestamp: aguiEvent.timestamp,
        sessionName,
        summary: aguiEvent.error.message?.slice(0, 100) || 'Unknown error',
        icon: '🔴',
        details: { errorStack: aguiEvent.error.message },
      };
      
    // ... etc
  }
}

function mapToolCallToActivity(event: ToolCallStartEvent, sessionName: string): ActivityEvent {
  const tool = event.toolName.toLowerCase();
  
  if (tool === 'bash' || tool === 'shell' || tool === 'command') {
    const cmd = (event.input?.command as string) || (event.input?.cmd as string);
    return {
      id: generateId(),
      type: 'command_run',
      timestamp: event.timestamp,
      sessionName,
      summary: `Running: ${cmd?.slice(0, 50) || 'command'}`,
      icon: '⚡',
      details: { command: cmd },
    };
  }
  
  if (tool === 'write' || tool === 'create' || tool === 'new_file') {
    return {
      id: generateId(),
      type: 'file_created',
      timestamp: event.timestamp,
      sessionName,
      summary: `Creating: ${event.input?.file_path || event.input?.path || 'file'}`,
      icon: '📄',
      details: { filePath: event.input?.file_path as string },
    };
  }
  
  if (tool === 'edit' || tool === 'replace' || tool === 'modify') {
    return {
      id: generateId(),
      type: 'file_edited',
      timestamp: event.timestamp,
      sessionName,
      summary: `Editing: ${event.input?.file_path || event.input?.path || 'file'}`,
      icon: '✏️',
      details: { filePath: event.input?.file_path as string },
    };
  }
  
  // Default fallback
  return {
    id: generateId(),
    type: 'command_run',
    timestamp: event.timestamp,
    sessionName,
    summary: `Tool: ${event.toolName}`,
    icon: '🔧',
  };
}
```

### 4.4 Data Flow

```
Agent stdout
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  SessionManager.spawnAgent()                              │
│  • Spawns agent with --format json (or equivalent)       │
│  • Captures stdout via child_process.spawn()              │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  AgentEventParser.feed(chunk)                              │
│  • Receives stdout chunks                                 │
│  • Parses JSONL lines                                     │
│  • Validates against Zod schemas                          │
│  • Converts to AG-UI events                               │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  EventMapper.mapToActivityEvent()                          │
│  • Maps AG-UI events → OpenSofa ActivityEvent             │
│  • Enriches with tool-specific details                     │
│  • Handles approval detection via event.type               │
└────────────────────────────────────────────────────────────┘
    │
    ├──▶ (Real-time) WebSocket broadcast
    │       │
    │       ▼
    │       PWA receives 'activity' event
    │       ActivityFeed renders ActivityCard
    │
    └──▶ (Persistence) SQLite storage (US-13)
            │
            ▼
            Events stored with sessionId, timestamp
```

---

## 5. Implementation Changes

### 5.1 Agent Registry Changes

**File:** `src/agent-registry.ts`

```typescript
// Current
buildSpawnArgs(type, port, model): string[] {
  return [
    'server',
    `--port=${port}`,
    `--type=${def.agentApiType}`,
    '--',
    def.binary,
  ];
}

// New
buildSpawnArgs(type, port, model, options?: { jsonStream?: boolean }): {
  args: string[];
  env: Record<string, string>;
} {
  const args: string[] = [];
  const env: Record<string, string> = {};
  
  // Check if agent supports native JSON output
  const jsonFlags = getJsonOutputFlags(type);
  
  if (options?.jsonStream && jsonFlags) {
    // Direct mode: spawn agent with JSON flags, NO AgentAPI
    args.push(...jsonFlags);
    args.push('--');
    args.push(def.binary);
    // Add model if needed
    if (model && def.modelFlag) {
      args.push(def.modelFlag, model);
    }
    return { args, env };
  }
  
  // Fallback: use AgentAPI
  return {
    args: [
      'server',
      `--port=${port}`,
      `--type=${def.agentApiType}`,
      '--',
      def.binary,
    ],
    env: {},
  };
}

function getJsonOutputFlags(agentType: AgentType): string[] | null {
  switch (agentType) {
    case 'opencode':
      return ['run', '--format', 'json'];
    case 'claude':
      return ['--print', '--output-format=stream-json', '--verbose'];
    case 'gemini':
      return ['--output-format', 'stream-json'];
    case 'aider':
      return ['--json'];
    default:
      return null; // Use AgentAPI fallback
  }
}
```

### 5.2 Session Manager Changes

**File:** `src/session-manager.ts`

```typescript
// New: spawnAgent with JSON mode
private async spawnAgentWithJsonStream(
  port: number,
  agent: AgentType,
  model: string,
  workDir: string
): Promise<number> {
  const jsonFlags = this.agentRegistry.getJsonOutputFlags(agent);
  
  if (!jsonFlags) {
    // Fall back to AgentAPI
    return this.spawnAgentAPI(port, agent, model, workDir);
  }
  
  // Direct spawn with JSON output
  return this.spawnAgentDirect(port, agent, model, workDir, jsonFlags);
}

private async spawnAgentDirect(
  port: number,
  agent: AgentType,
  model: string,
  workDir: string,
  jsonFlags: string[]
): Promise<number> {
  const agentDef = this.agentRegistry.getDefinition(agent);
  const cmd = agentDef.binary;
  
  // Spawn directly, capture stdout
  const proc = spawn(cmd, jsonFlags, {
    cwd: workDir,
    stdio: ['pipe', 'pipe', 'pipe'], // capture stdout
    env: getEnrichedEnv({}),
  });
  
  // Wire up event parser
  const parser = new JsonlParser();
  
  proc.stdout?.on('data', (chunk: Buffer) => {
    const events = parser.feed(chunk.toString());
    for (const event of events) {
      const activityEvent = mapAGUIToActivityEvent(event, sessionName);
      this.emit('agent:event', activityEvent);
    }
  });
  
  proc.stderr?.on('data', (chunk: Buffer) => {
    // Handle stderr as raw output
    this.emit('agent:raw', chunk.toString());
  });
  
  proc.on('exit', (code) => {
    this.emit('agent:exit', code);
  });
  
  return proc.pid || 0;
}
```

### 5.3 Server Changes

**File:** `src/web/server.ts`

```typescript
// Current (connects to AgentAPI SSE)
const parser = new ActivityParser(
  session.name,
  session.agentType,
  client.listenEvents() as any,
  (events) => { /* broadcast */ }
);

// New (connects to internal event stream)
const parser = new AgentEventParser(
  session.name,
  session.agentType,
  sessionManager.getEventStream(session.name), // Internal stream
  (events) => {
    broadcaster.broadcast(createEvent('activity', {
      sessionName: session.name,
      events,
    }, session.name));
  }
);
```

### 5.4 Frontend Changes

**File:** `src/web/frontend/src/types/index.ts`

```typescript
// Keep ActivityEvent for backward compatibility
// but add AG-UI event types for advanced usage

export interface ActivityEvent {
  id: string;
  type: 'agent_message' | 'file_created' | 'file_edited' | 'file_deleted'
     | 'test_result' | 'build_result' | 'approval_needed' | 'error' | 'command_run';
  timestamp: number;
  sessionName: string;
  summary: string;
  icon: string;
  details?: {
    diff?: string;
    command?: string;
    filePath?: string;
    errorStack?: string;
    // NEW: Enriched from AG-UI
    toolCallId?: string;
    input?: Record<string, unknown>;
    output?: string;
  };
  actionable?: boolean;
}
```

---

## 6. Migration Path

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create `src/web/ag-ui-events.ts` with Zod schemas
- [ ] Create `src/web/event-parser/jsonl-parser.ts`
- [ ] Create `src/web/event-parser/mapper.ts`
- [ ] Create adapter registry

### Phase 2: OpenCode Adapter (Week 2)
- [ ] Create `src/web/agent-adapters/opencode-adapter.ts`
- [ ] Test with OpenCode `--format json`
- [ ] Verify event mapping accuracy

### Phase 3: Backend Integration (Week 2-3)
- [ ] Modify `agent-registry.ts` to support JSON flags
- [ ] Modify `session-manager.ts` to use direct spawn
- [ ] Wire up event parser in `server.ts`
- [ ] Remove AgentAPI dependency for OpenCode

### Phase 4: Additional Agents (Week 3-4)
- [ ] Add Claude adapter
- [ ] Add Gemini adapter
- [ ] Add Aider adapter

### Phase 5: Deprecation (Week 4+)
- [ ] Mark regex parser as deprecated
- [ ] Add warning logs when using fallback
- [ ] Eventually remove regex parser

---

## 7. Use Case Coverage

### 7.1 Current Use Cases → AG-UI Mapping

| Use Case | Current Implementation | AG-UI Solution |
|----------|----------------------|----------------|
| **Agent Thinking** | Regex: `/(I'll|I will|I'm going to)/` | `StepStarted` → `TextMessageContent` |
| **File Created** | Regex: `/(Created|created)/` | `ToolCallStart` (tool: write) + `ToolCallResult` |
| **File Edited** | Regex: `/(Edited|modified)/` | `ToolCallStart` (tool: edit) + `ToolCallResult` |
| **File Deleted** | Regex: `/(Deleted|removed)/` | `ToolCallStart` (tool: delete) |
| **Command Running** | Regex: `/(Running|Executing)/` | `ToolCallStart` (tool: bash) |
| **Test Results** | Regex: `/(PASS|FAIL|passed|failed)/` | `ToolCallResult` from test tool |
| **Build Results** | Regex: `/(Build succeeded|failed)/` | `ToolCallResult` from build tool |
| **Approval Needed** | PermissionClassifier regex | `ToolCallStart` with pending_approval status |
| **Errors** | Regex: `/(Error|ERROR)/` | `RunError` event |
| **Terminal Output** | tmux pipe-pane | RawEvent or parallel stream |

### 7.2 New Capabilities

| Capability | Description |
|------------|-------------|
| **Tool Input Details** | See exact parameters passed to tools |
| **Tool Output** | Capture command output, file contents |
| **Timing** | Precise timestamps from agent |
| **Token Usage** | From `step_finish` events |
| **Cost Tracking** | From `step_finish` events |
| **Approval Context** | Full command details, not just regex match |

---

## 8. Error Handling & Fallbacks

### 8.1 Error Types

| Error Type | Cause | Handling |
|------------|-------|----------|
| **Invalid JSON** | Malformed output from agent | Wrap in `RawEvent` |
| **Unknown Event** | New agent event type | Log warning, emit as `RawEvent` |
| **Agent Crash** | Process exits unexpectedly | Emit `RunError`, fallback to regex |
| **Adapter Missing** | Agent without adapter | Fall back to AgentAPI + regex |

### 8.2 Fallback Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    FALLBACK STRATEGY                        │
└─────────────────────────────────────────────────────────────┘

  Agent Output
       │
       ▼
┌─────────────────┐
│ Try JSON parse  │── Success ──▶ Process as AG-UI event
└────────┬────────┘
         │ Fail
         ▼
┌─────────────────┐
│ Agent adapter   │── Success ──▶ Map to AG-UI event
│ exists?         │
└────────┬────────┘
         │ No
         ▼
┌─────────────────┐
│ AgentAPI        │── Success ──▶ Use AgentAPI events + regex
│ available?      │
└────────┬────────┘
         │ No
         ▼
┌─────────────────┐
│ Raw output      │── Always ──▶ Emit as RawEvent to terminal
└─────────────────┘
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Module | Tests |
|--------|-------|
| `ag-ui-events.ts` | Zod schema validation |
| `jsonl-parser.ts` | Parse valid/invalid JSONL, buffer handling |
| `mapper.ts` | Map all AG-UI types to ActivityEvent |
| `opencode-adapter.ts` | Map OpenCode events to AG-UI |

### 9.2 Integration Tests

| Test | Description |
|------|-------------|
| `test:e2e:opencode` | Full flow with OpenCode |
| `test:e2e:claude` | Full flow with Claude |
| `test:e2e:fallback` | Test AgentAPI fallback |

### 9.3 Event Accuracy Tests

```typescript
// Example: Verify tool call mapping accuracy
test('maps OpenCode tool_use to correct ActivityEvent type', () => {
  const opencodeEvent = {
    type: 'tool_use',
    part: {
      tool: 'Edit',
      state: {
        input: { file_path: 'src/main.ts', diff: '...' },
        status: 'completed',
      }
    }
  };
  
  const adapter = new OpenCodeAdapter();
  const agui = adapter.parse(JSON.stringify(opencodeEvent));
  const activity = mapAGUIToActivityEvent(agui[0], 'test-session');
  
  expect(activity.type).toBe('file_edited');
  expect(activity.details.filePath).toBe('src/main.ts');
});
```

---

## Appendix A: Configuration

### A.1 Environment Variables

```bash
# Enable/disable JSON stream mode
OPENSofa_USE_JSON_STREAM=true

# Fallback to AgentAPI for unsupported agents
OPENSofa_FALLBACK_TO_AGENTAPI=true

# Log unmapped events
OPENSofa_LOG_UNMAPPED_EVENTS=true
```

### A.2 Agent Flags Reference

| Agent | JSON Flag | Stream Flag |
|-------|-----------|-------------|
| OpenCode | `--format json` | N/A (JSONL) |
| Claude | `--print` | `--output-format stream-json` |
| Gemini | `--output-format` | `stream-json` |
| Aider | `--json` | N/A |

---

## Appendix B: Related User Stories

| US | Title | Relation |
|----|-------|----------|
| US-13 | SQLite Event Persistence | Store events in SQLite |
| US-17 | Push Notifications | Notify on approval needed |
| US-18 | Real-time Diff Updates | Show diffs in ActivityCard |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-15 | OpenSofa Team | Initial document |
