/**
 * OpenSofa - Shared TypeScript Interfaces
 * 
 * All types used across multiple components. Single source of truth.
 * Based on LOW_LEVEL_DESIGN.md §2
 */

// ──────────────────────────────────────
// Session Types
// ──────────────────────────────────────

export type SessionStatus = 'creating' | 'active' | 'stopping' | 'stopped' | 'error';

export type AgentType = 
  | 'claude' 
  | 'aider' 
  | 'goose' 
  | 'gemini' 
  | 'codex' 
  | 'amp' 
  | 'opencode' 
  | 'copilot' 
  | 'cursor' 
  | 'auggie' 
  | 'amazonq' 
  | 'custom';

export interface Session {
  name: string;                    // user-chosen label, e.g. "frontend"
  status: SessionStatus;
  agentType: AgentType;
  model: string;                   // model identifier (e.g. "sonnet", "gpt-4o") or '' for agent default
  port: number;                    // AgentAPI port (3284+N)
  pid: number;                     // AgentAPI child process PID
  repoDir: string;                 // original repo path (e.g. "~/projects/myapp")
  workDir: string;                 // worktree path (e.g. "~/projects/myapp-frontend")
  branch: string;                  // git branch name (e.g. "feat/frontend")
  createdAt: number;               // Date.now() timestamp
  lastActivityAt: number;          // updated on every user message or agent event
  agentStatus: 'stable' | 'running' | 'awaiting_human_input'; // last known AgentAPI status (or waiting for approval)
  transport?: 'acp' | 'pty';  // transport type from agentapi (set after connection)
  feedbackController: IFeedbackController | null;  // not serialized
  autoApprove: boolean;            // per-session auto-approve setting
  screenshotsEnabled: boolean;     // per-session screenshot setting
  pendingApproval?: {
    detectedAt: number;
    command: string | null;
    timeoutId?: NodeJS.Timeout;
  }; // runtime-only approval state
}

// ──────────────────────────────────────
// AgentAPI Types (from openapi.json)
// ──────────────────────────────────────

export interface AgentAPIMessage {
  id: number;
  content: string;
  role: 'agent' | 'user';
  time: string;                    // ISO 8601
}

export interface AgentAPIMessageRequest {
  content: string;
  type: 'user' | 'raw';
}

export interface AgentAPIMessageResponse {
  ok: boolean;
}

export interface AgentAPIStatusResponse {
  agent_type: string;
  status: 'stable' | 'running';
}

export interface AgentAPIUploadResponse {
  filePath: string;
  ok: boolean;
}

// SSE event payloads
export interface SSEMessageUpdate {
  id: number;
  message: string;                 // note: "message" not "content"
  role: 'agent' | 'user';
  time: string;
}

export interface SSEStatusChange {
  agent_type: string;
  status: 'stable' | 'running';
}

// ──────────────────────────────────────
// Feedback / Delivery
// ──────────────────────────────────────

export type EventPriority = 'p0' | 'p1' | 'p2';
// p0 = immediate (approval requests, errors, status → stable)
// p1 = normal (agent text output)
// p2 = low (intermediate updates during long operations)

export type FeedbackEventType = 'text' | 'screenshot' | 'approval' | 'status' | 'error' | 'completion' | 'tool_call' | 'tool_result';

export interface FeedbackEvent {
  id: string;                      // uuid
  sessionName: string;
  type: FeedbackEventType;
  priority: EventPriority;
  content: string;                 // text content or caption
  screenshot?: Buffer;             // PNG buffer if type includes screenshot
  timestamp: number;
  agentMessageId?: number;         // AgentAPI message ID this event relates to
  sequenceNumber: number;          // monotonically increasing per session
}



// ──────────────────────────────────────
// Commands
// ──────────────────────────────────────

export type ControlCommand =
  | { cmd: 'new'; name: string; dir: string; agent: AgentType; model: string }
  | { cmd: 'new_wizard' }                // bare /new — start interactive wizard
  | { cmd: 'cancel' }                    // cancel active wizard
  | { cmd: 'stop'; name: string }
  | { cmd: 'stop_all' }
  | { cmd: 'list' }
  | { cmd: 'agents' }                   // list available agents + models
  | { cmd: 'status'; name?: string }    // optional name for single-session detail
  | { cmd: 'help' }
  | { cmd: 'restart'; name: string }
  | { cmd: 'set'; name: string; key: string; value: string }
  | { cmd: 'web' }                      // show web interface info + QR code
  | { cmd: 'check' };                   // verify prerequisites

export type SessionCommand =
  | { cmd: 'stop' }
  | { cmd: 'approve' }
  | { cmd: 'reject' }
  | { cmd: 'rollback' }
  | { cmd: 'screenshot' }
  | { cmd: 'full' }
  | { cmd: 'help' };

// ──────────────────────────────────────
// Config
// ──────────────────────────────────────

export interface OpenSofaConfig {
  defaultAgent: AgentType;
  maxSessions: number;             // default: 5
  portRangeStart: number;          // default: 3284 (AgentAPI base port)
  debounceMs: number;              // default: 3000
  screenshotIntervalMs: number;    // default: 10000
  approvalTimeoutMs: number;       // default: 300000 (5 min)
  healthCheckIntervalMs: number;   // default: 10000
  idleTimeoutMs: number;           // default: 600000 (10 min)
  screenshotFontSize: number;      // default: 14
  screenshotCols: number;          // default: 80
  autoApprove: boolean;            // default: false (global)
  projectDirs: string[];             // default: ['~/development', '~/projects'] — dirs to scan for git repos
  autoCleanupOnCritical: boolean;    // default: true — auto-stop idle sessions when resources critical
  ntfyTopic?: string | null;         // Optional ntfy.sh topic for push notifications
}

// ──────────────────────────────────────
// State Persistence
// ──────────────────────────────────────

export interface PersistedState {
  sessions: PersistedSession[];
  lastSavedAt: number;
}

export interface PersistedSession {
  name: string;
  status: SessionStatus;
  agentType: AgentType;
  model: string;
  port: number;
  pid: number;
  repoDir: string;
  workDir: string;
  branch: string;
  createdAt: number;
  lastActivityAt: number;
  autoApprove: boolean;
  screenshotsEnabled: boolean;
}

// ──────────────────────────────────────
// Component Interfaces (for circular dependency avoidance)
// ──────────────────────────────────────

// These are placeholder interfaces that will be implemented by actual classes
// Used for type annotations in Session and other places

export interface IFeedbackController {
  connect(port: number): void;
  disconnect(): void;
  isConnected(): boolean;
  on(event: 'event', listener: (event: FeedbackEvent) => void): this;
  on(event: 'status', listener: (status: 'stable' | 'running') => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'screenshot_request', listener: () => void): this;
}

export interface ResourceStats {
  cpu: number;
  freeMemMB: number;
  totalMemMB: number;
  activeSessions: number;
}

// Placeholder types for actual class references
export type FeedbackController = IFeedbackController;