import { create } from 'zustand';
import type { Session, SessionDetail } from '../types';

export type SessionStatus = 'creating' | 'active' | 'stopping' | 'stopped' | 'error';
export type AgentStatus = 'stable' | 'running' | 'awaiting_human_input';

export interface QueuedMessage {
  id: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
}

export interface OperationProgress {
  operationId: string;
  type: 'create' | 'stop' | 'restart' | 'message';
  phase: string;
  progress: number;
  startTime: number;
  error: string | null;
  isTimedOut: boolean;
  retryCount: number;
}

interface SessionState {
  sessions: Session[];
  selectedSession: SessionDetail | null;
  messageQueues: Record<string, QueuedMessage[]>;
  operations: Record<string, OperationProgress>;
  isLoading: boolean;
  error: string | null;

  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (name: string, data: Partial<Session>) => void;
  removeSession: (name: string) => void;
  setSelectedSession: (session: SessionDetail | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  queueMessage: (sessionName: string, content: string) => QueuedMessage;
  updateQueuedMessage: (sessionName: string, id: string, status: QueuedMessage['status']) => void;
  removeQueuedMessage: (sessionName: string, id: string) => void;
  clearQueue: (sessionName: string) => void;
  getQueuedMessages: (sessionName: string) => QueuedMessage[];
  hasQueuedMessages: (sessionName: string) => boolean;

  startOperation: (operationId: string, type: OperationProgress['type'], phase: string) => void;
  updateOperation: (operationId: string, updates: Partial<OperationProgress>) => void;
  completeOperation: (operationId: string) => void;
  failOperation: (operationId: string, error: string, isTimedOut?: boolean) => void;
  getOperation: (operationId: string) => OperationProgress | null;
}

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  creating: ['active', 'error'],
  active: ['active', 'stopping', 'error'],
  stopping: ['stopped', 'error'],
  stopped: ['creating'],
  error: ['active', 'creating'],
};

function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  selectedSession: null,
  messageQueues: {},
  operations: {},
  isLoading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),
  
  addSession: (session) => 
    set((state) => ({ 
      sessions: [...state.sessions, session] 
    })),

  updateSession: (name, data) =>
    set((state) => {
      const currentSession = state.sessions.find(s => s.name === name);
      
      if (data.status && currentSession && !canTransition(currentSession.status, data.status)) {
        console.warn(`Invalid state transition: ${currentSession.status} → ${data.status}`);
        return state;
      }
      
      return {
        sessions: state.sessions.map((s) =>
          s.name === name ? { ...s, ...data } : s
        ),
        selectedSession: state.selectedSession?.name === name
          ? { ...state.selectedSession, ...data }
          : state.selectedSession,
      };
    }),

  removeSession: (name) =>
    set((state) => {
      const nextQueues = { ...state.messageQueues };
      delete nextQueues[name];
      return {
        sessions: state.sessions.filter((s) => s.name !== name),
        selectedSession: state.selectedSession?.name === name
          ? null
          : state.selectedSession,
        messageQueues: nextQueues,
      };
    }),

  setSelectedSession: (session) => set({ selectedSession: session }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  queueMessage: (sessionName, content) => {
    const msg: QueuedMessage = {
      id: crypto.randomUUID(),
      content,
      timestamp: Date.now(),
      status: 'pending',
    };
    
    set((state) => ({
      messageQueues: {
        ...state.messageQueues,
        [sessionName]: [...(state.messageQueues[sessionName] || []), msg],
      },
    }));
    
    return msg;
  },
  
  updateQueuedMessage: (sessionName, id, status) =>
    set((state) => ({
      messageQueues: {
        ...state.messageQueues,
        [sessionName]: (state.messageQueues[sessionName] || []).map(m =>
          m.id === id ? { ...m, status } : m
        ),
      },
    })),
  
  removeQueuedMessage: (sessionName, id) =>
    set((state) => {
      const queue = (state.messageQueues[sessionName] || []).filter(m => m.id !== id);
      const nextQueues = { ...state.messageQueues };
      
      if (queue.length === 0) {
        delete nextQueues[sessionName];
      } else {
        nextQueues[sessionName] = queue;
      }
      
      return { messageQueues: nextQueues };
    }),
  
  clearQueue: (sessionName) =>
    set((state) => {
      const nextQueues = { ...state.messageQueues };
      delete nextQueues[sessionName];
      return { messageQueues: nextQueues };
    }),
  
  getQueuedMessages: (sessionName) => get().messageQueues[sessionName] || [],
  
  hasQueuedMessages: (sessionName) => (get().messageQueues[sessionName]?.length ?? 0) > 0,

  startOperation: (operationId, type, phase) =>
    set((state) => ({
      operations: {
        ...state.operations,
        [operationId]: {
          operationId,
          type,
          phase,
          progress: 0,
          startTime: Date.now(),
          error: null,
          isTimedOut: false,
          retryCount: 0,
        },
      },
    })),

  updateOperation: (operationId, updates) =>
    set((state) => {
      const operation = state.operations[operationId];
      if (!operation) return state;
      return {
        operations: {
          ...state.operations,
          [operationId]: { ...operation, ...updates },
        },
      };
    }),

  completeOperation: (operationId) =>
    set((state) => {
      const nextOperations = { ...state.operations };
      delete nextOperations[operationId];
      return { operations: nextOperations };
    }),

  failOperation: (operationId, error, isTimedOut = false) =>
    set((state) => {
      const operation = state.operations[operationId];
      if (!operation) return state;
      return {
        operations: {
          ...state.operations,
          [operationId]: { ...operation, error, isTimedOut, progress: 100 },
        },
      };
    }),

  getOperation: (operationId) => get().operations[operationId] ?? null,
}));

export function canAcceptMessages(session: Session | null): boolean {
  return session?.status === 'active' && session?.agentStatus === 'stable';
}

export function canQueueMessages(session: Session | null): boolean {
  return session?.status === 'active';
}
