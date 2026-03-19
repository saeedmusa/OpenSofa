export interface Session {
  name: string;
  status: 'creating' | 'active' | 'stopping' | 'stopped' | 'error';
  agentType: string;
  model: string;
  branch: string;
  agentStatus: 'stable' | 'running';
  hasPendingApproval: boolean;
  createdAt: number;
  lastActivityAt: number;
}

export interface SessionDetail extends Session {
  workDir: string;
  repoDir: string;
  port: number;
  pendingApproval: {
    detectedAt: number;
    command: string | null;
  } | null;
}

export interface Agent {
  type: string;
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

export interface WebSocketEvent {
  type: string;
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
    // AG-UI enriched fields
    toolCallId?: string;
    input?: Record<string, unknown>;
    output?: string;
  };
  actionable?: boolean;
}
