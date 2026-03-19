/**
 * OpenSofa - Path Expansion Utility
 *
 * Expands ~ to home directory in file paths.
 */
/**
 * Expand ~ to the user's home directory
 * @param filePath - Path that may start with ~
 * @returns Expanded absolute path
 */
export declare function expandPath(filePath: string): string;
/**
 * Get the default OpenSofa config directory
 * @returns Path to ~/.opensofa
 */
export declare function getConfigDir(): string;
/**
 * Get the default config file path
 * @returns Path to ~/.opensofa/config.yaml
 */
export declare function getConfigPath(): string;
/**
 * Get the default state file path
 * @returns Path to ~/.opensofa/state.json
 */
export declare function getStatePath(): string;
/**
 * Get the default database file path
 * @returns Path to ~/.opensofa/opensofa.db
 */
export declare function getDbPath(): string;
/**
 * Get the default auth directory path
 * @returns Path to ~/.opensofa/auth
 */
export declare function getAuthDir(): string;
export declare function getEnrichedPath(): string;
/**
 * Get process.env with the enriched PATH applied.
 * Use this when spawning child processes that need access to Go/user binaries.
 */
export declare function getEnrichedEnv(extra?: Record<string, string>): Record<string, string>;
//# sourceMappingURL=expand-path.d.ts.map