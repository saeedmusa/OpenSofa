import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../utils/api';

const SESSION_CREATION_TIMEOUT_MS = 120000; // 2 minutes
const POST_TIMEOUT_MS = 30000; // 30 seconds for POST
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;
const MAX_CONSECUTIVE_FAILURES = 10;

export interface SessionCreationConfig {
  name: string;
  dir: string;
  agent: string;
  model?: string;
  message?: string;
}

export interface SessionCreationState {
  isCreating: boolean;
  phase: string;
  progress: number;
  error: string | null;
  isTimedOut: boolean;
  sessionId: string | null;
}

export interface SessionCreationActions {
  create: (config: SessionCreationConfig) => Promise<string | null>;
  cancel: () => void;
  retry: () => void;
}

export function useSessionCreation(): [SessionCreationState, SessionCreationActions] {
  const [state, setState] = useState<SessionCreationState>({
    isCreating: false,
    phase: '',
    progress: 0,
    error: null,
    isTimedOut: false,
    sessionId: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const configRef = useRef<SessionCreationConfig | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const create = useCallback(
    async (config: SessionCreationConfig): Promise<string | null> => {
      cleanup();
      configRef.current = config;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState({
        isCreating: true,
        phase: 'Starting session...',
        progress: 0,
        error: null,
        isTimedOut: false,
        sessionId: null,
      });

      // Overall timeout
      timeoutRef.current = setTimeout(() => {
        controller.abort();
        setState((prev) => ({
          ...prev,
          isCreating: false,
          isTimedOut: true,
          error: 'Session creation timed out',
          progress: 100,
        }));
      }, SESSION_CREATION_TIMEOUT_MS);

      try {
        // Step 1: Create session with per-request timeout
        setState((prev) => ({ ...prev, phase: 'Creating session...', progress: 10 }));
        const token = api.getToken();

        // Combine global abort with POST-specific timeout
        const postController = new AbortController();
        const postTimeout = setTimeout(() => postController.abort(), POST_TIMEOUT_MS);

        // Race between global abort and POST timeout
        const combinedSignal = controller.signal;

        let res: Response;
        try {
          res = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(config),
            signal: combinedSignal,
          });
        } finally {
          clearTimeout(postTimeout);
        }

        const result = await res.json().catch(() => {
          throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to create session');
        }

        // Step 2: Poll for session readiness
        setState((prev) => ({ ...prev, phase: 'Setting up workspace...', progress: 30 }));

        let attempts = 0;
        let consecutiveFailures = 0;

        while (attempts < MAX_POLL_ATTEMPTS && !controller.signal.aborted) {
          // Update phase based on progress
          const progressPercent = 30 + (attempts / MAX_POLL_ATTEMPTS) * 60;
          let phase = 'Setting up workspace...';

          if (attempts >= 45) {
            phase = 'Still working on it...';
          } else if (attempts >= 30) {
            phase = 'Almost ready...';
          } else if (attempts >= 15) {
            phase = 'Agent is starting up...';
          }

          setState((prev) => ({
            ...prev,
            phase,
            progress: progressPercent,
          }));

          try {
            const statusRes = await fetch(`/api/sessions/${config.name}`, {
              headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              signal: controller.signal,
            });

            if (statusRes.ok) {
              consecutiveFailures = 0;
              const statusData = await statusRes.json();

              if (statusData.data?.status === 'active') {
                // Session is ready — send initial message if provided
                // Wrap in try-catch so message failure doesn't mark session creation as failed
                if (config.message) {
                  setState((prev) => ({ ...prev, phase: 'Sending initial message...', progress: 90 }));
                  try {
                    await fetch(`/api/sessions/${config.name}/message`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ content: config.message }),
                      signal: controller.signal,
                    });
                  } catch (msgErr) {
                    // Message send failed but session was created successfully
                    // Log warning but don't fail the entire creation
                    console.warn('Initial message failed to send, session was still created:', msgErr);
                  }
                }

                cleanup();
                setState({
                  isCreating: false,
                  phase: '',
                  progress: 100,
                  error: null,
                  isTimedOut: false,
                  sessionId: config.name,
                });

                return config.name;
              }

              if (statusData.data?.status === 'error') {
                throw new Error('Session creation failed. Check server logs for details.');
              }
            } else if (statusRes.status === 404) {
              throw new Error(
                'Session creation failed — session was removed. Check that the agent is installed and the directory is a git repo.'
              );
            } else {
              // Track non-404 HTTP errors (5xx, 4xx, etc.) as consecutive failures
              consecutiveFailures++;
              if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                throw new Error(`Server error (${statusRes.status}) during session creation.`);
              }
            }
          } catch (err) {
            if (controller.signal.aborted) {
              return null;
            }

            // Re-throw our own errors
            if (
              err instanceof Error &&
              (err.message.includes('Session creation failed') || err.message.includes('session was removed'))
            ) {
              throw err;
            }

            // Track consecutive network failures
            consecutiveFailures++;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              throw new Error('Lost connection to server while waiting for session creation.');
            }
          }

          attempts++;
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        if (controller.signal.aborted) {
          return null;
        }

        if (attempts >= MAX_POLL_ATTEMPTS) {
          throw new Error('Session creation timed out — the agent may be taking longer than expected to start.');
        }

        return null;
      } catch (err) {
        cleanup();

        if (controller.signal.aborted) {
          return null;
        }

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setState({
          isCreating: false,
          phase: '',
          progress: 100,
          error: errorMessage,
          isTimedOut: false,
          sessionId: null,
        });

        return null;
      }
    },
    [cleanup]
  );

  const cancel = useCallback(() => {
    cleanup();
    setState((prev) => ({
      ...prev,
      isCreating: false,
      phase: '',
      error: 'Session creation cancelled',
      progress: 0,
    }));
  }, [cleanup]);

  const retry = useCallback(() => {
    if (configRef.current) {
      create(configRef.current);
    }
  }, [create]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return [state, { create, cancel, retry }];
}
