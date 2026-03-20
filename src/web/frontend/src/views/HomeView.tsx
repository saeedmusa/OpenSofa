import { useEffect, useCallback, useState } from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { useSessionStore } from '../stores/sessionStore';
import { api } from '../utils/api';
import { SessionList } from '../components/SessionList';
import { Header } from '../components/Header';
import { Logo } from '../components/Logo';
import { NewSessionModal } from '../components/NewSessionModal';
import { useResponsive } from '../hooks/useResponsive';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useToast } from '../components/Toast';
import { RefreshCw, Plus } from 'lucide-react';
import { clsx } from 'clsx';

export function HomeView() {
  const { connected } = useWebSocket();
  const { sessions, setSessions, setLoading, setError, isLoading, error } = useSessionStore();
  const { isDesktop } = useResponsive();
  const toast = useToast();
  const [showNewSession, setShowNewSession] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.sessions.list();
      setSessions(data.sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [setSessions, setLoading, setError]);

  useEffect(() => {
    if (api.getToken()) {
      loadSessions();
    }
  }, [loadSessions]);

  // Real-time updates via WebSocket (spec US-2.1)
  const { subscribe } = useWebSocket();
  useEffect(() => {
    const unsubs = [
      subscribe('session_created', () => loadSessions()),
      subscribe('session_stopped', () => loadSessions()),
      subscribe('approval_needed', () => loadSessions()),
      subscribe('approval_cleared', () => loadSessions()),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [subscribe, loadSessions]);

  const handleStop = async (name: string) => {
    try {
      await api.sessions.stop(name);
      toast.success(`Session "${name}" stopped`);
      loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop session');
    }
  };

  const handleApprove = async (name: string) => {
    try {
      await api.sessions.approve(name);
      if (navigator.vibrate) navigator.vibrate(50);
      toast.success(`Session "${name}" approved`);
      loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (name: string) => {
    try {
      await api.sessions.reject(name);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      toast.success(`Session "${name}" rejected`);
      loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  const { isRefreshing, pullProgress, handlers } = usePullToRefresh({
    onRefresh: loadSessions,
  });

  if (!api.getToken()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
        <div className="surface-floating p-10 text-center max-w-md animate-scale-in rounded-3xl">
          <Logo size="xl" className="justify-center mb-6" />
          <h2 className="text-xl font-semibold text-fg-strong mb-3">Authentication Required</h2>
          <p className="text-muted mb-6">
            Scan the QR code from your terminal to get started
          </p>
          <p className="text-muted/60 text-sm">
            Run <code className="bg-surface px-2 py-1 rounded-lg text-accent">opensofa web</code> to get a link
          </p>
        </div>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-fg-strong">All Sessions</h2>
            <p className="text-sm text-muted mt-1">
              {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewSession(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={18} />
              <span>New Session</span>
            </button>
            <button
              onClick={loadSessions}
              disabled={isLoading}
              className="btn btn-ghost"
            >
              <RefreshCw size={18} className={clsx(isLoading && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <SessionList
          sessions={sessions}
          isLoading={isLoading}
          error={error}
          onStop={handleStop}
          onApprove={handleApprove}
          onReject={handleReject}
        />

        <NewSessionModal
          isOpen={showNewSession}
          onClose={() => setShowNewSession(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen" {...handlers}>
      {pullProgress > 0 && (
        <div
          className="flex items-center justify-center py-4 transition-transform"
          style={{ transform: `translateY(${pullProgress * 50}px)` }}
        >
          <div className="p-3 rounded-full bg-accent-soft">
            <RefreshCw
              size={20}
              className={clsx(
                'text-accent transition-transform',
                isRefreshing && 'animate-spin'
              )}
              style={{ transform: `rotate(${pullProgress * 360}deg)` }}
            />
          </div>
        </div>
      )}

      <Header connected={connected} />

      <main className="p-5">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-muted mb-1 uppercase tracking-wider">Sessions</h2>
            <p className="text-xs text-muted">
              {sessions.length} active
            </p>
          </div>
          <button
            onClick={() => setShowNewSession(true)}
            className="btn btn-primary btn-sm flex items-center gap-2"
          >
            <Plus size={16} />
            <span>New</span>
          </button>
        </div>

        <SessionList
          sessions={sessions}
          isLoading={isLoading}
          error={error}
          onStop={handleStop}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </main>

      <NewSessionModal
        isOpen={showNewSession}
        onClose={() => setShowNewSession(false)}
      />
    </div>
  );
}
