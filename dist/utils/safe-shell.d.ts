/**
 * OpenSofa - Safe Shell Execution Utilities
 *
 * Provides safe alternatives to execSync that prevent command injection.
 * Always use these functions instead of execSync with string interpolation.
 */
/**
 * Execute a command with arguments safely (no shell interpretation)
 * Use this for commands where all arguments are controlled
 */
export declare function safeExec(command: string, args: string[], options?: {
    cwd?: string;
    timeout?: number;
}): string;
/**
 * Execute a git command safely with array arguments
 */
export declare function safeGitExec(cwd: string, args: string[], timeout?: number): string;
/**
 * Execute a tmux command safely with array arguments
 */
export declare function safeTmuxExec(args: string[], timeout?: number): string;
/**
 * Execute a shell command with shell interpretation (USE SPARINGLY)
 * Only use when shell features (pipes, redirects) are required
 * All user input must be validated/whitelisted
 */
export declare function safeShell(command: string, options?: {
    cwd?: string;
    timeout?: number;
}): string;
/**
 * Validate that a path is safe (no path traversal, no null bytes)
 */
export declare function isSafePath(filePath: string): boolean;
/**
 * Validate that a filename is safe (no path components, no dangerous chars)
 */
export declare function isSafeFilename(filename: string): boolean;
//# sourceMappingURL=safe-shell.d.ts.map