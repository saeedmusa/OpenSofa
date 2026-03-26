/**
 * OpenSofa - AgentAPI Client
 *
 * Encapsulates all HTTP communication with AgentAPI instances.
 * One client per session — constructed with the session's port.
 * Centralises error handling, retry logic, and user-friendly messages.
 */

import { createLogger } from './utils/logger.js';
import type {
  AgentAPIMessage,
  AgentAPIMessageRequest,
  AgentAPIMessageResponse,
  AgentAPIStatusResponse,
  AgentAPIUploadResponse,
} from './types.js';
import EventSource from 'eventsource';

const log = createLogger('agentapi-client');

const DEFAULT_TIMEOUT_MS = 10_000;

export class AgentAPIClient {
  private readonly baseUrl: string;

  constructor(private readonly port: number) {
    this.baseUrl = `http://localhost:${port}`;
  }

  // ── Status ────────────────────────────────────────────

  /**
   * Poll the agent's current status.
   * Returns 'stable' | 'running', or throws on connectivity failure.
   */
  async getStatus(timeoutMs = 5000): Promise<AgentAPIStatusResponse> {
    const res = await fetch(`${this.baseUrl}/status`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new AgentAPIError(`HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as AgentAPIStatusResponse;
  }

  // ── Messages ──────────────────────────────────────────

  /**
   * Send a user-typed prompt to the agent.
   * Agent **must** be stable; AgentAPI returns an error otherwise.
   */
  async sendUserMessage(content: string): Promise<AgentAPIMessageResponse> {
    return this.postMessage({ content, type: 'user' });
  }

  /**
   * Send raw keystrokes (e.g. "yes\n" for approval, "\x03" for Ctrl-C).
   * Works regardless of agent status — not recorded in conversation history.
   */
  async sendRaw(content: string): Promise<AgentAPIMessageResponse> {
    return this.postMessage({ content, type: 'raw' });
  }

  /**
   * Fetch the full conversation history from AgentAPI.
   * Returns all messages (user + agent) in chronological order.
   */
  async getMessages(): Promise<{ messages: AgentAPIMessage[] }> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new AgentAPIError(`HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as { messages: AgentAPIMessage[] };
  }

  // ── Server-Sent Events (SSE) ────────────────────────────────

  /**
   * Connect to the AgentAPI event stream.
   * Returns an EventSource instance that the caller can listen to.
   */
  listenEvents(): EventSource {
    const url = `${this.baseUrl}/events`;
    log.info('Connecting to AgentAPI event stream', { url });
    return new EventSource(url);
  }

  // ── File Upload ───────────────────────────────────────

  /**
   * Upload a file to AgentAPI. Returns the server-side file path.
   * Max 10 MB (enforced by AgentAPI).
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<AgentAPIUploadResponse> {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }), fileName);

    const res = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new AgentAPIError(`Upload failed: HTTP ${res.status}`, res.status);
    }

    return (await res.json()) as AgentAPIUploadResponse;
  }

  // ── Health Check ──────────────────────────────────────

  /**
   * Poll /status until it responds OK, up to `timeoutMs`.
   * Optionally accepts a process-liveness probe so callers can fail fast
   * if AgentAPI exits before becoming ready.
   * Supports progress callback and exponential backoff.
   */
  async waitUntilReady(
    timeoutMs = 30_000,
    intervalMs = 500,
    isProcessAlive?: () => boolean,
    onProgress?: (elapsedMs: number, lastError: string) => void,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const startTime = Date.now();
    let lastError = '';
    let currentInterval = intervalMs;

    while (Date.now() < deadline) {
      if (isProcessAlive && !isProcessAlive()) {
        throw new AgentAPIError(
          'Health check failed: AgentAPI process exited before becoming ready.',
          0,
          'AgentAPI exited during startup. Check agent installation, API keys, and first-time setup.',
        );
      }

      try {
        const res = await fetch(`${this.baseUrl}/status`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) return;

        const responseText = await res.text().catch(() => '');
        lastError = `HTTP ${res.status}${responseText ? `: ${responseText.slice(0, 160)}` : ''}`;
      } catch (err) {
        lastError = String(err);
      }

      // Report progress
      onProgress?.(Date.now() - startTime, lastError);

      await new Promise(r => setTimeout(r, currentInterval));

      // Exponential backoff: 500ms → 1s → 2s → 5s (cap)
      currentInterval = Math.min(currentInterval * 2, 5000);
    }

    throw new AgentAPIError(
      `Health check timeout after ${timeoutMs}ms${lastError ? ` (last error: ${lastError})` : ''}`,
      0,
      'AgentAPI did not become ready in time. Check CLI auth/setup and try again.',
    );
  }

  // ── Internals ─────────────────────────────────────────

  private async postMessage(
    body: AgentAPIMessageRequest,
  ): Promise<AgentAPIMessageResponse> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (err) {
      throw AgentAPIError.fromFetchError(err);
    }

    if (!res.ok) {
      // Parse the error body for a better message
      let detail = `HTTP ${res.status}`;
      try {
        const errBody = (await res.json()) as { detail?: string };
        if (errBody.detail) detail = errBody.detail;
      } catch {
        // Ignore parse failures
      }
      throw new AgentAPIError(detail, res.status, this.classifyHttpError(res.status, body.type));
    }

    return (await res.json()) as AgentAPIMessageResponse;
  }

  /**
   * Turn an HTTP status code into a user-friendly explanation.
   */
  private classifyHttpError(status: number, msgType: 'user' | 'raw'): string {
    if (msgType === 'user' && (status === 409 || status === 422 || status === 400)) {
      return 'Agent is currently busy processing. Please wait for it to finish, then try again.';
    }
    if (status === 404) {
      return 'AgentAPI endpoint not found. The agent may have crashed — try /restart.';
    }
    if (status >= 500) {
      return 'AgentAPI internal error. Try /restart if this persists.';
    }
    return `Unexpected error (HTTP ${status}).`;
  }
}

// ── Error class ───────────────────────────────────────

export class AgentAPIError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number = 0,
    public readonly userFriendlyMessage?: string,
  ) {
    super(message);
    this.name = 'AgentAPIError';
  }

  static fromFetchError(err: unknown): AgentAPIError {
    const raw = String(err);
    const isConnectivity =
      /fetch failed|ECONNREFUSED|ENOTFOUND|timed out|AbortError/i.test(raw);

    return new AgentAPIError(
      raw,
      0,
      isConnectivity
        ? 'AgentAPI not responding. Try /restart or /stop then create a new session.'
        : undefined,
    );
  }
}
