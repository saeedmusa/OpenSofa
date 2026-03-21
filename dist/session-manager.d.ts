/**
 * OpenSofa - Session Manager
 *
 * Central orchestrator - manages session lifecycle.
 * Web-only architecture: all user-facing notifications go through
 * the SSE broadcaster and Web Push.
 * Based on LOW_LEVEL_DESIGN.md §7
 */
import { EventEmitter } from 'events';
import type { OpenSofaConfig, Session, AgentType, SessionCommand, PersistedSession } from './types.js';
import { AgentStateMachine } from './agent-state-machine.js';
import { AgentRegistry } from './agent-registry.js';
import { ResourceMonitor } from './resource-monitor.js';
import { ScreenshotService } from './screenshot-service.js';
import type { Notifier } from './web/notifier.js';
export declare class SessionManager extends EventEmitter {
    private sessions;
    private usedPorts;
    private startupProcesses;
    private creatingSessions;
    private config;
    private classifier;
    private agentRegistry;
    private resourceMonitor;
    private screenshotService;
    private notifier;
    private onStateChanged;
    private webUrlProvider;
    constructor(config: OpenSofaConfig, classifier: AgentStateMachine, agentRegistry: AgentRegistry);
    private groupBadge;
    private isToggleEnabled;
    private parseAgentSwitchValue;
    private buildUploadPrompt;
    private writeUploadFallback;
    private sanitizeFileName;
    private extensionFromMime;
    private validateRepoDirectory;
    /**
     * Group-level emergency stop (Ctrl+C only). Session remains active.
     */
    private emergencyStop;
    /**
     * Set the resource monitor (called from main.ts after initialization)
     */
    setResourceMonitor(monitor: ResourceMonitor): void;
    /**
     * Register a persistence hook to be called on important state transitions.
     */
    setStateChangeHook(hook: () => Promise<void>): void;
    setNotifier(notifier: Notifier): void;
    setScreenshotService(service: ScreenshotService): void;
    /**
     * Set a provider function that returns the current web interface URL.
     */
    setWebUrlProvider(provider: () => Promise<string | null>): void;
    /**
     * Disconnect runtime session objects (SSE connections) without deleting session metadata.
     */
    disconnectAllRuntime(): void;
    /**
     * Create a new coding session
     */
    createSession(name: string, dir: string, agent: AgentType, model?: string): Promise<void>;
    /**
     * Validate session input
     */
    private validateSessionInput;
    /**
     * Create git worktree
     */
    private createWorktree;
    /**
     * Remove git worktree
     */
    private removeWorktree;
    /**
     * Allocate next available port
     */
    private allocatePort;
    /**
     * Release a port
     */
    private releasePort;
    /**
     * Spawn AgentAPI process inside tmux for terminal capture
     */
    private spawnAgentAPI;
    /**
     * Health check - poll until AgentAPI is ready
     */
    private getStartupTimeoutMs;
    private isStartupProcessAlive;
    private healthCheck;
    /**
     * Verify a PID belongs to an agent/tmux process before killing.
     * Prevents killing wrong process if PID was reused by OS.
     */
    private verifyProcessOwnership;
    /**
     * Kill a process by PID with ownership verification
     */
    private killProcess;
    /**
     * Kill tmux session by name
     */
    private killTmuxSession;
    /**
     * Stop a session
     */
    stopSession(name: string): Promise<void>;
    /**
     * Stop all sessions
     */
    stopAllSessions(): Promise<void>;
    /**
     * Send a message to the agent
     */
    sendToAgent(session: Session, text: string): Promise<void>;
    /**
     * Internal method to send a message to the agent
     */
    private sendToAgentInternal;
    /**
     * Upload media to a session
     */
    uploadMedia(session: Session, buffer: Buffer, fileName: string, mimetype: string, caption: string): Promise<void>;
    /**
     * Handle a session command
     */
    handleSessionCommand(session: Session, command: SessionCommand): Promise<void>;
    /**
     * Send approval/rejection to agent
     */
    private sendApproval;
    /**
     * Rollback uncommitted changes
     */
    private rollback;
    /**
     * Switch session agent
     */
    switchSessionAgent(session: Session, value: string): Promise<void>;
    /**
     * Switch session directory
     */
    switchSessionDirectory(session: Session, value: string): Promise<void>;
    /**
     * Set a session setting
     */
    setSessionSetting(name: string, key: string, value: string): Promise<void>;
    /**
     * Get all active sessions
     */
    getActiveSessions(): Session[];
    /**
     * Get session by name
     */
    getByName(name: string): Session | null;
    /**
     * Get sessions list (alias for listSessions for API compatibility)
     */
    getSessionsList(): Session[];
    /**
     * Get session settings
     */
    getSessionSettings(name: string): Record<string, string>;
    /**
     * Get all sessions
     */
    listSessions(): Session[];
    /**
     * Get sessions map (for state persistence)
     */
    getSessionsMap(): Map<string, Session>;
    /**
     * Recover sessions from persisted state
     */
    recoverSessions(persisted: PersistedSession[]): Promise<void>;
    /**
     * Attach per-session runtime pipeline (SSE FeedbackController).
     */
    private attachRuntime;
    /**
     * Attempt to recover from agent crash with exponential backoff.
     * Max 3 attempts with delays: 2s, 4s, 8s.
     */
    private attemptCrashRecovery;
    private clearRuntime;
    private sendAutoApproval;
    /**
     * Restart a session
     */
    restartSession(name: string): Promise<void>;
    private setPendingApproval;
    private clearPendingApproval;
    private handleApprovalTimeout;
    private requestStateSave;
}
//# sourceMappingURL=session-manager.d.ts.map