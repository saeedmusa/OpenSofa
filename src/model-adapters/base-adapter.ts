/**
 * OpenSofa - Base Adapter
 * 
 * Base class providing common functionality for model discovery adapters.
 */

import { execFileSync } from 'child_process';
import { createLogger } from '../utils/logger.js';
import { getEnrichedPath, getEnrichedEnv } from '../utils/expand-path.js';
import type { AgentType } from '../types.js';
import type { ModelAdapter, ModelProvider, DiscoveredModel } from './types.js';

const log = createLogger('model-adapter');

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
   * Check if the agent binary is available on PATH
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
   * Execute a shell command using execSync.
   * Uses enriched PATH to find binaries.
   */
  protected executeShell(command: string, timeout = 30000): string {
    const { execSync } = require('child_process');
    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        timeout,
        env: getEnrichedEnv(),
        stdio: 'pipe',
      });
      return output.trim();
    } catch (err) {
      log.warn(`Shell command failed: ${command}`, { 
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
  ): DiscoveredModel {
    return {
      id,
      name,
      provider,
      agent: this.agent,
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
