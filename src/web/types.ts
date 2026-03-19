/**
 * OpenSofa Web - Type Definitions
 *
 * Types specific to the web interface: API responses, WebSocket events,
 * and configuration.
 */

import type { Session, AgentType, SessionStatus } from '../types.js';

// ──────────────────────────────────────
// Web Configuration
// ──────────────────────────────────────

export interface WebConfig {
  enabled: boolean;
  port: number;
  tunnel: {
    provider: 'cloudflare' | 'local' | 'disabled';
  };
  auth: {
    tokenPath: string;
    tokenExpiryHours: number;
  };
}

export const DEFAULT_WEB_CONFIG: WebConfig = {
  enabled: true,
  port: 3285,
  tunnel: {
    provider: 'cloudflare',
  },
  auth: {
    tokenPath: '~/.opensofa/web-token',
    tokenExpiryHours: 24,
  },
};

// ──────────────────────────────────────
// API Response Types
// ──────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// Helper functions for creating responses (pure functions)
export const success = <T>(data: T): ApiSuccess<T> => ({
  success: true,
  data,
});

export const error = (message: string, code?: string): ApiError => ({
  success: false,
  error: message,
  code,
});

// ──────────────────────────────────────
// Session API Types
// ──────────────────────────────────────

export interface SessionListResponse {
  sessions: SessionSummary[];
}

export interface SessionSummary {
  name: string;
  status: SessionStatus;
  agentType: AgentType;
  model: string;
  branch: string;
  agentStatus: 'stable' | 'running' | 'awaiting_human_input';
  hasPendingApproval: boolean;
  createdAt: number;
  lastActivityAt: number;
}

export interface SessionDetailResponse extends SessionSummary {
  workDir: string;
  repoDir: string;
  port: number;
  pendingApproval: {
    detectedAt: number;
    command: string | null;
  } | null;
}

export interface SendMessageRequest {
  content: string;
}

export interface SendMessageResponse {
  ok: boolean;
  messageId?: number;
}

// ──────────────────────────────────────
// File API Types
// ──────────────────────────────────────

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

// ──────────────────────────────────────
// System API Types
// ──────────────────────────────────────

export interface SystemStatusResponse {
  tunnelUrl: string | null;
  tunnelStatus: TunnelStatus;
  sessionsCount: number;
  uptime: number;
  systemResources: {
    cpu: string;
    freeMem: string;
  };
}

export type TunnelStatus = 'starting' | 'running' | 'stopped' | 'error';

// ──────────────────────────────────────
// WebSocket Event Types
// ──────────────────────────────────────

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
  | 'feedback' // US-13: Feedback events from FeedbackController
  | 'catch_up_summary' // US-13: Summary when events have been pruned
  | 'session_state_snapshot'; // US-13: Current session state after reconnect

export interface WebSocketEvent {
  type: WebSocketEventType;
  sessionName?: string;
  payload: unknown;
  timestamp: number;
  sequence?: number;
  eventId?: string; // UUID for idempotency
}

export type SyncResponsePayload = {
  events: WebSocketEvent[];
};

// Client -> Server messages
export interface WebSocketClientMessage {
  type: 'ping' | 'subscribe_terminal' | 'unsubscribe_terminal' | 'sync_request' | 'terminal_input' | 'terminal_resize';
  sessionName?: string;
  since?: number; // Used for sync_request
  payload?: unknown; // generic payload for input/resize
}

// ──────────────────────────────────────
// Auth Types
// ──────────────────────────────────────

export interface TokenData {
  token: string;
  createdAt: number;
  expiresAt: number;
}

// ──────────────────────────────────────
// Agent API Types
// ──────────────────────────────────────

export interface AgentSummary {
  type: AgentType;
  displayName: string;
  installed: boolean;
  description: string;
  knownModels: string[];
  defaultModel?: string;
}

export interface AgentListResponse {
  agents: AgentSummary[];
}

// ──────────────────────────────────────
// Helper: Convert Session to API types
// ──────────────────────────────────────

export const sessionToSummary = (session: Session): SessionSummary => ({
  name: session.name,
  status: session.status,
  agentType: session.agentType,
  model: session.model,
  branch: session.branch,
  agentStatus: session.agentStatus,
  hasPendingApproval: !!session.pendingApproval,
  createdAt: session.createdAt,
  lastActivityAt: session.lastActivityAt,
});

export const sessionToDetail = (session: Session): SessionDetailResponse => ({
  name: session.name,
  status: session.status,
  agentType: session.agentType,
  model: session.model,
  branch: session.branch,
  agentStatus: session.agentStatus,
  hasPendingApproval: !!session.pendingApproval,
  createdAt: session.createdAt,
  lastActivityAt: session.lastActivityAt,
  workDir: session.workDir,
  repoDir: session.repoDir,
  port: session.port,
  pendingApproval: session.pendingApproval
    ? {
        detectedAt: session.pendingApproval.detectedAt,
        command: session.pendingApproval.command,
      }
    : null,
});
