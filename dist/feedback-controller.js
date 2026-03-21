/**
 * OpenSofa - Feedback Controller
 *
 * Listens to AgentAPI SSE events and emits FeedbackEvents.
 * One instance per active session.
 * Based on LOW_LEVEL_DESIGN.md §8
 */
import EventEmitter from 'events';
import EventSource from 'eventsource';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from './utils/logger.js';
import { persistMessage } from './web/routes/conversations.js';
const log = createLogger('feedback');
/**
 * Feedback Controller class
 * One instance per session - owns SSE connection to AgentAPI
 */
export class FeedbackController extends EventEmitter {
    session;
    config;
    classifier;
    eventSource = null;
    sequenceNumber = 0;
    lastSeenMessageId = -1;
    lastMessageContent = '';
    lastApprovalMessageId = -1;
    agentRunning = false;
    screenshotTimer = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    connected = false;
    constructor(session, config, classifier) {
        super();
        this.session = session;
        this.config = config;
        this.classifier = classifier;
    }
    /**
     * Connect to AgentAPI SSE endpoint
     */
    connect(port) {
        const url = `http://localhost:${port}/events`;
        log.info(`Connecting to SSE: ${url}`);
        this.eventSource = new EventSource(url);
        // Handle message_update events
        this.eventSource.addEventListener('message_update', (e) => {
            try {
                const data = JSON.parse(e.data);
                this.handleMessageUpdate(data);
            }
            catch (err) {
                log.error('Failed to parse message_update', { error: String(err) });
            }
        });
        // Handle status_change events
        this.eventSource.addEventListener('status_change', (e) => {
            try {
                const data = JSON.parse(e.data);
                this.handleStatusChange(data);
            }
            catch (err) {
                log.error('Failed to parse status_change', { error: String(err) });
            }
        });
        // Handle SessionUpdate events (ACP format with ToolCall, ToolCallUpdate)
        this.eventSource.addEventListener('SessionUpdate', (e) => {
            try {
                const data = JSON.parse(e.data);
                this.handleSessionUpdate(data);
            }
            catch (err) {
                log.error('Failed to parse SessionUpdate', { error: String(err) });
            }
        });
        // Handle agent_error events
        this.eventSource.addEventListener('agent_error', (e) => {
            try {
                const data = JSON.parse(e.data);
                log.error('Agent error received', { session: this.session.name, message: data.message, level: data.level });
                this.emitEvent({
                    type: 'error',
                    priority: 'p0',
                    content: data.message || 'Agent encountered an error',
                });
            }
            catch (err) {
                log.error('Failed to parse agent_error', { error: String(err) });
            }
        });
        // Handle connection open
        this.eventSource.onopen = () => {
            const isReconnect = this.connected || this.reconnectAttempts > 0;
            log.info(`SSE ${isReconnect ? 're' : ''}connected for session ${this.session.name}`);
            this.connected = true;
            this.reconnectAttempts = 0;
            // After reconnect, poll /status to sync actual agent state.
            // This prevents agentStatus getting stuck at 'running' if the agent
            // went stable during the disconnect window.
            if (isReconnect) {
                this.syncStatusFromAPI(port);
            }
        };
        // Handle errors
        this.eventSource.onerror = (err) => {
            this.handleSSEError(err);
        };
    }
    /**
     * Handle message_update SSE event
     */
    handleMessageUpdate(data) {
        // Only process agent messages (ignore echoed user messages)
        if (data.role !== 'agent')
            return;
        // Replay handling: skip older message IDs that can appear after SSE reconnect.
        if (data.id < this.lastSeenMessageId) {
            return;
        }
        // Detect if this is a NEW message or an UPDATE to existing
        const isNewMessage = data.id > this.lastSeenMessageId;
        if (!isNewMessage && data.message === this.lastMessageContent) {
            // Exact replay of already-seen content.
            return;
        }
        if (!isNewMessage && data.message.length < this.lastMessageContent.length) {
            // Older partial replay after reconnect.
            return;
        }
        // Compute the delta (new text added since last update)
        let delta;
        if (isNewMessage) {
            delta = data.message;
            this.lastSeenMessageId = data.id;
            this.lastMessageContent = '';
            // Persist new agent message to SQLite
            persistMessage(this.session.name, data.id, 'agent', data.message);
        }
        else {
            // Same message ID, content grew — extract only the new part
            if (data.message.startsWith(this.lastMessageContent)) {
                delta = data.message.slice(this.lastMessageContent.length);
            }
            else {
                // Content was replaced entirely (rare)
                delta = data.message;
            }
        }
        this.lastMessageContent = data.message;
        // Skip empty deltas
        if (!delta.trim())
            return;
        // Check for approval request — but only emit once per message ID.
        // Without this guard, every message_update (~40fps) that still matches
        // an approval pattern re-triggers a p0 event, flooding notifications.
        const approvalDetected = this.classifier.isApprovalRequest(data.message);
        const isNewApproval = approvalDetected && data.id !== this.lastApprovalMessageId;
        const isConversationalQuestion = !approvalDetected && this.classifier.isConversationalQuestion(data.message);
        if (isNewApproval) {
            this.lastApprovalMessageId = data.id;
            this.emitEvent({
                type: 'approval',
                priority: 'p0',
                content: data.message,
                agentMessageId: data.id,
            });
        }
        else if (isConversationalQuestion && isNewMessage) {
            this.emitEvent({
                type: 'information_requested',
                priority: 'p1',
                content: delta,
                agentMessageId: data.id,
            });
        }
        else if (isNewMessage) {
            this.emitEvent({
                type: 'text',
                priority: 'p1',
                content: delta,
                agentMessageId: data.id,
            });
        }
        else {
            // Intermediate update — low priority (will be debounced)
            this.emitEvent({
                type: 'text',
                priority: 'p2',
                content: delta,
                agentMessageId: data.id,
            });
        }
    }
    /**
     * Handle status_change SSE event
     */
    handleStatusChange(data) {
        const wasRunning = this.agentRunning;
        this.agentRunning = data.status === 'running';
        // Update session's agentStatus
        this.emit('status', data.status);
        if (data.status === 'running' && !wasRunning) {
            // Agent started processing — begin screenshot timer
            this.startScreenshotTimer();
            this.emitEvent({
                type: 'status',
                priority: 'p2',
                content: 'Agent is working...',
            });
        }
        if (data.status === 'stable' && wasRunning) {
            // Agent finished — stop screenshot timer, emit completion
            this.stopScreenshotTimer();
            this.emitEvent({
                type: 'completion',
                priority: 'p0',
                content: this.lastMessageContent, // final agent output
            });
        }
    }
    /**
     * Handle SessionUpdate ACP event (contains ToolCall, ToolCallUpdate, AgentMessageChunk)
     */
    handleSessionUpdate(data) {
        // Handle AgentMessageChunk - emit as text event
        if (data.AgentMessageChunk?.Content?.Text?.Text !== undefined) {
            const text = data.AgentMessageChunk.Content.Text.Text;
            if (text.trim()) {
                this.emitEvent({
                    type: 'text',
                    priority: 'p2',
                    content: text,
                });
            }
        }
        // Handle ToolCall - emit as tool_call event
        if (data.ToolCall?.Kind && data.ToolCall?.Title) {
            this.emitEvent({
                type: 'tool_call',
                priority: 'p2',
                content: `${data.ToolCall.Kind}: ${data.ToolCall.Title}`,
            });
        }
        // Handle ToolCallUpdate - emit as tool_result event
        if (data.ToolCallUpdate?.Status) {
            this.emitEvent({
                type: 'tool_result',
                priority: 'p2',
                content: `Tool ${data.ToolCallUpdate.Status}`,
            });
        }
    }
    /**
     * Handle SSE connection errors
     */
    handleSSEError(err) {
        log.warn(`SSE error for session ${this.session.name}`, { error: String(err) });
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log.error(`SSE max reconnect attempts reached for session ${this.session.name}`);
            this.emit('error', new Error('SSE max reconnect attempts reached'));
            return;
        }
        this.reconnectAttempts++;
        this.connected = false;
        // EventSource handles reconnection automatically
        // We just track attempts and emit errors if it fails too many times
        log.info(`SSE reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    }
    /**
     * Start periodic screenshot timer
     */
    startScreenshotTimer() {
        if (this.screenshotTimer)
            return; // already running
        log.debug(`Starting screenshot timer for session ${this.session.name}`);
        this.screenshotTimer = setInterval(() => {
            if (!this.agentRunning) {
                this.stopScreenshotTimer();
                return;
            }
            // Request screenshot from ScreenshotService (via event — SessionManager wires this)
            this.emit('screenshot_request');
        }, this.config.screenshotIntervalMs);
    }
    /**
     * Stop periodic screenshot timer
     */
    stopScreenshotTimer() {
        if (this.screenshotTimer) {
            clearInterval(this.screenshotTimer);
            this.screenshotTimer = null;
            log.debug(`Stopped screenshot timer for session ${this.session.name}`);
        }
    }
    /**
     * Emit a FeedbackEvent
     */
    emitEvent(partial) {
        const event = {
            id: uuidv4(),
            sessionName: this.session.name,
            type: partial.type,
            priority: partial.priority,
            content: partial.content,
            screenshot: partial.screenshot,
            timestamp: Date.now(),
            agentMessageId: partial.agentMessageId,
            sequenceNumber: ++this.sequenceNumber,
        };
        log.debug(`Emitting event: ${event.type} (priority: ${event.priority})`);
        this.emit('event', event);
    }
    /**
     * Poll GET /status to sync agent state after SSE reconnect.
     * Fires asynchronously — errors are logged but non-fatal.
     */
    syncStatusFromAPI(port) {
        void (async () => {
            try {
                const res = await fetch(`http://localhost:${port}/status`, {
                    signal: AbortSignal.timeout(5000),
                });
                if (!res.ok)
                    return;
                const body = (await res.json());
                log.debug(`Status sync after reconnect: ${body.status}`, { session: this.session.name });
                // Emit a synthetic status_change so session-manager updates agentStatus
                this.handleStatusChange(body);
            }
            catch (err) {
                log.warn('Status sync after SSE reconnect failed', {
                    session: this.session.name,
                    error: String(err),
                });
            }
        })();
    }
    /**
     * Disconnect SSE
     */
    disconnect() {
        this.stopScreenshotTimer();
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.connected = false;
        this.removeAllListeners();
        log.info(`Disconnected SSE for session ${this.session.name}`);
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Get last full message content (for /full command)
     */
    getLastFullContent() {
        return this.lastMessageContent;
    }
    /**
     * Check if agent is currently running
     */
    isAgentRunning() {
        return this.agentRunning;
    }
}
//# sourceMappingURL=feedback-controller.js.map