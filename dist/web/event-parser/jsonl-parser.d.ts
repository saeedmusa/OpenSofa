/**
 * OpenSofa - JSONL Parser
 *
 * Parses JSONL (newline-delimited JSON) from agent stdout.
 * Each line is a complete JSON object representing an event.
 */
import { AGUIEvent } from '../ag-ui-events.js';
declare function generateEventId(): string;
/**
 * JSONL Parser class
 * Handles streaming JSONL input from agents
 */
export declare class JsonlParser {
    private buffer;
    /**
     * Feed a chunk of data and get parsed events
     */
    feed(chunk: string): AGUIEvent[];
    /**
     * Parse a single line of JSONL
     */
    private parseLine;
    /**
     * Get the current buffer (for debugging)
     */
    getBuffer(): string;
    /**
     * Clear the buffer
     */
    reset(): void;
}
/**
 * Parse a single JSONL line (standalone function)
 */
export declare function parseJsonlLine(line: string): AGUIEvent | null;
/**
 * Generate a unique event ID
 */
export { generateEventId };
//# sourceMappingURL=jsonl-parser.d.ts.map