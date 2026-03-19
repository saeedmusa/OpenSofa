import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useActivityStore } from '../stores/activityStore';
import type { ActivityEvent } from '../types';

describe('activityStore', () => {
  const mockEvent: ActivityEvent = {
    id: 'event-1',
    type: 'agent_message',
    timestamp: Date.now(),
    sessionName: 'test-session',
    summary: 'Agent did something',
    icon: '🤖',
  };

  const mockEvent2: ActivityEvent = {
    id: 'event-2',
    type: 'file_created',
    timestamp: Date.now(),
    sessionName: 'test-session',
    summary: 'File created',
    icon: '📄',
  };

  beforeEach(() => {
    useActivityStore.setState({ events: {} });
  });

  describe('addEvents', () => {
    it('should add events for a session', () => {
      const { addEvents } = useActivityStore.getState();
      act(() => addEvents('test-session', [mockEvent]));
      const events = useActivityStore.getState().getEvents('test-session');
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('event-1');
    });

    it('should prepend new events', () => {
      const { addEvents } = useActivityStore.getState();
      act(() => {
        addEvents('test-session', [mockEvent]);
        addEvents('test-session', [mockEvent2]);
      });
      const events = useActivityStore.getState().getEvents('test-session');
      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('event-2');
    });

    it('should limit events to 100', () => {
      const { addEvents } = useActivityStore.getState();
      const manyEvents: ActivityEvent[] = Array.from({ length: 150 }, (_, i) => ({
        ...mockEvent,
        id: `event-${i}`,
      }));
      act(() => addEvents('test-session', manyEvents));
      const events = useActivityStore.getState().getEvents('test-session');
      expect(events).toHaveLength(100);
    });

    it('should handle multiple sessions separately', () => {
      const { addEvents } = useActivityStore.getState();
      act(() => {
        addEvents('session-1', [mockEvent]);
        addEvents('session-2', [mockEvent2]);
      });
      expect(useActivityStore.getState().getEvents('session-1')).toHaveLength(1);
      expect(useActivityStore.getState().getEvents('session-2')).toHaveLength(1);
    });
  });

  describe('clearEvents', () => {
    it('should clear events for a session', () => {
      const { addEvents, clearEvents } = useActivityStore.getState();
      act(() => {
        addEvents('test-session', [mockEvent]);
        addEvents('other-session', [mockEvent2]);
      });
      act(() => clearEvents('test-session'));
      expect(useActivityStore.getState().getEvents('test-session')).toHaveLength(0);
      expect(useActivityStore.getState().getEvents('other-session')).toHaveLength(1);
    });
  });

  describe('getEvents', () => {
    it('should return empty array for non-existent session', () => {
      const events = useActivityStore.getState().getEvents('non-existent');
      expect(events).toEqual([]);
    });
  });
});
