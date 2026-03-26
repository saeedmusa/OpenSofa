/**
 * OpenSofa - Base Adapter
 * 
 * Base class providing common functionality for model discovery adapters.
 */

import { execFileSync } from 'child_process';
import { createLogger } from '../utils/logger.js';
import { getEnrichedPath, getEnrichedEnv } from '../utils/expand-path.js';
import { asyncExecutor } from '../utils/async-executor.js';
import type { AgentType } from '../types.js';
import type { ModelAdapter, ModelProvider, DiscoveredModel } from './types.js';

const log = createLogger('model-adapter');

// Timeout constants
const TIMEOUTS = {
  isAvailable: 5_000,     // 5s for `which`
  authList: 10_000,       // 10s for `opencode auth list`
  models: 30_000,         // 30s for `opencode models`
} as const;

/**
 * Base class for model discovery adapters.
 * Provides common functionality like binary availability checking,
 * command execution with proper PATH setup, and error handling.
 */
export abstract class BaseAdapter implements ModelAdapter {
  abstract readonly agent: AgentType;
  abstract readonly name: string;
  
  protected constructor() {
    // Base class constructor
  }
  
  /**
   * Check if the agent binary is available on PATH (async version).
   * Uses timeout to prevent blocking on slow systems.
   */
  async isAvailableAsync(): Promise<boolean> {
    try {
      const result = await asyncExecutor.execute('which', [this.getBinaryName()], {
        timeout: TIMEOUTS.isAvailable,
        env: { ...process.env as Record<string, string>, PATH: getEnrichedPath() },
      });
      
      if (result) {
        log.debug(`Agent binary found: ${this.getBinaryName()}`);
        return true;
      }
      return false;
    } catch {
      log.debug(`Agent binary not found: ${this.getBinaryName()}`);
      return false;
    }
  }
  
  /**
   * Check if the agent binary is available on PATH (sync version - deprecated).
   * @deprecated Use isAvailableAsync() instead for non-blocking execution
   */
  isAvailable(): boolean {
    try {
      execFileSync('which', [this.getBinaryName()], { 
        stdio: 'pipe', 
        env: { ...process.env, PATH: getEnrichedPath() } 
      });
      log.debug(`Agent binary found: ${this.getBinaryName()}`);
      return true;
    } catch {
      log.debug(`Agent binary not found: ${this.getBinaryName()}`);
      return false;
    }
  }
  
  /**
   * Get the binary name for this agent.
   * Override in subclass if different from agent type.
   */
  protected getBinaryName(): string {
    return this.agent;
  }
  
  /**
   * Execute a command and return the output.
   * Uses enriched PATH to find binaries.
   * 
   * @param command - The command to execute
   * @param args - Arguments to pass
   * @param timeout - Timeout in ms (default 30000)
   * @returns The stdout output, or empty string on error
   */
  protected executeCommand(command: string, args: string[], timeout = 30000): string {
    try {
      const output = execFileSync(command, args, {
        encoding: 'utf-8',
        timeout,
        env: getEnrichedEnv(),
        stdio: 'pipe',
      });
      return output.trim();
    } catch (err) {
      log.warn(`Command failed: ${command} ${args.join(' ')}`, { 
        error: String(err),
        agent: this.agent 
      });
      return '';
    }
  }
  
  /**
   * Execute a command asynchronously with timeout handling.
   * Uses AsyncExecutor for non-blocking execution.
   * 
   * @param command - The command to execute
   * @param args - Arguments to pass
   * @param timeout - Timeout in ms (default 30000)
   * @returns Promise resolving to stdout output, or empty string on error
   */
  protected async executeCommandAsync(command: string, args: string[], timeout = 30000): Promise<string> {
    return asyncExecutor.execute(command, args, {
      timeout,
      env: getEnrichedEnv(),
    });
  }
  
  /**
   * Execute a shell command safely using execFileSync.
   * Uses enriched PATH to find binaries.
   */
  protected executeShell(command: string, args: string[], timeout = 30000): string {
    try {
      const output = execFileSync(command, args, {
        encoding: 'utf-8',
        timeout,
        env: getEnrichedEnv(),
        stdio: 'pipe',
      });
      return output.trim();
    } catch (err) {
      log.warn(`Shell command failed: ${command} ${args.join(' ')}`, { 
        error: String(err),
        agent: this.agent 
      });
      return '';
    }
  }
  
  /**
   * Create a DiscoveredModel object with common fields.
   */
  protected createModel(
    id: string,
    name: string,
    provider: string,
    supportsVision = true,
    supportsImages = false,
  ): DiscoveredModel {
    return {
      id,
      name,
      provider,
      agent: this.agent,
      supportsVision,
      supportsImages,
    };
  }
  
  /**
   * Create a ModelProvider object.
   */
  protected createProvider(
    name: string,
    id: string,
    models: DiscoveredModel[],
    configured: boolean,
  ): ModelProvider {
    return {
      name,
      id,
      agent: this.agent,
      models,
      configured,
    };
  }
  
  /**
   * Abstract method to discover models - must be implemented by subclass.
   */
  abstract discoverModels(): Promise<ModelProvider[]>;
  
  /**
   * Get the default model for this agent.
   * Override in subclass if the agent has a concept of default model.
   */
  getDefaultModel(): string | undefined {
    return undefined;
  }
}
