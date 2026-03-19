/**
 * OpenSofa - Config Manager
 *
 * Loads, validates, and provides access to ~/.opensofa/config.yaml
 * Based on LOW_LEVEL_DESIGN.md §4
 */
import type { OpenSofaConfig } from './types.js';
/**
 * Config Manager class
 * Singleton pattern - load once at startup, immutable at runtime
 */
export declare class ConfigManager {
    private config;
    private configPath;
    private constructor();
    /**
     * Load configuration from file
     * Creates default config if file doesn't exist
     * Throws if required fields are missing or values are invalid
     */
    static load(configPath?: string): ConfigManager;
    /**
     * Create default config file
     */
    private static createDefaultConfig;
    /**
     * Validate raw config and merge with defaults
     */
    private static validateAndMerge;
    /**
     * Get a config value by key
     */
    get<K extends keyof OpenSofaConfig>(key: K): OpenSofaConfig[K];
    /**
     * Get the full config object (read-only)
     */
    getAll(): Readonly<OpenSofaConfig>;
    /**
     * Get the config file path
     */
    getConfigPath(): string;
}
export declare function getConfig(): ConfigManager;
export declare function initConfig(configPath?: string): ConfigManager;
//# sourceMappingURL=config.d.ts.map