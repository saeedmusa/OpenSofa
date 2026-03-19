/**
 * OpenSofa - Safe Shell Execution Utilities
 * 
 * Provides safe alternatives to execSync that prevent command injection.
 * Always use these functions instead of execSync with string interpolation.
 */

import { execFileSync, execSync } from 'child_process';
import { createLogger } from './logger.js';

const log = createLogger('safe-shell');

/**
 * Execute a command with arguments safely (no shell interpretation)
 * Use this for commands where all arguments are controlled
 */
export function safeExec(command: string, args: string[], options: { cwd?: string; timeout?: number } = {}): string {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd,
      timeout: options.timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    log.error('safeExec failed', { command, args, error: String(err) });
    throw err;
  }
}

/**
 * Execute a git command safely with array arguments
 */
export function safeGitExec(cwd: string, args: string[], timeout = 30000): string {
  return safeExec('git', ['-C', cwd, ...args], { timeout });
}

/**
 * Execute a tmux command safely with array arguments
 */
export function safeTmuxExec(args: string[], timeout = 5000): string {
  return safeExec('tmux', args, { timeout });
}

/**
 * Execute a shell command with shell interpretation (USE SPARINGLY)
 * Only use when shell features (pipes, redirects) are required
 * All user input must be validated/whitelisted
 */
export function safeShell(command: string, options: { cwd?: string; timeout?: number } = {}): string {
  // Validate: only allow known-safe patterns
  const dangerousPatterns = [
    /[;&|`$]/,           // Shell metacharacters
    /\br\b/,              // word boundaries that could be commands
    /^\s*rm\s+-rf/i,    // Dangerous rm commands
    />\s*\//,           // Redirect to absolute path
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      throw new Error(`Unsafe shell command detected: ${command}`);
    }
  }
  
  try {
    return execSync(command, {
      cwd: options.cwd,
      timeout: options.timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/sh',  // Use explicit shell
    });
  } catch (err) {
    log.error('safeShell failed', { command, error: String(err) });
    throw err;
  }
}

/**
 * Validate that a path is safe (no path traversal, no null bytes)
 */
export function isSafePath(filePath: string): boolean {
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
export function isSafeFilename(filename: string): boolean {
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
