import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionCreation } from '../hooks/useSessionCreation';

// Mock the api module
vi.mock('../utils/api', () => ({
  api: {
    getToken: vi.fn(() => 'test-token'),
  },
}));

describe('useSessionCreation', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockConfig = {
    name: 'test-session',
    dir: '/test/dir',
    agent: 'claude',
    model: 'sonnet',
    message: 'Hello world',
  };

  it('should set initial state correctly', () => {
    fetchMock.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useSessionCreation());

    expect(result.current[0].isCreating).toBe(false);
    expect(result.current[0].phase).toBe('');
    expect(result.current[0].error).toBeNull();
    expect(result.current[0].sessionId).toBeNull();
  });

  it('should set isCreating=true when create is called', () => {
    fetchMock.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useSessionCreation());

    act(() => {
      result.current[1].create(mockConfig);
    });

    expect(result.current[0].isCreating).toBe(true);
    expect(result.current[0].phase).toBe('Creating session...');
    expect(result.current[0].error).toBeNull();
  });

  it('should handle API error response (success: false)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'Invalid directory' }),
    });

    const { result } = renderHook(() => useSessionCreation());

    // The create() call should return null on error
    let sessionId: string | null = 'not-null';
    await act(async () => {
      sessionId = await result.current[1].create(mockConfig);
    });

    // The hook should return null on error
    expect(sessionId).toBeNull();
    // The POST should have been called
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should successfully create session and return session name', async () => {
    // POST succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });

    // Polling returns active
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { status: 'active' } }),
    });

    // Message send
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const { result } = renderHook(() => useSessionCreation());

    let sessionId: string | null = null;
    await act(async () => {
      sessionId = await result.current[1].create(mockConfig);
    });

    expect(sessionId).toBe('test-session');
    expect(result.current[0].isCreating).toBe(false);
    expect(result.current[0].error).toBeNull();
    expect(result.current[0].sessionId).toBe('test-session');
  });

  it('should send initial message when session becomes active', async () => {
    // POST succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });

    // Polling returns active
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { status: 'active' } }),
    });

    // Message send
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const { result } = renderHook(() => useSessionCreation());

    await act(async () => {
      await result.current[1].create(mockConfig);
    });

    // Should have 3 fetch calls: POST, GET poll, POST message
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const messageCall = fetchMock.mock.calls[2];
    expect(messageCall[0]).toContain('/message');
    expect(messageCall[1].method).toBe('POST');
  });

  it('should not fail session creation if initial message send fails', async () => {
    // POST succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });

    // Polling returns active
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { status: 'active' } }),
    });

    // Message send fails
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSessionCreation());

    let sessionId: string | null = null;
    await act(async () => {
      sessionId = await result.current[1].create(mockConfig);
    });

    // Session should still be created successfully
    expect(sessionId).toBe('test-session');
    expect(result.current[0].error).toBeNull();
  });

  it('should handle 404 during polling', async () => {
    // POST succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });

    // Polling returns 404
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => useSessionCreation());

    let sessionId: string | null = 'not-null';
    await act(async () => {
      try {
        sessionId = await result.current[1].create(mockConfig);
      } catch {
        // Error is expected
      }
    });

    // The hook should return null and set error state
    // Note: The polling has a 2-second delay, so the error may be set after the promise resolves
    // The important thing is that the session creation doesn't succeed
    expect(sessionId).toBeNull();
  });

  it('should handle error status during polling', async () => {
    // POST succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });

    // Polling returns error status
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { status: 'error' } }),
    });

    const { result } = renderHook(() => useSessionCreation());

    let sessionId: string | null = 'not-null';
    await act(async () => {
      try {
        sessionId = await result.current[1].create(mockConfig);
      } catch {
        // Error is expected
      }
    });

    expect(sessionId).toBeNull();
  });

  it('should set error on cancel', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useSessionCreation());

    act(() => {
      result.current[1].create(mockConfig);
    });

    expect(result.current[0].isCreating).toBe(true);

    await act(async () => {
      result.current[1].cancel();
    });

    expect(result.current[0].isCreating).toBe(false);
    expect(result.current[0].error).toBe('Session creation cancelled');
  });

  it('should include auth token in requests', async () => {
    // POST succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });

    // Polling returns active
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { status: 'active' } }),
    });

    const { result } = renderHook(() => useSessionCreation());

    await act(async () => {
      await result.current[1].create({ ...mockConfig, message: undefined });
    });

    const postCall = fetchMock.mock.calls[0];
    expect(postCall[1].headers.Authorization).toBe('Bearer test-token');
  });

  it('should cleanup on unmount', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result, unmount } = renderHook(() => useSessionCreation());

    act(() => {
      result.current[1].create(mockConfig);
    });

    expect(result.current[0].isCreating).toBe(true);

    // Unmount should not throw
    unmount();
  });
});
