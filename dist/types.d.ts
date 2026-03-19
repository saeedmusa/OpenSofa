/**
 * OpenSofa - Shared TypeScript Interfaces
 *
 * All types used across multiple components. Single source of truth.
 * Based on LOW_LEVEL_DESIGN.md §2
 */
export type SessionStatus = 'creating' | 'active' | 'stopping' | 'stopped' | 'error';
export type AgentType = 'claude' | 'aider' | 'goose' | 'gemini' | 'codex' | 'amp' | 'opencode' | 'copilot' | 'cursor' | 'auggie' | 'amazonq' | 'custom';
export interface Session {
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
    agentStatus: 'stable' | 'running' | 'awaiting_human_input';
    transport?: 'acp' | 'pty';
    feedbackController: IFeedbackController | null;
    autoApprove: boolean;
    screenshotsEnabled: boolean;
    pendingApproval?: {
        detectedAt: number;
        command: string | null;
        timeoutId?: NodeJS.Timeout;
    };
}
export interface AgentAPIMessage {
    id: number;
    content: string;
    role: 'agent' | 'user';
    time: string;
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
export interface SSEMessageUpdate {
    id: number;
    message: string;
    role: 'agent' | 'user';
    time: string;
}
export interface SSEStatusChange {
    agent_type: string;
    status: 'stable' | 'running';
}
export type EventPriority = 'p0' | 'p1' | 'p2';
export type FeedbackEventType = 'text' | 'screenshot' | 'approval' | 'status' | 'error' | 'completion' | 'tool_call' | 'tool_result';
export interface FeedbackEvent {
    id: string;
    sessionName: string;
    type: FeedbackEventType;
    priority: EventPriority;
    content: string;
    screenshot?: Buffer;
    timestamp: number;
    agentMessageId?: number;
    sequenceNumber: number;
}
export type ControlCommand = {
    cmd: 'new';
    name: string;
    dir: string;
    agent: AgentType;
    model: string;
} | {
    cmd: 'new_wizard';
} | {
    cmd: 'cancel';
} | {
    cmd: 'stop';
    name: string;
} | {
    cmd: 'stop_all';
} | {
    cmd: 'list';
} | {
    cmd: 'agents';
} | {
    cmd: 'status';
    name?: string;
} | {
    cmd: 'help';
} | {
    cmd: 'restart';
    name: string;
} | {
    cmd: 'set';
    name: string;
    key: string;
    value: string;
} | {
    cmd: 'web';
} | {
    cmd: 'check';
};
export type SessionCommand = {
    cmd: 'stop';
} | {
    cmd: 'approve';
} | {
    cmd: 'reject';
} | {
    cmd: 'rollback';
} | {
    cmd: 'screenshot';
} | {
    cmd: 'full';
} | {
    cmd: 'help';
};
export interface OpenSofaConfig {
    defaultAgent: AgentType;
    maxSessions: number;
    portRangeStart: number;
    debounceMs: number;
    screenshotIntervalMs: number;
    approvalTimeoutMs: number;
    healthCheckIntervalMs: number;
    idleTimeoutMs: number;
    screenshotFontSize: number;
    screenshotCols: number;
    autoApprove: boolean;
    projectDirs: string[];
    autoCleanupOnCritical: boolean;
    ntfyTopic?: string | null;
}
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
export type FeedbackController = IFeedbackController;
//# sourceMappingURL=types.d.ts.map