/**
 * OpenSofa - Safe Shell Execution Utilities
 *
 * Provides safe alternatives to execSync that prevent command injection.
 * Always use these functions instead of execSync with string interpolation.
 */
import { execFileSync } from 'child_process';
import { createLogger } from './logger.js';
const log = createLogger('safe-shell');
/**
 * Execute a command with arguments safely (no shell interpretation)
 * Use this for commands where all arguments are controlled
 */
export function safeExec(command, args, options = {}) {
    try {
        return execFileSync(command, args, {
            cwd: options.cwd,
            timeout: options.timeout,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch (err) {
        log.error('safeExec failed', { command, args, error: String(err) });
        throw err;
    }
}
/**
 * Execute a git command safely with array arguments
 */
export function safeGitExec(cwd, args, timeout = 30000) {
    return safeExec('git', ['-C', cwd, ...args], { timeout });
}
/**
 * Execute a tmux command safely with array arguments
 */
export function safeTmuxExec(args, timeout = 5000) {
    return safeExec('tmux', args, { timeout });
}
/**
 * Validate that a path is safe (no path traversal, no null bytes)
 */
export function isSafePath(filePath) {
    if (!filePath || filePath.includes('\0')) {
        return false;
    }
    // Prevent path traversal attempts
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.includes('..')) {
        return false;
    }
    return true;
}
/**
 * Validate that a filename is safe (no path components, no dangerous chars)
 */
export function isSafeFilename(filename) {
    if (!filename || filename.includes('\0')) {
        return false;
    }
    // Only allow alphanumeric, dash, underscore, dot
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return false;
    }
    // Prevent absolute paths
    if (filename.startsWith('/') || filename.startsWith('\\')) {
        return false;
    }
    return true;
}
//# sourceMappingURL=safe-shell.js.map