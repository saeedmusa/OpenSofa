/**
 * OpenSofa - Async Command Executor
 * 
 * Provides async command execution with timeout handling and circuit breaker pattern.
 * Replaces synchronous execFileSync with non-blocking execFile.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './logger.js';
import { getEnrichedEnv } from './expand-path.js';

const log = createLogger('async-executor');
const execFileAsync = promisify(execFile);

// ──────────────────────────────────────
// Constants
// ──────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60_000;

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

interface ExecuteOptions {
  timeout?: number;
  env?: Record<string, string>;
}

// ──────────────────────────────────────
// AsyncExecutor Class
// ──────────────────────────────────────

/**
 * Async command executor with circuit breaker pattern.
 * Prevents cascading failures and provides graceful degradation.
 */
export class AsyncExecutor {
  private breakers: Map<string, CircuitBreakerState> = new Map();

  /**
   * Execute a command asynchronously with timeout handling.
   * 
   * @param command - The command to execute
   * @param args - Arguments to pass to the command
   * @param options - Execution options (timeout, env)
   * @returns The stdout output, or empty string on error
   */
  async execute(
    command: string,
    args: string[],
    options?: ExecuteOptions
  ): Promise<string> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
    const env = options?.env ?? getEnrichedEnv();

    // Check circuit breaker
    if (!this.isAllowed(command)) {
      log.warn(`Circuit breaker open for command: ${command}`);
      return '';
    }

    try {
      const { stdout } = await execFileAsync(command, args, {
        encoding: 'utf-8',
        timeout,
        env,
      });

      // Reset circuit breaker on success
      this.recordSuccess(command);
      return stdout.trim();
    } catch (err) {
      this.recordFailure(command);
      log.warn(`Command failed: ${command} ${args.join(' ')}`, {
        error: String(err),
        timeout,
      });
      return '';
    }
  }

  /**
   * Get the current circuit breaker state for a command.
   */
  getCircuitState(command: string): CircuitBreakerState {
    return this.breakers.get(command) ?? {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
    };
  }

  /**
   * Reset the circuit breaker for a command.
   */
  resetCircuit(command: string): void {
    this.breakers.delete(command);
    log.debug(`Circuit breaker reset for: ${command}`);
  }

  /**
   * Check if command execution is allowed (circuit breaker check).
   */
  private isAllowed(command: string): boolean {
    const breaker = this.breakers.get(command);
    if (!breaker) return true;

    if (breaker.state === 'closed') return true;

    if (breaker.state === 'open') {
      // Check if reset timeout has elapsed
      const elapsed = Date.now() - breaker.lastFailure;
      if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
        breaker.state = 'half-open';
        log.debug(`Circuit breaker half-open for: ${command}`);
        return true;
      }
      return false;
    }

    // half-open state: allow one attempt
    return true;
  }

  /**
   * Record a successful command execution.
   */
  private recordSuccess(command: string): void {
    const breaker = this.breakers.get(command);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
    }
  }

  /**
   * Record a failed command execution.
   */
  private recordFailure(command: string): void {
    let breaker = this.breakers.get(command);
    if (!breaker) {
      breaker = { failures: 0, lastFailure: 0, state: 'closed' };
      this.breakers.set(command, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = 'open';
      log.warn(`Circuit breaker opened for: ${command} after ${breaker.failures} failures`);
    }
  }
}

// Export singleton instance for convenience
export const asyncExecutor = new AsyncExecutor();
