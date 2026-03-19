/**
 * OpenSofa - Destructive Command Detection
 *
 * Regex patterns that identify dangerous shell commands.
 * Used by the approval flow to flag commands for visual warning
 * and future TOTP step-up authentication (US-13).
 *
 * Based on ARCHITECTURE_TARGET.md §1.3 and USER_STORIES.md US-13.
 */
export declare const DESTRUCTIVE_PATTERNS: RegExp[];
/**
 * Check if a command string matches any destructive pattern.
 * @param command - The shell command or approval description to check
 * @returns true if the command is potentially destructive
 */
export declare function isDestructiveCommand(command: string): boolean;
/**
 * Get a human-readable risk label for a destructive command.
 * @param command - The shell command to classify
 * @returns Risk label or null if not destructive
 */
export declare function getDestructiveLabel(command: string): string | null;
//# sourceMappingURL=destructive-patterns.d.ts.map