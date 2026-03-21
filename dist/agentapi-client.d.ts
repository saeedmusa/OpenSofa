/**
 * OpenSofa - AgentAPI Client
 *
 * Encapsulates all HTTP communication with AgentAPI instances.
 * One client per session — constructed with the session's port.
 * Centralises error handling, retry logic, and user-friendly messages.
 */
import type { AgentAPIMessage, AgentAPIMessageResponse, AgentAPIStatusResponse, AgentAPIUploadResponse } from './types.js';
import EventSource from 'eventsource';
export declare class AgentAPIClient {
    private readonly port;
    private readonly baseUrl;
    constructor(port: number);
    /**
     * Poll the agent's current status.
     * Returns 'stable' | 'running', or throws on connectivity failure.
     */
    getStatus(timeoutMs?: number): Promise<AgentAPIStatusResponse>;
    /**
     * Send a user-typed prompt to the agent.
     * Agent **must** be stable; AgentAPI returns an error otherwise.
     */
    sendUserMessage(content: string): Promise<AgentAPIMessageResponse>;
    /**
     * Send raw keystrokes (e.g. "yes\n" for approval, "\x03" for Ctrl-C).
     * Works regardless of agent status — not recorded in conversation history.
     */
    sendRaw(content: string): Promise<AgentAPIMessageResponse>;
    /**
     * Fetch the full conversation history from AgentAPI.
     * Returns all messages (user + agent) in chronological order.
     */
    getMessages(): Promise<{
        messages: AgentAPIMessage[];
    }>;
    /**
     * Connect to the AgentAPI event stream.
     * Returns an EventSource instance that the caller can listen to.
     */
    listenEvents(): EventSource;
    /**
     * Upload a file to AgentAPI. Returns the server-side file path.
     * Max 10 MB (enforced by AgentAPI).
     */
    uploadFile(buffer: Buffer, fileName: string, mimeType: string): Promise<AgentAPIUploadResponse>;
    /**
     * Poll /status until it responds OK, up to `timeoutMs`.
     * Optionally accepts a process-liveness probe so callers can fail fast
     * if AgentAPI exits before becoming ready.
     */
    waitUntilReady(timeoutMs?: number, intervalMs?: number, isProcessAlive?: () => boolean): Promise<void>;
    private postMessage;
    /**
     * Turn an HTTP status code into a user-friendly explanation.
     */
    private classifyHttpError;
}
export declare class AgentAPIError extends Error {
    readonly httpStatus: number;
    readonly userFriendlyMessage?: string | undefined;
    constructor(message: string, httpStatus?: number, userFriendlyMessage?: string | undefined);
    static fromFetchError(err: unknown): AgentAPIError;
}
//# sourceMappingURL=agentapi-client.d.ts.map