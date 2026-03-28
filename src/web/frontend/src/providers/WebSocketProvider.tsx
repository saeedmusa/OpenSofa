import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import type { WebSocketEvent, Session } from '../types';

// Queue interface and constants
interface QueuedMessage {
  id: string;
  sessionId: string;
  content: string;
  timestamp: number;
}

const QUEUE_KEY = 'opensofa_message_queue';
const SEQUENCE_KEY = 'lastEventSequence';
const MAX_QUEUE = 20;

// Queue management functions
const saveQueue = (queue: QueuedMessage[]): void => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const loadQueue = (): QueuedMessage[] => {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const enqueueMessage = (sessionId: string, content: string): void => {
  const queue = loadQueue();
  if (queue.length >= MAX_QUEUE) {
    console.warn('[WS] Queue full, dropping oldest message');
    queue.shift(); // Remove oldest (FIFO)
  }
  queue.push({
    id: crypto.randomUUID(),
    sessionId,
    content,
    timestamp: Date.now(),
  });
  saveQueue(queue);
};

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

type EventHandler = (event: WebSocketEvent) => void;

interface SystemStatus {
  connected: boolean;
  tunnelUrl: string | null;
}

interface WSContextValue {
  connected: boolean;
  connectionStatus: ConnectionStatus;
  reconnectError: boolean;
  pendingCount: number;
  missedEvents: number;
  showOfflineBanner: boolean;
  systemStatus: SystemStatus | null;
  subscribe: (eventType: string, handler: EventHandler) => () => void;
  subscribeTerminal: (sessionName: string) => void;
  unsubscribeTerminal: () => void;
  send: (message: { type: string; payload?: unknown }) => void;
  dismissOfflineBanner: () => void;
  reconnect: () => void;
}

const WSContext = createContext<WSContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useWebSocket(): WSContextValue {
  const ctx = useContext(WSContext);
  if (!ctx) throw new Error('useWebSocket must be within WebSocketProvider');
  return ctx;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [reconnectError, setReconnectError] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [missedEvents, setMissedEvents] = useState(0);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const reconnectDelayRef = useRef(1000);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const HEARTBEAT_INTERVAL = 20000; // 20s
  const PONG_TIMEOUT = 20000; // 20s
  const heartbeatTimerRef = useRef<number | undefined>(undefined);
  const pongTimerRef = useRef<number | undefined>(undefined);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const addSession = useSessionStore((s) => s.addSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const mountedRef = useRef(false);

  // Idempotency: Keep track of recently processed event UUIDs to prevent duplicates
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const MAX_PROCESSED_IDS = 5000;

  // Load last known sequence on mount for session recovery
  const maxSequenceRef = useRef(parseInt(localStorage.getItem(SEQUENCE_KEY) || '0', 10));

  // Update pending count from localStorage
  const updatePendingCount = useCallback(() => {
    const count = loadQueue().length;
    setPendingCount(count);
  }, []);

  // Flush queue when reconnected
  const flushQueue = useCallback((sendFn: (msg: { type: string; payload?: unknown }) => void) => {
    const queue = loadQueue();
    if (queue.length === 0) return;

    console.log(`[WS] Flushing ${queue.length} queued messages`);

    for (const msg of queue) {
      sendFn({ type: 'terminal_input', payload: { sessionId: msg.sessionId, content: msg.content } });
    }

    saveQueue([]); // Clear queue
    setPendingCount(0);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Initial pending count
    updatePendingCount();
    
    const startHeartbeat = () => {
      stopHeartbeat();
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      heartbeatTimerRef.current = window.setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // console.debug('[WS] Sending ping');
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
          
          // Set pong timeout
          if (pongTimerRef.current) clearTimeout(pongTimerRef.current);
          pongTimerRef.current = window.setTimeout(() => {
            console.warn('[WS] Pong timeout - reconnecting');
            wsRef.current?.close(); // Trigger onclose/reconnect
          }, PONG_TIMEOUT);
        }
      }, HEARTBEAT_INTERVAL);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (pongTimerRef.current) clearTimeout(pongTimerRef.current);
      heartbeatTimerRef.current = undefined;
      pongTimerRef.current = undefined;
    };

    const handleEvent = (event: WebSocketEvent) => {
      // Idempotency check
      if (event.eventId) {
        if (processedEventIdsRef.current.has(event.eventId)) {
          // console.debug('[WS] Dropping duplicate event', event.eventId);
          return;
        }
        processedEventIdsRef.current.add(event.eventId);
        if (processedEventIdsRef.current.size > MAX_PROCESSED_IDS) {
          // Remove oldest (first item in Set iterator)
          const oldest = processedEventIdsRef.current.values().next().value as string;
          processedEventIdsRef.current.delete(oldest);
        }
      }

      // Track sequence number for session recovery
      if (event.sequence !== undefined && event.sequence > maxSequenceRef.current) {
        maxSequenceRef.current = event.sequence;
        localStorage.setItem(SEQUENCE_KEY, String(event.sequence));
      }

      const handlers = handlersRef.current.get(event.type);
      if (handlers) {
        handlers.forEach(h => h(event));
      }

      const allHandlers = handlersRef.current.get('*');
      if (allHandlers) {
        allHandlers.forEach(h => h(event));
      }

      switch (event.type) {
        case 'session_created': {
          addSession(event.payload as Session);
          break;
        }
        case 'session_stopped': {
          removeSession((event.payload as { name: string }).name);
          break;
        }
        case 'session_updated': {
          const update = event.payload as { name: string } & Partial<Session>;
          if (update.name) {
            updateSession(update.name, update);
          }
          break;
        }
        case 'approval_needed': {
          const approval = event.payload as { sessionName: string; command: string | null };
          updateSession(approval.sessionName, { hasPendingApproval: true });
          break;
        }
        case 'approval_cleared': {
          const cleared = event.payload as { sessionName: string };
          updateSession(cleared.sessionName, { hasPendingApproval: false });
          break;
        }
        case 'system_status': {
          const payload = event.payload as SystemStatus;
          setSystemStatus(payload);
          // console.log('[WS] System status:', payload);
          break;
        }
        case 'kill_session': {
          const payload = event.payload as { reason: string };
          console.warn('[WS] Session killed:', payload.reason);
          // Force disconnect and prompt re-auth
          wsRef.current?.close();
          break;
        }
      }
    };

    const connect = () => {
      if (!mountedRef.current) return;

      const token = localStorage.getItem('opensofa_token');
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) {
          // Send auth token as first message (not in URL for security)
          ws.send(JSON.stringify({ type: 'auth', token }));
          
          reconnectDelayRef.current = 1000; // Reset exponential backoff
          reconnectAttemptsRef.current = 0; // Reset attempt counter
          setConnected(true);
          setConnectionStatus('connected');
          setReconnectError(false);
          console.log('[WS] Connected');
          
          startHeartbeat();

          // Show connected briefly then hide
          setTimeout(() => {
            if (mountedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
              setConnectionStatus('connected');
            }
          }, 2000);

          // Log last known sequence for session recovery
          const lastSeq = maxSequenceRef.current;
          if (lastSeq > 0) {
            console.log(`[WS] Session recovery: requesting events since ${lastSeq}`);
            ws.send(JSON.stringify({ type: 'sync_request', payload: { since: lastSeq } }));
          }

          // Flush queued messages on reconnect
          flushQueue((msg) => {
            ws.send(JSON.stringify(msg));
          });
        }
      };

      ws.onclose = () => {
        stopHeartbeat();
        if (mountedRef.current) {
          setConnected(false);
          setConnectionStatus('disconnected');
          reconnectAttemptsRef.current++;

          if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.error('[WS] Max reconnection attempts reached');
            setReconnectError(true);
            setConnectionStatus('disconnected');
            return;
          }

          // Start reconnecting
          setConnectionStatus('reconnecting');
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(delay * 2, 16000); // 1s → 2s → 4s → 8s → 16s (max)
          console.log(`[WS] Disconnected, reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          reconnectTimeoutRef.current = window.setTimeout(connect, delay);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketEvent = JSON.parse(event.data);
          
          if (msg.type === 'auth_success') {
            console.log('[WS] Authentication successful');
            setConnected(true);
            setConnectionStatus('connected');
            setReconnectError(false);
            return;
          }
          
          // Clear pong timeout on any message from server (implicit pong)
          if (pongTimerRef.current) {
            clearTimeout(pongTimerRef.current);
            pongTimerRef.current = undefined;
          }
          
          if (msg.type === 'pong') return; // Ignore explicit pong response if server sends it

          handleEvent(msg);

          // Handle sync_response to track missed events
          if (msg.type === 'sync_response') {
            const payload = msg.payload as { events?: WebSocketEvent[] };
            const missedCount = payload.events?.length || 0;
            if (missedCount > 0) {
              console.log(`[WS] Replaying ${missedCount} events that occurred while offline`);
              for (const missedEvent of payload.events!) {
                handleEvent(missedEvent);
              }
              setMissedEvents(missedCount);
              setShowOfflineBanner(true); // Optional: notify user that we just fast-forwarded
            }
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
    };

    connect();

    // Handle page visibility changes (app switching, phone lock, etc.)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[WS] App backgrounded - connection may be dropped');
      } else if (document.visibilityState === 'visible') {
        console.log('[WS] App visible - checking connection');
        // If socket not connected, trigger reconnect
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    };

    // iOS Safari: handle pagehide/pageshow for PWA compatibility
    const handlePageHide = () => {
      console.log('[WS] iOS pagehide - preparing for disconnect');
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      console.log('[WS] iOS pageshow - checking connection');
      // If socket not connected or this is a fresh page load (persisted=false), trigger reconnect
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        // Check if this was a bfcache restore (persisted flag)
        if (event.persisted) {
          console.log('[WS] iOS pageshow - bfcache restore, reconnecting');
        }
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    const currentWs = wsRef.current;
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      stopHeartbeat();
      if (currentWs && currentWs.readyState <= WebSocket.OPEN) {
        currentWs.close();
      }
    };
  }, [addSession, removeSession, updateSession, flushQueue, updatePendingCount]);

  const subscribe = useCallback((eventType: string, handler: EventHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);

    return () => {
      handlersRef.current.get(eventType)?.delete(handler);
    };
  }, []);

  const subscribeTerminal = useCallback((sessionName: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe_terminal', sessionName }));
    }
  }, []);

  const unsubscribeTerminal = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe_terminal' }));
    }
  }, []);

  const send = useCallback((message: { type: string; payload?: unknown }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message for later when offline
      if (message.type === 'terminal_input' && message.payload) {
        const payload = message.payload as { sessionId: string; content: string };
        enqueueMessage(payload.sessionId, payload.content);
        updatePendingCount();
        console.log('[WS] Message queued for later delivery');
      }
    }
  }, [updatePendingCount]);

  const dismissOfflineBanner = useCallback(() => {
    setShowOfflineBanner(false);
  }, []);

  // Manual reconnect — used when server is unreachable
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    reconnectDelayRef.current = 1000;
    setReconnectError(false);
    setConnectionStatus('reconnecting');
    // Close existing socket and let the onclose handler trigger reconnect
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  return (
    <WSContext.Provider value={{ 
      connected, 
      connectionStatus,
      reconnectError, 
      pendingCount, 
      missedEvents,
      showOfflineBanner,
      systemStatus,
      subscribe, 
      subscribeTerminal, 
      unsubscribeTerminal, 
      send,
      dismissOfflineBanner,
      reconnect
    }}>
      {children}
    </WSContext.Provider>
  );
}
