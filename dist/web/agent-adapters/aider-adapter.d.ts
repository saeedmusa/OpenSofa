/**
 * OpenSofa - Aider Agent Adapter
 *
 * Adapts Aider's --json output to AG-UI events.
 * Aider emits JSON events for various operations.
 */
import type { AGUIEvent } from '../ag-ui-events.js';
import type { ActivityEvent } from '../activity-parser.js';
import { type ActivityAdapter, type AdapterRegistry } from './mod.js';
/**
 * Aider adapter implementation
 * Parses Aider's JSON output and maps to AG-UI events
 */
export declare class AiderAdapter implements ActivityAdapter {
    readonly agentType = "aider";
    private sessionId;
    private toolCallCounter;
    constructor(sessionId?: string);
    /**
     * Check if this adapter supports the given agent type
     */
    supports(agentType: string): boolean;
    /**
     * Parse a chunk of Aider JSONL output
     * Returns normalized AG-UI events
     */
    parse(chunk: string): AGUIEvent[];
    /**
     * Map Aider event to AG-UI event
     */
    private mapAiderEvent;
    /**
     * Map AG-UI events to OpenSofa ActivityEvents
     */
    mapToActivityEvents(aguiEvents: AGUIEvent[], sessionName: string): ActivityEvent[];
    /**
     * Parse and map in one step
     */
    parseAndMap(chunk: string, sessionName: string): ActivityEvent[];
    /**
     * Reset adapter state
     */
    reset(sessionId?: string): void;
}
/**
 * Factory function to create Aider adapter
 */
export declare function createAiderAdapter(sessionId?: string): AiderAdapter;
/**
 * Register Aider adapter with a registry
 */
export declare function registerAiderAdapter(registry: AdapterRegistry): void;
//# sourceMappingURL=aider-adapter.d.ts.map