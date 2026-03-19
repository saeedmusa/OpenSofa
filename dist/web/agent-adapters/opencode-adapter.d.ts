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
import { type ActivityAdapter, type AdapterRegistry } from './mod.js';
import type { ActivityEvent } from '../activity-parser.js';
import type { AGUIEvent } from '../ag-ui-events.js';
/**
 * OpenCode-specific event types
 */
export type OpenCodeEventType = 'step_start' | 'step_finish' | 'text' | 'tool_use' | 'error';
/**
 * OpenCode adapter implementation
 * Parses OpenCode JSONL output and maps to AG-UI events
 */
export declare class OpenCodeAdapter implements ActivityAdapter {
    readonly agentType = "opencode";
    private parser;
    private sessionId;
    private eventCounter;
    constructor(sessionId?: string);
    /**
     * Check if this adapter supports the given agent type
     */
    supports(agentType: string): boolean;
    /**
     * Parse a chunk of OpenCode JSONL output
     * Returns normalized AG-UI events
     */
    parse(chunk: string): AGUIEvent[];
    /**
     * Map AG-UI events to OpenSofa ActivityEvents
     */
    mapToActivityEvents(aguiEvents: AGUIEvent[], sessionName: string): ActivityEvent[];
    /**
     * Parse and map in one step
     */
    parseAndMap(chunk: string, sessionName: string): ActivityEvent[];
    /**
     * Reset parser state for new session
     */
    reset(sessionId?: string): void;
    /**
     * Get buffered content for debugging
     */
    getBuffer(): string;
}
/**
 * Factory function to create OpenCode adapter
 */
export declare function createOpenCodeAdapter(sessionId?: string): OpenCodeAdapter;
/**
 * Register OpenCode adapter with a registry
 */
export declare function registerOpenCodeAdapter(registry: AdapterRegistry): void;
//# sourceMappingURL=opencode-adapter.d.ts.map