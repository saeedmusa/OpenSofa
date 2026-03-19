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
export function expandPath(filePath) {
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
export function getConfigDir() {
    return expandPath('~/.opensofa');
}
/**
 * Get the default config file path
 * @returns Path to ~/.opensofa/config.yaml
 */
export function getConfigPath() {
    return path.join(getConfigDir(), 'config.yaml');
}
/**
 * Get the default state file path
 * @returns Path to ~/.opensofa/state.json
 */
export function getStatePath() {
    return path.join(getConfigDir(), 'state.json');
}
/**
 * Get the default database file path
 * @returns Path to ~/.opensofa/opensofa.db
 */
export function getDbPath() {
    return path.join(getConfigDir(), 'opensofa.db');
}
/**
 * Get the default auth directory path
 * @returns Path to ~/.opensofa/auth
 */
export function getAuthDir() {
    return path.join(getConfigDir(), 'auth');
}
/**
 * Build an enriched PATH string that includes common binary directories
 * that may be missing when Node.js is launched from an IDE.
 * Appends ~/go/bin, ~/.local/bin, /usr/local/go/bin, and Homebrew paths.
 */
let enrichedPathCache = null;
export function getEnrichedPath() {
    if (enrichedPathCache)
        return enrichedPathCache;
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
 * Get process.env with the enriched PATH applied.
 * Use this when spawning child processes that need access to Go/user binaries.
 */
export function getEnrichedEnv(extra) {
    return {
        ...process.env,
        PATH: getEnrichedPath(),
        ...extra,
    };
}
//# sourceMappingURL=expand-path.js.map