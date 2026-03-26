import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

export interface ApiTimeoutConfig {
  timeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
}

export interface ApiTimeoutState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  isTimedOut: boolean;
  retryCount: number;
  progress: number;
}

export interface ApiTimeoutActions {
  cancel: () => void;
  retry: () => void;
}

export function useApiTimeout<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  config: ApiTimeoutConfig = {}
): [ApiTimeoutState<T>, ApiTimeoutActions] {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseRetryDelayMs = BASE_RETRY_DELAY_MS,
  } = config;

  const [state, setState] = useState<ApiTimeoutState<T>>({
    data: null,
    isLoading: false,
    error: null,
    isTimedOut: false,
    retryCount: 0,
    progress: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const execute = useCallback(
    async (retryCount: number = 0) => {
      cleanup();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        isTimedOut: false,
        retryCount,
        progress: 0,
      }));

      // Progress tracking
      const startTime = Date.now();
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.min((elapsed / timeoutMs) * 100, 99);
        setState((prev) => ({ ...prev, progress: progressPercent }));
      }, 100);

      // Timeout handling
      const timeoutId = setTimeout(() => {
        controller.abort();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isTimedOut: true,
          error: 'Request timed out',
          progress: 100,
        }));
        cleanup();
      }, timeoutMs);

      try {
        const result = await fetcherRef.current(controller.signal);
        clearTimeout(timeoutId);
        cleanup();

        setState({
          data: result,
          isLoading: false,
          error: null,
          isTimedOut: false,
          retryCount,
          progress: 100,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        cleanup();

        if (controller.signal.aborted) {
          // Abort was called (timeout or manual cancel)
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        // Auto-retry with exponential backoff
        if (retryCount < maxRetries) {
          const delay = baseRetryDelayMs * Math.pow(2, retryCount);
          setTimeout(() => execute(retryCount + 1), delay);
          return;
        }

        setState({
          data: null,
          isLoading: false,
          error: errorMessage,
          isTimedOut: false,
          retryCount,
          progress: 100,
        });
      }
    },
    [timeoutMs, maxRetries, baseRetryDelayMs, cleanup]
  );

  const cancel = useCallback(() => {
    cleanup();
    setState((prev) => ({
      ...prev,
      isLoading: false,
      error: 'Request cancelled',
      progress: 0,
    }));
  }, [cleanup]);

  const retry = useCallback(() => {
    execute(0);
  }, [execute]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return [state, { cancel, retry }];
}
