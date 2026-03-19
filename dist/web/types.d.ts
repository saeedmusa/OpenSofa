/**
 * OpenSofa Web - Type Definitions
 *
 * Types specific to the web interface: API responses, WebSocket events,
 * and configuration.
 */
import type { Session, AgentType, SessionStatus } from '../types.js';
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
export declare const DEFAULT_WEB_CONFIG: WebConfig;
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
export declare const success: <T>(data: T) => ApiSuccess<T>;
export declare const error: (message: string, code?: string) => ApiError;
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
export type WebSocketEventType = 'session_created' | 'session_stopped' | 'session_updated' | 'agent_status' | 'agent_output' | 'approval_needed' | 'approval_cleared' | 'terminal_output' | 'activity' | 'system_status' | 'kill_session' | 'feedback' | 'catch_up_summary' | 'session_state_snapshot';
export interface WebSocketEvent {
    type: WebSocketEventType;
    sessionName?: string;
    payload: unknown;
    timestamp: number;
    sequence?: number;
    eventId?: string;
}
export type SyncResponsePayload = {
    events: WebSocketEvent[];
};
export interface WebSocketClientMessage {
    type: 'ping' | 'subscribe_terminal' | 'unsubscribe_terminal' | 'sync_request' | 'terminal_input' | 'terminal_resize';
    sessionName?: string;
    since?: number;
    payload?: unknown;
}
export interface TokenData {
    token: string;
    createdAt: number;
    expiresAt: number;
}
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
export declare const sessionToSummary: (session: Session) => SessionSummary;
export declare const sessionToDetail: (session: Session) => SessionDetailResponse;
//# sourceMappingURL=types.d.ts.map