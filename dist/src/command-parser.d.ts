/**
 * OpenSofa - Command Parser
 *
 * Parses / prefixed commands using regex pattern matching.
 * Zero LLM cost - pure regex-based parsing.
 * Based on LOW_LEVEL_DESIGN.md §6
 */
import type { ControlCommand, SessionCommand, AgentType } from './types.js';
/**
 * Command Parser class
 * Stateless - pure function: string in → parsed command out
 */
export declare class CommandParser {
    private defaultAgent;
    constructor(defaultAgent: AgentType);
    /**
     * Parse a control plane command from direct chat
     * @param text - The message text to parse
     * @returns Parsed command or null if not a command
     */
    parseControlCommand(text: string): ControlCommand | null;
    /**
     * Parse a session command from group chat
     * @param text - The message text to parse
     * @returns Parsed command or null if not a command
     */
    parseSessionCommand(text: string): SessionCommand | null;
    /**
     * Get help text for control plane commands
     */
    getHelpText(): string;
    /**
     * Get help text for session commands only
     */
    getSessionHelpText(): string;
}
/**
 * Check if text starts with / (potential command)
 */
export declare function isCommand(text: string): boolean;
//# sourceMappingURL=command-parser.d.ts.map