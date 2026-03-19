import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useSessionStore } from '../stores/sessionStore';
import type { Session, SessionDetail } from '../types';

describe('sessionStore', () => {
  const mockSession: Session = {
    name: 'test-session',
    status: 'active',
    agentType: 'claude',
    model: 'claude-3-opus',
    branch: 'main',
    agentStatus: 'stable',
    hasPendingApproval: false,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  const mockSessionDetail: SessionDetail = {
    ...mockSession,
    workDir: '/tmp/test',
    repoDir: '/tmp/test/repo',
    port: 8080,
    pendingApproval: null,
  };

  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      selectedSession: null,
      isLoading: false,
      error: null,
    });
  });

  describe('setSessions', () => {
    it('should set sessions array', () => {
      const { setSessions } = useSessionStore.getState();
      act(() => setSessions([mockSession]));
      expect(useSessionStore.getState().sessions).toHaveLength(1);
      expect(useSessionStore.getState().sessions[0].name).toBe('test-session');
    });
  });

  describe('addSession', () => {
    it('should add a session to the array', () => {
      const { addSession } = useSessionStore.getState();
      act(() => addSession(mockSession));
      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });

    it('should append to existing sessions', () => {
      const { addSession } = useSessionStore.getState();
      act(() => {
        addSession(mockSession);
        addSession({ ...mockSession, name: 'second-session' });
      });
      expect(useSessionStore.getState().sessions).toHaveLength(2);
    });
  });

  describe('updateSession', () => {
    it('should update a session by name', () => {
      const { setSessions, updateSession } = useSessionStore.getState();
      act(() => setSessions([mockSession]));
      act(() => updateSession('test-session', { agentStatus: 'running' }));
      expect(useSessionStore.getState().sessions[0].agentStatus).toBe('running');
    });

    it('should update selectedSession if it matches', () => {
      const { setSelectedSession, updateSession } = useSessionStore.getState();
      act(() => setSelectedSession(mockSessionDetail));
      act(() => updateSession('test-session', { agentStatus: 'running' }));
      expect(useSessionStore.getState().selectedSession?.agentStatus).toBe('running');
    });

    it('should not modify other sessions', () => {
      const { setSessions, updateSession } = useSessionStore.getState();
      act(() => setSessions([mockSession, { ...mockSession, name: 'other-session' }]));
      act(() => updateSession('test-session', { agentStatus: 'running' }));
      const sessions = useSessionStore.getState().sessions;
      expect(sessions.find(s => s.name === 'other-session')?.agentStatus).toBe('stable');
    });
  });

  describe('removeSession', () => {
    it('should remove a session by name', () => {
      const { setSessions, removeSession } = useSessionStore.getState();
      act(() => setSessions([mockSession, { ...mockSession, name: 'other' }]));
      act(() => removeSession('test-session'));
      expect(useSessionStore.getState().sessions).toHaveLength(1);
      expect(useSessionStore.getState().sessions[0].name).toBe('other');
    });

    it('should clear selectedSession if it matches', () => {
      const { setSelectedSession, removeSession } = useSessionStore.getState();
      act(() => setSelectedSession(mockSessionDetail));
      act(() => removeSession('test-session'));
      expect(useSessionStore.getState().selectedSession).toBeNull();
    });

    it('should not clear selectedSession if different', () => {
      const { setSelectedSession, removeSession } = useSessionStore.getState();
      act(() => setSelectedSession(mockSessionDetail));
      act(() => removeSession('other-session'));
      expect(useSessionStore.getState().selectedSession).not.toBeNull();
    });
  });

  describe('setSelectedSession', () => {
    it('should set selected session', () => {
      const { setSelectedSession } = useSessionStore.getState();
      act(() => setSelectedSession(mockSessionDetail));
      expect(useSessionStore.getState().selectedSession?.name).toBe('test-session');
    });

    it('should clear selected session with null', () => {
      const { setSelectedSession } = useSessionStore.getState();
      act(() => setSelectedSession(mockSessionDetail));
      act(() => setSelectedSession(null));
      expect(useSessionStore.getState().selectedSession).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { setLoading } = useSessionStore.getState();
      act(() => setLoading(true));
      expect(useSessionStore.getState().isLoading).toBe(true);
      act(() => setLoading(false));
      expect(useSessionStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error state', () => {
      const { setError } = useSessionStore.getState();
      act(() => setError('Something went wrong'));
      expect(useSessionStore.getState().error).toBe('Something went wrong');
      act(() => setError(null));
      expect(useSessionStore.getState().error).toBeNull();
    });
  });
});
