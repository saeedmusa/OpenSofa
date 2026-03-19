/**
 * OpenSofa - State Persistence
 *
 * Handles atomic read/write of session state to disk.
 * Implements .tmp → rename pattern for crash safety.
 * Based on LOW_LEVEL_DESIGN.md §13
 */
import type { PersistedState, Session } from './types.js';
/**
 * State Persistence class
 * Singleton - handles all state file I/O
 */
export declare class StatePersistence {
    private statePath;
    private tmpPath;
    private periodicSaveTimer;
    private serializeFn;
    constructor(serializeFn: () => PersistedState);
    /**
     * Load persisted state from disk
     * Returns empty state if file doesn't exist or is corrupted
     */
    load(): PersistedState;
    /**
     * Save state to disk (async, atomic write)
     */
    save(): Promise<void>;
    /**
     * Save state synchronously (for emergency shutdown)
     */
    saveSync(): void;
    /**
     * Create backup of current state file
     */
    backup(): void;
    /**
     * Start periodic state persistence (every 60s as per LLD §13)
     */
    startPeriodicSave(intervalMs?: number): void;
    /**
     * Stop periodic state persistence
     */
    stopPeriodicSave(): void;
    /**
     * Get the state file path
     */
    getStatePath(): string;
}
/**
 * Serialize sessions map to PersistedState
 */
export declare function serializeSessions(sessions: Map<string, Session>): PersistedState;
//# sourceMappingURL=state-persistence.d.ts.map