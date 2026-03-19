/**
 * OpenSofa Web - Terminal Stream Manager
 *
 * Manages real-time terminal streaming using tmux pipe-pane.
 * Each AgentAPI session gets its own tmux pane, which we pipe to a log file
 * and then tail -f to stream to WebSocket clients.
 */
import { ChildProcess } from 'child_process';
import { WebSocket } from 'ws';
/**
 * Get the log file path for a port
 */
export declare const getLogPath: (port: number) => string;
/**
 * Get the tmux session name for a port
 */
export declare const getTmuxSessionName: (port: number) => string;
/**
 * Build tmux pipe-pane command arguments
 */
export declare const buildPipeArgs: (sessionName: string, logPath: string) => string[];
/**
 * Build tmux unpipe command arguments
 */
export declare const buildUnpipeArgs: (sessionName: string) => string[];
/**
 * Build tail -f command arguments
 */
export declare const buildTailArgs: (logPath: string) => string[];
/**
 * Encode terminal data for WebSocket transmission
 */
export declare const encodeTerminalData: (data: Buffer) => string;
export interface TerminalProcessSpawner {
    spawnTmux: (args: string[]) => ChildProcess;
    spawnTail: (args: string[]) => ChildProcess;
    execTmux: (args: string[]) => void;
}
export declare const defaultTerminalSpawner: TerminalProcessSpawner;
export interface TerminalStream {
    start: (port: number) => void;
    stop: (port: number) => void;
    subscribe: (ws: WebSocket, port: number) => void;
    unsubscribe: (ws: WebSocket) => void;
    stopAll: () => void;
    isStreaming: (port: number) => boolean;
}
export interface TerminalStreamDeps {
    spawner?: TerminalProcessSpawner;
    onOutput?: (port: number, data: Buffer) => void;
}
export declare const createTerminalStream: (deps?: TerminalStreamDeps) => TerminalStream;
export declare const isTmuxAvailable: () => boolean;
//# sourceMappingURL=terminal-stream.d.ts.map