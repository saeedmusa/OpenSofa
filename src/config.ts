/**
 * OpenSofa - Config Manager
 * 
 * Loads, validates, and provides access to ~/.opensofa/config.yaml
 * Based on LOW_LEVEL_DESIGN.md §4
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { expandPath, getConfigDir, getConfigPath } from './utils/expand-path.js';
import { createLogger } from './utils/logger.js';
import type { OpenSofaConfig, AgentType } from './types.js';

const log = createLogger('config');

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: OpenSofaConfig = {
  defaultAgent: 'claude',
  maxSessions: 5,
  portRangeStart: 3284,
  debounceMs: 3000,
  screenshotIntervalMs: 10000,
  approvalTimeoutMs: 300000,
  healthCheckIntervalMs: 30000,
  idleTimeoutMs: 600000,
  screenshotFontSize: 14,
  screenshotCols: 80,
  autoApprove: false,
  projectDirs: ['~/development', '~/projects'],
  autoCleanupOnCritical: true,
  ntfyTopic: null,
};

/**
 * Valid agent types for validation
 */
const VALID_AGENTS: AgentType[] = [
  'claude', 'aider', 'goose', 'gemini', 'codex', 'amp',
  'opencode', 'copilot', 'cursor', 'auggie', 'amazonq', 'custom'
];

/**
 * Config Manager class
 * Singleton pattern - load once at startup, immutable at runtime
 */
export class ConfigManager {
  private config: OpenSofaConfig;
  private configPath: string;

  private constructor(config: OpenSofaConfig, configPath: string) {
    this.config = config;
    this.configPath = configPath;
  }

  /**
   * Load configuration from file
   * Creates default config if file doesn't exist
   * Throws if required fields are missing or values are invalid
   */
  static load(configPath?: string): ConfigManager {
    const resolvedPath = configPath ? expandPath(configPath) : getConfigPath();
    const configDir = path.dirname(resolvedPath);

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      log.info(`Creating config directory: ${configDir}`);
      fs.mkdirSync(configDir, { recursive: true });
    }

    // If config file doesn't exist, create it with defaults
    if (!fs.existsSync(resolvedPath)) {
      log.info(`Creating default config file: ${resolvedPath}`);
      ConfigManager.createDefaultConfig(resolvedPath);
      log.info(`Config file created at ${resolvedPath}. Using defaults.`);
    }

    // Load and parse YAML
    let rawConfig: Record<string, unknown>;
    try {
      const fileContents = fs.readFileSync(resolvedPath, 'utf-8');
      rawConfig = yaml.load(fileContents) as Record<string, unknown>;
    } catch (err) {
      const error = err as Error;
      log.error(`Failed to parse config file: ${error.message}`);
      throw new Error(`Failed to parse config file ${resolvedPath}: ${error.message}`);
    }

    // Validate and merge with defaults
    const config = ConfigManager.validateAndMerge(rawConfig);

    log.info(`Configuration loaded from ${resolvedPath}`);
    return new ConfigManager(config, resolvedPath);
  }

  /**
   * Create default config file
   */
  private static createDefaultConfig(configPath: string): void {
    const defaultYaml = `# OpenSofa Configuration (Web-Only)

# Default coding agent to use when not specified
# Options: claude, aider, goose, gemini, codex, amp, opencode, copilot, cursor, auggie, amazonq, custom
defaultAgent: "claude"

# Maximum concurrent coding sessions
maxSessions: 5

# Starting port for AgentAPI instances (each session gets port + N)
portRangeStart: 3284

# Message delivery debounce window (milliseconds)
debounceMs: 3000

# Screenshot capture interval while agent is running (milliseconds)
screenshotIntervalMs: 10000

# Auto-reject approval after this timeout (milliseconds, 0 = disabled)
approvalTimeoutMs: 300000

# Health check interval for AgentAPI instances (milliseconds)
healthCheckIntervalMs: 30000

# Flag session as idle after this period of inactivity (milliseconds)
idleTimeoutMs: 600000

# Terminal screenshot font size (pixels)
screenshotFontSize: 14

# Terminal screenshot column width
screenshotCols: 80

# Global auto-approve setting (can be overridden per-session)
autoApprove: false

# Directories to scan for git repos when using /new wizard
projectDirs:
  - "~/development"
  - "~/projects"

# Auto-stop idle sessions when resources are critically low
autoCleanupOnCritical: true

# Optional ntfy.sh topic for push notifications
ntfyTopic: null
`;

    fs.writeFileSync(configPath, defaultYaml, 'utf-8');
  }

  /**
   * Validate raw config and merge with defaults
   */
  private static validateAndMerge(raw: Record<string, unknown>): OpenSofaConfig {

    // Validate optional fields
    if (raw['defaultAgent'] && !VALID_AGENTS.includes(raw['defaultAgent'] as AgentType)) {
      throw new Error(
        `Invalid 'defaultAgent': ${raw['defaultAgent']}\n` +
        `Valid options: ${VALID_AGENTS.join(', ')}`
      );
    }

    if (raw['maxSessions'] !== undefined) {
      const max = raw['maxSessions'] as number;
      if (typeof max !== 'number' || max < 1 || max > 10) {
        throw new Error(`'maxSessions' must be a number between 1 and 10. Got: ${max}`);
      }
    }

    if (raw['portRangeStart'] !== undefined) {
      const port = raw['portRangeStart'] as number;
      if (typeof port !== 'number' || port < 1024 || port > 65535) {
        throw new Error(`'portRangeStart' must be a valid port number (1024-65535). Got: ${port}`);
      }
    }

    // Validate positive integers for duration/size fields
    const positiveIntFields = [
      'debounceMs', 'screenshotIntervalMs', 'approvalTimeoutMs',
      'healthCheckIntervalMs', 'idleTimeoutMs'
    ];
    
    for (const field of positiveIntFields) {
      if (raw[field] !== undefined) {
        const value = raw[field] as number;
        if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
          throw new Error(`'${field}' must be a non-negative integer. Got: ${value}`);
        }
      }
    }
    
    // Validate screenshot-specific fields (positive integers with reasonable bounds)
    if (raw['screenshotFontSize'] !== undefined) {
      const value = raw['screenshotFontSize'] as number;
      if (typeof value !== 'number' || value < 8 || value > 72 || !Number.isInteger(value)) {
        throw new Error(`'screenshotFontSize' must be an integer between 8 and 72. Got: ${value}`);
      }
    }
    
    if (raw['screenshotCols'] !== undefined) {
      const value = raw['screenshotCols'] as number;
      if (typeof value !== 'number' || value < 40 || value > 200 || !Number.isInteger(value)) {
        throw new Error(`'screenshotCols' must be an integer between 40 and 200. Got: ${value}`);
      }
    }
    
    // Merge with defaults
    const config: OpenSofaConfig = {
      defaultAgent: (raw['defaultAgent'] as AgentType) ?? DEFAULT_CONFIG.defaultAgent,
      maxSessions: (raw['maxSessions'] as number) ?? DEFAULT_CONFIG.maxSessions,
      portRangeStart: (raw['portRangeStart'] as number) ?? DEFAULT_CONFIG.portRangeStart,
      debounceMs: (raw['debounceMs'] as number) ?? DEFAULT_CONFIG.debounceMs,
      screenshotIntervalMs: (raw['screenshotIntervalMs'] as number) ?? DEFAULT_CONFIG.screenshotIntervalMs,
      approvalTimeoutMs: (raw['approvalTimeoutMs'] as number) ?? DEFAULT_CONFIG.approvalTimeoutMs,
      healthCheckIntervalMs: (raw['healthCheckIntervalMs'] as number) ?? DEFAULT_CONFIG.healthCheckIntervalMs,
      idleTimeoutMs: (raw['idleTimeoutMs'] as number) ?? DEFAULT_CONFIG.idleTimeoutMs,
      screenshotFontSize: (raw['screenshotFontSize'] as number) ?? DEFAULT_CONFIG.screenshotFontSize,
      screenshotCols: (raw['screenshotCols'] as number) ?? DEFAULT_CONFIG.screenshotCols,
      autoApprove: (raw['autoApprove'] as boolean) ?? DEFAULT_CONFIG.autoApprove,
      projectDirs: Array.isArray(raw['projectDirs'])
        ? (raw['projectDirs'] as string[]).filter(d => typeof d === 'string')
        : DEFAULT_CONFIG.projectDirs,
      autoCleanupOnCritical: (raw['autoCleanupOnCritical'] as boolean) ?? DEFAULT_CONFIG.autoCleanupOnCritical,
      ntfyTopic: raw['ntfyTopic'] ? String(raw['ntfyTopic']) : DEFAULT_CONFIG.ntfyTopic,
    };

    return config;
  }

  /**
   * Get a config value by key
   */
  get<K extends keyof OpenSofaConfig>(key: K): OpenSofaConfig[K] {
    return this.config[key];
  }

  /**
   * Get the full config object (read-only)
   */
  getAll(): Readonly<OpenSofaConfig> {
    return { ...this.config };
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

}

// Export singleton getter
let configInstance: ConfigManager | null = null;

export function getConfig(): ConfigManager {
  if (!configInstance) {
    throw new Error('Config not initialized. Call ConfigManager.load() first.');
  }
  return configInstance;
}

export function initConfig(configPath?: string): ConfigManager {
  configInstance = ConfigManager.load(configPath);
  return configInstance;
}