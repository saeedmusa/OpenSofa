/**
 * OpenSofa - Base Adapter
 *
 * Base class providing common functionality for model discovery adapters.
 */
import { execFileSync } from 'child_process';
import { createLogger } from '../utils/logger.js';
import { getEnrichedPath, getEnrichedEnv } from '../utils/expand-path.js';
const log = createLogger('model-adapter');
/**
 * Base class for model discovery adapters.
 * Provides common functionality like binary availability checking,
 * command execution with proper PATH setup, and error handling.
 */
export class BaseAdapter {
    constructor() {
        // Base class constructor
    }
    /**
     * Check if the agent binary is available on PATH
     */
    isAvailable() {
        try {
            execFileSync('which', [this.getBinaryName()], {
                stdio: 'pipe',
                env: { ...process.env, PATH: getEnrichedPath() }
            });
            log.debug(`Agent binary found: ${this.getBinaryName()}`);
            return true;
        }
        catch {
            log.debug(`Agent binary not found: ${this.getBinaryName()}`);
            return false;
        }
    }
    /**
     * Get the binary name for this agent.
     * Override in subclass if different from agent type.
     */
    getBinaryName() {
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
    executeCommand(command, args, timeout = 30000) {
        try {
            const output = execFileSync(command, args, {
                encoding: 'utf-8',
                timeout,
                env: getEnrichedEnv(),
                stdio: 'pipe',
            });
            return output.trim();
        }
        catch (err) {
            log.warn(`Command failed: ${command} ${args.join(' ')}`, {
                error: String(err),
                agent: this.agent
            });
            return '';
        }
    }
    /**
     * Execute a shell command safely using execFileSync.
     * Uses enriched PATH to find binaries.
     */
    executeShell(command, args, timeout = 30000) {
        try {
            const output = execFileSync(command, args, {
                encoding: 'utf-8',
                timeout,
                env: getEnrichedEnv(),
                stdio: 'pipe',
            });
            return output.trim();
        }
        catch (err) {
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
    createModel(id, name, provider, supportsVision = true, supportsImages = false) {
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
    createProvider(name, id, models, configured) {
        return {
            name,
            id,
            agent: this.agent,
            models,
            configured,
        };
    }
    /**
     * Get the default model for this agent.
     * Override in subclass if the agent has a concept of default model.
     */
    getDefaultModel() {
        return undefined;
    }
}
//# sourceMappingURL=base-adapter.js.map