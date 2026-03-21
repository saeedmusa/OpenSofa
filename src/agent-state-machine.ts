/**
 * OpenSofa - Agent State Machine
 *
 * Detects permission/approval requests without regex.
 * Uses AgentAPI's own signals (status_change + GET /messages) to determine
 * whether the agent is working, completed, or waiting for user input.
 *
 * Key insight from AgentAPI source code:
 * AgentAPI detects "stable" by checking if the terminal screen hasn't changed
 * for N consecutive snapshots. When an agent asks for permission, it prints a
 * question and STOPS → screen stops changing → AgentAPI emits status: "stable".
 * This is the SAME signal as "agent finished its task."
 *
 * We distinguish them by checking the last message content:
 * - Ends with "?" or contains "[Y/n]" → waiting for input
 * - Is a statement → completed
 */

import { createLogger } from './utils/logger.js';

const log = createLogger('agent-state-machine');

export type AgentState = 'IDLE' | 'WORKING' | 'ANALYZING' | 'AWAITING_INPUT' | 'COMPLETED';

/**
 * Literal strings that indicate a permission/approval prompt.
 * Checked with String.includes() — no regex.
 */
const APPROVAL_INDICATORS = [
  '[Y/n]',
  '[y/N]',
  '(yes/no)',
  '(Y)es',
  '(y/n)',
  'Do you want to proceed',
  'Allow this action',
  'Allow this tool',
  'Approve tool use',
  'Tool requires approval',
  'Execute this command',
  'Allow execution',
  'Confirm action',
  'accept this change',
  'apply changes',
  'proceed with changes',
  'Press Enter to continue',
];

/**
 * Agent State Machine for permission detection.
 *
 * Replaces the regex-based PermissionClassifier with a state machine
 * driven by AgentAPI's status_change and GET /messages signals.
 */
export class AgentStateMachine {
  private state: AgentState = 'IDLE';
  private lastACPToolKind: string | undefined;
  private lastACPToolTitle: string | undefined;
  private hasPendingToolCall = false;
  private debounceTimer: NodeJS.Timeout | undefined;
  private readonly debounceMs: number;

  constructor(debounceMs = 2000) {
    this.debounceMs = debounceMs;
  }

  /**
   * Get the current state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Handle status_change event from AgentAPI
   */
  onStatusChange(status: 'stable' | 'running'): void {
    if (status === 'running') {
      // Cancel any pending debounce
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = undefined;
      }

      if (this.state === 'ANALYZING') {
        // Agent went running during ANALYZING — it was just a pause, not a permission request
        log.debug('Agent resumed during ANALYZING — was just a pause');
      }

      this.state = 'WORKING';
      log.debug('State → WORKING');
      return;
    }

    if (status === 'stable') {
      if (this.state === 'WORKING') {
        // Agent went stable after working — need to analyze WHY
        this.state = 'ANALYZING';
        log.debug('State → ANALYZING (agent went stable)');

        // Debounce: if agent goes running again within debounceMs, it was just a pause
        this.debounceTimer = setTimeout(() => {
          if (this.state === 'ANALYZING') {
            // Still in ANALYZING after debounce — need to check message content
            // The caller should call analyzeMessage() to determine final state
            log.debug('Debounce expired, still in ANALYZING — caller should call analyzeMessage()');
          }
        }, this.debounceMs);
      }
    }
  }

  /**
   * Handle ACP ToolCall event
   */
  onToolCall(kind: string, title: string): void {
    this.lastACPToolKind = kind;
    this.lastACPToolTitle = title;
    this.hasPendingToolCall = true;
    log.debug('ACP ToolCall received', { kind, title });
  }

  /**
   * Handle ACP ToolCallUpdate event
   */
  onToolCallUpdate(status: string): void {
    if (status === 'completed' || status === 'failed') {
      this.hasPendingToolCall = false;
      log.debug('ACP ToolCall completed', { status });
    }
  }

  /**
   * Analyze the last agent message to determine if the agent is waiting for input.
   * Called when the agent goes stable (ANALYZING state).
   *
   * @param message - The last agent message content (from GET /messages)
   * @returns true if the agent is waiting for user input (approval)
   */
  analyzeMessage(message: string): boolean {
    if (this.state !== 'ANALYZING') {
      log.debug('analyzeMessage called but not in ANALYZING state', { state: this.state });
      return false;
    }

    // Cancel debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    const isWaiting = this.isWaitingForInput(message);

    if (isWaiting) {
      this.state = 'AWAITING_INPUT';
      log.info('State → AWAITING_INPUT (permission detected)');
    } else {
      this.state = 'COMPLETED';
      log.debug('State → COMPLETED (agent finished)');
    }

    return isWaiting;
  }

  /**
   * Check if a message indicates the agent is waiting for user input.
   * Uses structural analysis — no regex.
   */
  isWaitingForInput(message: string): boolean {
    if (!message || !message.trim()) return false;

    // Check 1: ACP ToolCall context — if there's a pending execute tool call,
    // the agent is likely waiting for approval
    if (this.hasPendingToolCall && this.lastACPToolKind === 'execute') {
      log.debug('Waiting detected: pending execute tool call');
      return true;
    }

    // Check 2: Message contains literal approval indicators
    for (const indicator of APPROVAL_INDICATORS) {
      if (message.includes(indicator)) {
        log.debug('Waiting detected: message contains approval indicator', { indicator });
        return true;
      }
    }

    // Check 3: Last non-empty line ends with '?'
    const lines = message.trim().split('\n');
    let lastNonEmptyLine: string | undefined;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line && line.trim().length > 0) {
        lastNonEmptyLine = line;
        break;
      }
    }
    if (lastNonEmptyLine && lastNonEmptyLine.trim().endsWith('?')) {
      log.debug('Waiting detected: last line ends with ?');
      return true;
    }

    return false;
  }

  /**
   * Extract the command being approved from the message.
   * Uses structural analysis — no regex.
   *
   * @param message - The last agent message content
   * @returns The extracted command or null
   */
  extractCommand(message: string): string | null {
    if (!message) return null;

    // If we have ACP tool call context, use the title
    if (this.hasPendingToolCall && this.lastACPToolTitle) {
      return this.lastACPToolTitle;
    }

    // Look for lines starting with $ or > (shell prompts)
    const lines = message.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('$ ') || trimmed.startsWith('> ')) {
        return trimmed.slice(2).trim();
      }
    }

    // Look for text in backticks
    const backtickStart = message.indexOf('`');
    if (backtickStart !== -1) {
      const backtickEnd = message.indexOf('`', backtickStart + 1);
      if (backtickEnd !== -1) {
        return message.slice(backtickStart + 1, backtickEnd).trim();
      }
    }

    // Look for "I'd like to run:" or "Execute:" patterns
    const prefixes = ["I'd like to run:", 'I need to execute:', 'Execute:', 'Run:'];
    for (const prefix of prefixes) {
      const idx = message.indexOf(prefix);
      if (idx !== -1) {
        const afterPrefix = message.slice(idx + prefix.length).trim();
        const command = afterPrefix.split('\n')[0]?.trim();
        if (command) return command;
      }
    }

    return null;
  }

  /**
   * Reset the state machine to IDLE
   */
  reset(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    this.state = 'IDLE';
    this.lastACPToolKind = undefined;
    this.lastACPToolTitle = undefined;
    this.hasPendingToolCall = false;
    log.debug('State → IDLE (reset)');
  }

  /**
   * Classify agent output — drop-in replacement for PermissionClassifier.classify()
   *
   * @param agentOutput - The agent's output text
   * @returns Object with isApproval and optional command
   */
  classify(agentOutput: string): { isApproval: boolean; command: string | null } {
    const isApproval = this.isWaitingForInput(agentOutput);
    const command = isApproval ? this.extractCommand(agentOutput) : null;
    return { isApproval, command };
  }

  /**
   * Drop-in replacement for PermissionClassifier.isApprovalRequest()
   */
  isApprovalRequest(agentOutput: string): boolean {
    return this.isWaitingForInput(agentOutput);
  }
}

/**
 * Create a new AgentStateMachine instance
 */
export function createAgentStateMachine(debounceMs?: number): AgentStateMachine {
  return new AgentStateMachine(debounceMs);
}
