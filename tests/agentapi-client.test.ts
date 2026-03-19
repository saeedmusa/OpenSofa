/**
 * Tests for AgentAPI Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentAPIClient, AgentAPIError } from '../src/agentapi-client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AgentAPIClient', () => {
  const port = 3284;
  let client: AgentAPIClient;

  beforeEach(() => {
    client = new AgentAPIClient(port);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with correct base URL', () => {
      expect((client as unknown as { baseUrl: string }).baseUrl).toBe(`http://localhost:${port}`);
    });
  });

  describe('getStatus', () => {
    it('should return status on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ agent_type: 'claude', status: 'stable' }),
      });

      const result = await client.getStatus();

      expect(result).toEqual({ agent_type: 'claude', status: 'stable' });
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:${port}/status`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should throw AgentAPIError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      try {
        await client.getStatus();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentAPIError);
        expect((err as AgentAPIError).message).toContain('HTTP 500');
      }
    });
  });

  describe('sendUserMessage', () => {
    it('should send user message and return response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const result = await client.sendUserMessage('Hello, agent!');

      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:${port}/message`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Hello, agent!', type: 'user' }),
        })
      );
    });
  });

  describe('sendRaw', () => {
    it('should send raw input', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const result = await client.sendRaw('yes\n');

      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:${port}/message`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'yes\n', type: 'raw' }),
        })
      );
    });
  });

  describe('uploadFile', () => {
    it('should upload file and return response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, filePath: '/tmp/test.txt' }),
      });

      const buffer = Buffer.from('test content');
      const result = await client.uploadFile(buffer, 'test.txt', 'text/plain');

      expect(result).toEqual({ ok: true, filePath: '/tmp/test.txt' });
    });

    it('should throw on upload failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
      });

      const buffer = Buffer.from('test content');
      await expect(client.uploadFile(buffer, 'test.txt', 'text/plain')).rejects.toThrow(
        AgentAPIError
      );
    });
  });
});

describe('AgentAPIError', () => {
  it('should create error with message', () => {
    const error = new AgentAPIError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('AgentAPIError');
    expect(error.httpStatus).toBe(0);
  });

  it('should create error with httpStatus and userFriendlyMessage', () => {
    const error = new AgentAPIError('Test error', 404, 'Not found');
    expect(error.message).toBe('Test error');
    expect(error.httpStatus).toBe(404);
    expect(error.userFriendlyMessage).toBe('Not found');
  });

  describe('fromFetchError', () => {
    it('should detect connectivity errors', () => {
      const error = AgentAPIError.fromFetchError(new Error('fetch failed'));
      expect(error.userFriendlyMessage).toContain('not responding');
    });

    it('should detect ECONNREFUSED', () => {
      const error = AgentAPIError.fromFetchError(new Error('ECONNREFUSED'));
      expect(error.userFriendlyMessage).toContain('not responding');
    });

    it('should handle unknown errors', () => {
      const error = AgentAPIError.fromFetchError(new Error('unknown error'));
      expect(error.message).toContain('unknown error');
      expect(error.userFriendlyMessage).toBeUndefined();
    });
  });
});
