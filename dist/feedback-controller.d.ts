/**
 * OpenSofa - Feedback Controller
 *
 * Listens to AgentAPI SSE events and emits FeedbackEvents.
 * One instance per active session.
 * Based on LOW_LEVEL_DESIGN.md §8
 */
import EventEmitter from 'events';
import type { OpenSofaConfig, Session } from './types.js';
import { AgentStateMachine } from './agent-state-machine.js';
/**
 * Feedback Controller class
 * One instance per session - owns SSE connection to AgentAPI
 */
export declare class FeedbackController extends EventEmitter {
    private session;
    private config;
    private classifier;
    private eventSource;
    private sequenceNumber;
    private lastSeenMessageId;
    private lastMessageContent;
    private lastApprovalMessageId;
    private agentRunning;
    private screenshotTimer;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private connected;
    constructor(session: Session, config: OpenSofaConfig, classifier: AgentStateMachine);
    /**
     * Connect to AgentAPI SSE endpoint
     */
    connect(port: number): void;
    /**
     * Handle message_update SSE event
     */
    private handleMessageUpdate;
    /**
     * Handle status_change SSE event
     */
    private handleStatusChange;
    /**
     * Handle SessionUpdate ACP event (contains ToolCall, ToolCallUpdate, AgentMessageChunk)
     */
    private handleSessionUpdate;
    /**
     * Handle SSE connection errors
     */
    private handleSSEError;
    /**
     * Start periodic screenshot timer
     */
    private startScreenshotTimer;
    /**
     * Stop periodic screenshot timer
     */
    private stopScreenshotTimer;
    /**
     * Emit a FeedbackEvent
     */
    private emitEvent;
    /**
     * Poll GET /status to sync agent state after SSE reconnect.
     * Fires asynchronously — errors are logged but non-fatal.
     */
    private syncStatusFromAPI;
    /**
     * Disconnect SSE
     */
    disconnect(): void;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Get last full message content (for /full command)
     */
    getLastFullContent(): string;
    /**
     * Check if agent is currently running
     */
    isAgentRunning(): boolean;
}
//# sourceMappingURL=feedback-controller.d.ts.map