export interface Session {
  name: string;
  status: 'creating' | 'active' | 'stopping' | 'stopped' | 'error';
  agentType: AgentType;
  model: string;
  branch: string;
  agentStatus: 'stable' | 'running' | 'awaiting_human_input';
  hasPendingApproval: boolean;
  createdAt: number;
  lastActivityAt: number;
}

export interface SessionDetail extends Session {
  workDir: string;
  repoDir: string;
  port: number;
  autoApprove: boolean;
  pendingApproval: {
    detectedAt: number;
    command: string | null;
  } | null;
}

export interface Agent {
  type: AgentType;
  displayName: string;
  installed: boolean;
  description: string;
  knownModels: string[];
  defaultModel?: string;
}

export interface SystemStatus {
  tunnelUrl: string | null;
  tunnelStatus: 'starting' | 'running' | 'stopped' | 'error';
  sessionsCount: number;
  uptime: number;
  systemResources: {
    cpu: string;
    freeMem: string;
  };
}

export type WebSocketEventType =
  | 'session_created'
  | 'session_stopped'
  | 'session_updated'
  | 'agent_status'
  | 'agent_output'
  | 'approval_needed'
  | 'approval_cleared'
  | 'terminal_output'
  | 'activity'
  | 'system_status'
  | 'kill_session'
  | 'feedback'
  | 'catch_up_summary'
  | 'session_state_snapshot'
  | 'sync_response'
  | 'auth'
  | 'auth_success'
  | 'ping'
  | 'pong';

export interface WebSocketEvent {
  type: WebSocketEventType;
  sessionName?: string;
  payload: unknown;
  timestamp: number;
  sequence?: number;
  eventId?: string; // UUID for idempotency
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: number;
}

export interface FileListResponse {
  path: string;
  entries: FileEntry[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  oldLines: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiffResponse {
  path: string;
  hunks: DiffHunk[];
  oldPath?: string;
  newPath?: string;
  additions: number;
  deletions: number;
}

/** ACP tool kind values — used for Kind-based activity categorization */
export type ACPToolKind = 'read' | 'edit' | 'delete' | 'execute' | 'search' | 'think' | 'fetch' | 'other';

export interface ActivityEvent {
  id: string;
  type: 'agent_message' | 'file_created' | 'file_edited' | 'file_deleted'
     | 'test_result' | 'build_result' | 'approval_needed' | 'error' | 'command_run'
     | 'information_requested';
  timestamp: number;
  sessionName: string;
  summary: string;
  icon: string;
  /** ACP tool kind — used for filtering and categorization when available */
  toolKind?: ACPToolKind;
  /** MCP server name if this event came from an MCP tool call */
  mcpServer?: string;
  /** MCP tool name if this event came from an MCP tool call */
  mcpTool?: string;
  details?: {
    diff?: string;
    command?: string;
    filePath?: string;
    errorStack?: string;
    // AG-UI enriched fields
    toolCallId?: string;
    input?: Record<string, unknown>;
    output?: string;
  };
  actionable?: boolean;
}

// Agent types - must match backend AgentType in src/types.ts
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

export interface DiscoveredModel {
  id: string;
  name: string;
  provider: string;
  agent: AgentType;
  supportsVision: boolean;
  supportsImages: boolean;
}

export interface ModelProvider {
  name: string;
  id: string;
  agent: AgentType;
  models: DiscoveredModel[];
  configured: boolean;
}

export interface ModelDiscoveryResult {
  success: boolean;
  providers: ModelProvider[];
  errors?: string[];
}

/** AgentAPI message — matches backend AgentAPIMessage type */
export interface AgentAPIMessage {
  id: number;
  content: string;
  role: 'agent' | 'user';
  time: string; // ISO 8601
}
