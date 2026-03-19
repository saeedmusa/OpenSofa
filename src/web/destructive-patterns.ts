/**
 * OpenSofa - Destructive Command Detection
 *
 * Regex patterns that identify dangerous shell commands.
 * Used by the approval flow to flag commands for visual warning
 * and future TOTP step-up authentication (US-13).
 *
 * Based on ARCHITECTURE_TARGET.md §1.3 and USER_STORIES.md US-13.
 */

export const DESTRUCTIVE_PATTERNS: RegExp[] = [
    /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*--force)/i,     // rm -rf, rm -f, rm --force
    /\brm\s+-[a-zA-Z]*r/i,                                // rm -r (recursive delete)
    /\bDROP\s+(TABLE|DATABASE|INDEX|SCHEMA)\b/i,           // SQL DROP
    /\bDELETE\s+FROM\b/i,                                  // SQL DELETE
    /\bTRUNCATE\s+TABLE\b/i,                               // SQL TRUNCATE
    /\bchmod\s+777\b/,                                     // World-writable permissions
    /\bcurl\s+.*\|\s*(ba)?sh\b/i,                          // Piped remote execution
    /\bwget\s+.*\|\s*(ba)?sh\b/i,                          // Piped remote execution
    /\bdd\s+if=/i,                                         // Raw disk write
    /\bmkfs\b/i,                                           // Format filesystem
    />\s*\/dev\//,                                         // Write to device file
    /\bsudo\s+rm\b/i,                                      // Privileged delete
    /:\(\)\s*\{.*:\|:.*&.*\}/,                            // Fork bomb
    /\bgit\s+push\s+.*[-]f\b/i,                           // Force push (-f)
    /\bgit\s+push\s+.*--force\b/i,                        // Force push (--force)
    /\bgit\s+reset\s+--hard\b/i,                          // Hard reset
];

/**
 * Check if a command string matches any destructive pattern.
 * @param command - The shell command or approval description to check
 * @returns true if the command is potentially destructive
 */
export function isDestructiveCommand(command: string): boolean {
    return DESTRUCTIVE_PATTERNS.some(pattern => pattern.test(command));
}

/**
 * Get a human-readable risk label for a destructive command.
 * @param command - The shell command to classify
 * @returns Risk label or null if not destructive
 */
export function getDestructiveLabel(command: string): string | null {
    if (/\brm\s/i.test(command)) return 'File Deletion';
    if (/\bDROP\b/i.test(command)) return 'Database Drop';
    if (/\bDELETE\s+FROM\b/i.test(command)) return 'Data Deletion';
    if (/\bTRUNCATE\b/i.test(command)) return 'Table Truncation';
    if (/\bchmod\s+777\b/.test(command)) return 'Unsafe Permissions';
    if (/\b(curl|wget)\s+.*\|\s*(ba)?sh\b/i.test(command)) return 'Remote Execution';
    if (/\bdd\s+if=/i.test(command)) return 'Raw Disk Write';
    if (/\bmkfs\b/i.test(command)) return 'Filesystem Format';
    if (/\bgit\s+push\s+.*[-]+force\b/i.test(command)) return 'Force Push';
    if (/\bgit\s+reset\s+--hard\b/i.test(command)) return 'Hard Reset';
    return null;
}
