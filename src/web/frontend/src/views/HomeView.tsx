import { useEffect, useCallback, useState } from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { useSessionStore } from '../stores/sessionStore';
import { api } from '../utils/api';
import { safeVibrate } from '../utils/haptics';
import { SessionList } from '../components/SessionList';
import { Header } from '../components/Header';
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
      safeVibrate(50);
      toast.success(`Session "${name}" approved`);
      loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (name: string) => {
    try {
      await api.sessions.reject(name);
      safeVibrate([30, 50, 30]);
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
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-[#000000]">
        <div className="w-full max-w-md p-8 bg-[#0e0e0e] border border-[#3b4b37] animate-scale-in">
          <div className="flex flex-col items-center text-center mb-8">
            <span className="material-symbols-outlined text-[#00FF41] text-5xl mb-4">terminal</span>
            <h2 className="text-xl font-bold text-[#e2e2e2] font-mono mb-2">AUTH_REQUIRED</h2>
            <p className="text-sm text-[rgba(255,255,255,0.5)] font-mono">
              Scan the QR code from your terminal or open the link with a valid token.
            </p>
          </div>
          <div className="bg-[#1f1f1f] p-4 font-mono text-xs text-[rgba(255,255,255,0.5)]">
            <span className="text-[#00FF41]">$</span> opensofa web
          </div>
        </div>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#e2e2e2] font-mono tracking-tight">ALL_SESSIONS</h2>
            <p className="text-sm text-[rgba(255,255,255,0.5)] mt-1 font-mono">
              {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewSession(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={18} />
              <span>NEW_SESSION</span>
            </button>
            <button
              onClick={loadSessions}
              disabled={isLoading}
              className="btn btn-ghost flex items-center gap-2"
            >
              <RefreshCw size={18} className={clsx(isLoading && 'animate-spin')} />
              <span>REFRESH</span>
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

  // Mobile layout
  return (
    <div className="min-h-screen bg-[#000000]" {...handlers}>
      <Header connected={connected} />

      {/* Pull to refresh indicator */}
      {pullProgress > 0 && (
        <div
          className="flex items-center justify-center py-4 transition-transform"
          style={{ transform: `translateY(${pullProgress * 50}px)` }}
        >
          <div className="p-3 bg-[#1f1f1f]">
            <RefreshCw
              size={20}
              className={clsx(
                'text-[#00FF41] transition-transform',
                isRefreshing && 'animate-spin'
              )}
              style={{ transform: `rotate(${pullProgress * 360}deg)` }}
            />
          </div>
        </div>
      )}

      <main className="p-5 pt-20">
        {/* Session timestamp — terminal style */}
        <div className="flex justify-center mb-6">
          <span className="bg-[#2a2a2a] px-3 py-1 font-mono text-[10px] text-[#84967e] tracking-widest border border-[#3b4b37]/30">
            SESSION_START: {new Date().toISOString().replace(/[:.]/g, '_')}Z
          </span>
        </div>

        {/* Sessions header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-[rgba(255,255,255,0.5)] mb-1 uppercase tracking-widest font-mono">Sessions</h2>
            <p className="text-xs text-[rgba(255,255,255,0.5)] font-mono">
              {sessions.length} active
            </p>
          </div>
          <button
            onClick={() => setShowNewSession(true)}
            className="btn btn-primary flex items-center gap-2 text-xs px-3 py-2"
          >
            <Plus size={16} />
            <span>NEW</span>
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

      {/* Floating Action Button — Matrix Green glow */}
      <button 
        onClick={() => setShowNewSession(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#00FF41] text-[#000000] shadow-glow-primary flex items-center justify-center active:scale-95 transition-transform z-50"
        aria-label="Create new session"
      >
        <Plus size={24} className="font-bold" />
      </button>

      <NewSessionModal
        isOpen={showNewSession}
        onClose={() => setShowNewSession(false)}
      />
    </div>
  );
}
