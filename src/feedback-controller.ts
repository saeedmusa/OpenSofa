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
import { sleep } from './utils/sleep.js';
import type { 
  OpenSofaConfig, 
  Session, 
  FeedbackEvent, 
  EventPriority,
  SSEMessageUpdate,
  SSEStatusChange 
} from './types.js';
import { AgentStateMachine } from './agent-state-machine.js';

const log = createLogger('feedback');

/**
 * Feedback Controller class
 * One instance per session - owns SSE connection to AgentAPI
 */
export class FeedbackController extends EventEmitter {
  private session: Session;
  private config: OpenSofaConfig;
  private classifier: AgentStateMachine;
  private eventSource: EventSource | null = null;
  private sequenceNumber: number = 0;
  private lastSeenMessageId: number = -1;
  private lastMessageContent: string = '';
  private lastApprovalMessageId: number = -1;
  private agentRunning: boolean = false;
  private screenshotTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private connected: boolean = false;

  constructor(
    session: Session, 
    config: OpenSofaConfig, 
    classifier: AgentStateMachine
  ) {
    super();
    this.session = session;
    this.config = config;
    this.classifier = classifier;
  }

  /**
   * Connect to AgentAPI SSE endpoint
   */
  connect(port: number): void {
    const url = `http://localhost:${port}/events`;
    log.info(`Connecting to SSE: ${url}`);

    this.eventSource = new EventSource(url);

    // Handle message_update events
    this.eventSource.addEventListener('message_update', (e: MessageEvent) => {
      try {
        const data: SSEMessageUpdate = JSON.parse(e.data);
        this.handleMessageUpdate(data);
      } catch (err) {
        log.error('Failed to parse message_update', { error: String(err) });
      }
    });

    // Handle status_change events
    this.eventSource.addEventListener('status_change', (e: MessageEvent) => {
      try {
        const data: SSEStatusChange = JSON.parse(e.data);
        this.handleStatusChange(data);
      } catch (err) {
        log.error('Failed to parse status_change', { error: String(err) });
      }
    });

    // Handle SessionUpdate events (ACP format with ToolCall, ToolCallUpdate)
    this.eventSource.addEventListener('SessionUpdate', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        this.handleSessionUpdate(data);
      } catch (err) {
        log.error('Failed to parse SessionUpdate', { error: String(err) });
      }
    });

    // Handle agent_error events
    this.eventSource.addEventListener('agent_error', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { message: string; level?: string };
        log.error('Agent error received', { session: this.session.name, message: data.message, level: data.level });
        this.emitEvent({
          type: 'error',
          priority: 'p0',
          content: data.message || 'Agent encountered an error',
        });
      } catch (err) {
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
  private handleMessageUpdate(data: SSEMessageUpdate): void {
    // Only process agent messages (ignore echoed user messages)
    if (data.role !== 'agent') return;

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
    let delta: string;
    if (isNewMessage) {
      delta = data.message;
      this.lastSeenMessageId = data.id;
      this.lastMessageContent = '';
    } else {
      // Same message ID, content grew — extract only the new part
      if (data.message.startsWith(this.lastMessageContent)) {
        delta = data.message.slice(this.lastMessageContent.length);
      } else {
        // Content was replaced entirely (rare)
        delta = data.message;
      }
    }
    this.lastMessageContent = data.message;

    // Skip empty deltas
    if (!delta.trim()) return;

    // Check for approval request — but only emit once per message ID.
    // Without this guard, every message_update (~40fps) that still matches
    // an approval pattern re-triggers a p0 event, flooding notifications.
    const approvalDetected = this.classifier.isApprovalRequest(data.message);
    const isNewApproval = approvalDetected && data.id !== this.lastApprovalMessageId;

    if (isNewApproval) {
      this.lastApprovalMessageId = data.id;
      this.emitEvent({
        type: 'approval',
        priority: 'p0',
        content: data.message,
        agentMessageId: data.id,
      });
    } else if (isNewMessage) {
      this.emitEvent({
        type: 'text',
        priority: 'p1',
        content: delta,
        agentMessageId: data.id,
      });
    } else {
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
  private handleStatusChange(data: SSEStatusChange): void {
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
  private handleSessionUpdate(data: {
    AgentMessageChunk?: { Content?: { Text?: { Text?: string } } };
    ToolCall?: { Kind?: string; Title?: string };
    ToolCallUpdate?: { Status?: string };
  }): void {
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
  private handleSSEError(err: Event): void {
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
  private startScreenshotTimer(): void {
    if (this.screenshotTimer) return; // already running

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
  private stopScreenshotTimer(): void {
    if (this.screenshotTimer) {
      clearInterval(this.screenshotTimer);
      this.screenshotTimer = null;
      log.debug(`Stopped screenshot timer for session ${this.session.name}`);
    }
  }

  /**
   * Emit a FeedbackEvent
   */
  private emitEvent(partial: Partial<FeedbackEvent>): void {
    const event: FeedbackEvent = {
      id: uuidv4(),
      sessionName: this.session.name,
      type: partial.type!,
      priority: partial.priority!,
      content: partial.content!,
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
  private syncStatusFromAPI(port: number): void {
    void (async () => {
      try {
        const res = await fetch(`http://localhost:${port}/status`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return;

        const body = (await res.json()) as { status: 'stable' | 'running'; agent_type: string };
        log.debug(`Status sync after reconnect: ${body.status}`, { session: this.session.name });

        // Emit a synthetic status_change so session-manager updates agentStatus
        this.handleStatusChange(body);
      } catch (err) {
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
  disconnect(): void {
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
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get last full message content (for /full command)
   */
  getLastFullContent(): string {
    return this.lastMessageContent;
  }

  /**
   * Check if agent is currently running
   */
  isAgentRunning(): boolean {
    return this.agentRunning;
  }
}