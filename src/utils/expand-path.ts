/**
 * OpenSofa - Path Expansion Utility
 * 
 * Expands ~ to home directory in file paths.
 */

import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Expand ~ to the user's home directory
 * @param filePath - Path that may start with ~
 * @returns Expanded absolute path
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Get the default OpenSofa config directory
 * @returns Path to ~/.opensofa
 */
export function getConfigDir(): string {
  return expandPath('~/.opensofa');
}

/**
 * Get the default config file path
 * @returns Path to ~/.opensofa/config.yaml
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.yaml');
}

/**
 * Get the default state file path
 * @returns Path to ~/.opensofa/state.json
 */
export function getStatePath(): string {
  return path.join(getConfigDir(), 'state.json');
}

/**
 * Get the default database file path
 * @returns Path to ~/.opensofa/opensofa.db
 */
export function getDbPath(): string {
  return path.join(getConfigDir(), 'opensofa.db');
}

/**
 * Get the default auth directory path
 * @returns Path to ~/.opensofa/auth
 */
export function getAuthDir(): string {
  return path.join(getConfigDir(), 'auth');
}

/**
 * Build an enriched PATH string that includes common binary directories
 * that may be missing when Node.js is launched from an IDE.
 * Appends ~/go/bin, ~/.local/bin, /usr/local/go/bin, and Homebrew paths.
 */
let enrichedPathCache: string | null = null;

export function getEnrichedPath(): string {
  if (enrichedPathCache) return enrichedPathCache;

  const home = os.homedir();
  const currentPath = process.env['PATH'] || '';
  const extraDirs = [
    path.join(home, 'go', 'bin'),
    path.join(home, '.local', 'bin'),
    path.join(home, '.opencode', 'bin'),
    '/usr/local/go/bin',
    '/usr/local/bin',
    '/opt/homebrew/bin',
  ];

  // Only add dirs that exist and aren't already in PATH
  const pathSet = new Set(currentPath.split(':'));
  const additions = extraDirs.filter(d => !pathSet.has(d) && fs.existsSync(d));

  enrichedPathCache = additions.length > 0
    ? `${currentPath}:${additions.join(':')}`
    : currentPath;

  return enrichedPathCache;
}

/**
 * Filter out placeholder API keys that should not be passed to child processes.
 * Examples: "sk-your-...", "sk-proj-placeholder", "AI...-placeholder"
 */
function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return (
    lower.includes('sk-your-') || 
    lower.includes('api-key-here') || 
    lower.includes('placeholder') ||
    lower === 'sk-********'
  );
}

/**
 * Get process.env with the enriched PATH applied.
 * Also filters out placeholder API keys to prevent them from interfering
 * with an agent's internal configuration.
 */
export function getEnrichedEnv(extra?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  
  // Copy process.env but skip placeholders
  for (const [key, val] of Object.entries(process.env)) {
    if (val && !isPlaceholder(val)) {
      env[key] = val;
    }
  }

  return {
    ...env,
    PATH: getEnrichedPath(),
    ...extra,
  };
}