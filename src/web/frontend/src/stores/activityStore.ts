import { create } from 'zustand';
import type { ActivityEvent } from '../types';

interface ActivityState {
  events: Record<string, ActivityEvent[]>;
  
  addEvents: (sessionName: string, newEvents: ActivityEvent[]) => void;
  clearEvents: (sessionName: string) => void;
  getEvents: (sessionName: string) => ActivityEvent[];
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  events: {},

  addEvents: (sessionName, newEvents) => {
    set((state) => ({
      events: {
        ...state.events,
        [sessionName]: [...newEvents, ...(state.events[sessionName] || [])].slice(0, 100),
      },
    }));
  },

  clearEvents: (sessionName) => {
    set((state) => {
      const next = { ...state.events };
      delete next[sessionName];
      return { events: next };
    });
  },

  getEvents: (sessionName) => {
    return get().events[sessionName] || [];
  },
}));
