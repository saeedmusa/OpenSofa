/**
 * OpenSofa - OpenCode Agent Adapter
 * 
 * Adapts OpenCode's JSONL output format to AG-UI events.
 * OpenCode emits events as newline-delimited JSON with these types:
 * - step_start: Agent begins a new step
 * - step_finish: Agent completes a step
 * - text: Text content from the agent
 * - tool_use: Tool invocation (Edit, Write, Bash, etc.)
 * - error: Error events
 */

import { createLogger } from '../../utils/logger.js';
import { JsonlParser } from '../event-parser/jsonl-parser.js';
import { 
  type AgentAdapter,
  type ActivityAdapter,
  type AdapterRegistry,
} from './mod.js';
import { mapAGUIToActivityEvent } from '../event-parser/mapper.js';
import type { ActivityEvent } from '../activity-parser.js';
import type { AGUIEvent } from '../ag-ui-events.js';

const log = createLogger('adapter:opencode');

/**
 * OpenCode-specific event types
 */
export type OpenCodeEventType = 'step_start' | 'step_finish' | 'text' | 'tool_use' | 'error';

/**
 * OpenCode adapter implementation
 * Parses OpenCode JSONL output and maps to AG-UI events
 */
export class OpenCodeAdapter implements ActivityAdapter {
  readonly agentType = 'opencode';
  
  private parser: JsonlParser;
  private sessionId: string;
  private eventCounter = 0;

  constructor(sessionId?: string) {
    this.parser = new JsonlParser();
    this.sessionId = sessionId || `session_${Date.now()}`;
  }

  /**
   * Check if this adapter supports the given agent type
   */
  supports(agentType: string): boolean {
    return agentType.toLowerCase() === 'opencode';
  }

  /**
   * Parse a chunk of OpenCode JSONL output
   * Returns normalized AG-UI events
   */
  parse(chunk: string): AGUIEvent[] {
    const events = this.parser.feed(chunk);
    
    // Attach session ID if not present
    for (const event of events) {
      if (!event.runId) {
        event.runId = this.sessionId;
      }
      if (!event.threadId) {
        event.threadId = this.sessionId;
      }
    }

    log.debug('Parsed OpenCode events', { 
      count: events.length,
      types: events.map(e => e.type).join(', ')
    });

    return events;
  }

  /**
   * Map AG-UI events to OpenSofa ActivityEvents
   */
  mapToActivityEvents(aguiEvents: AGUIEvent[], sessionName: string): ActivityEvent[] {
    return aguiEvents.map(event => mapAGUIToActivityEvent(event, sessionName));
  }

  /**
   * Parse and map in one step
   */
  parseAndMap(chunk: string, sessionName: string): ActivityEvent[] {
    const aguiEvents = this.parse(chunk);
    return this.mapToActivityEvents(aguiEvents, sessionName);
  }

  /**
   * Reset parser state for new session
   */
  reset(sessionId?: string): void {
    this.parser.reset();
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.eventCounter = 0;
  }

  /**
   * Get buffered content for debugging
   */
  getBuffer(): string {
    return this.parser.getBuffer();
  }
}

/**
 * Factory function to create OpenCode adapter
 */
export function createOpenCodeAdapter(sessionId?: string): OpenCodeAdapter {
  return new OpenCodeAdapter(sessionId);
}

/**
 * Register OpenCode adapter with a registry
 */
export function registerOpenCodeAdapter(registry: AdapterRegistry): void {
  registry.register(new OpenCodeAdapter());
}
