import { useEffect, useCallback, useState } from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { useSessionStore } from '../stores/sessionStore';
import { api } from '../utils/api';
import { safeVibrate } from '../utils/haptics';
import { SessionList } from '../components/SessionList';
import { Header } from '../components/Header';
import { NewSessionModal } from '../components/NewSessionModal';
import { MCPServerList } from '../components/MCPServerList';
import { useResponsive } from '../hooks/useResponsive';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useToast } from '../components/Toast';
import { RefreshCw, Plus, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';

interface RecentConversation {
  sessionName: string;
  messageCount: number;
  lastActivity: number;
}

export function HomeView() {
  const { connected } = useWebSocket();
  const { sessions, setSessions, setLoading, setError, isLoading, error } = useSessionStore();
  const { isDesktop } = useResponsive();
  const toast = useToast();
  const [showNewSession, setShowNewSession] = useState(false);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);

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

  const loadRecentConversations = useCallback(async () => {
    try {
      const data = await api.conversations.list();
      setRecentConversations(data.conversations.slice(0, 5));
    } catch {
      // Silently fail — conversations are optional
    }
  }, []);

  useEffect(() => {
    if (api.getToken()) {
      loadSessions();
      loadRecentConversations();
    }
  }, [loadSessions, loadRecentConversations]);

  // Real-time updates via WebSocket (spec US-2.1)
  const { subscribe } = useWebSocket();
  useEffect(() => {
    const unsubs = [
      subscribe('session_created', () => loadSessions()),
      subscribe('session_stopped', () => loadSessions()),
      subscribe('session_updated', () => loadSessions()),
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
      <div data-testid="desktop-home" className="h-full overflow-y-auto p-8 bg-void custom-scrollbar">
        <div className="mb-8 flex items-center justify-between border-b border-matrix-green/20 pb-6">
          <div>
            <h2 className="text-2xl font-bold text-matrix-green font-mono tracking-tighter uppercase">DASHBOARD_MAIN</h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[10px] text-muted font-mono uppercase tracking-[0.2em]">
                {sessions.length} ACTIVE_PROCESSES
              </p>
              <span className="w-1 h-1 bg-matrix-green rounded-full animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadSessions}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-matrix-green/5 border border-matrix-green/30 text-matrix-green font-mono text-xs hover:bg-matrix-green/10 transition-all uppercase tracking-widest"
            >
              <RefreshCw size={14} className={clsx(isLoading && 'animate-spin')} />
              <span>REFRESH_SYSTEM</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <SessionList
              sessions={sessions}
              isLoading={isLoading}
              error={error}
              onStop={handleStop}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
          
          <div className="space-y-8">
            {/* System Status / Quick Info can go here */}
            <div className="surface-container p-6 border border-matrix-green/10">
              <h3 className="text-[10px] font-mono text-muted uppercase tracking-[0.3em] mb-4">SYSTEM_STATUS</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted">HOST</span>
                  <span className="text-matrix-green">{window.location.hostname}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted">PROTOCOL</span>
                  <span className="text-cyan-accent">WSS://SECURE</span>
                </div>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted">UPTIME</span>
                  <span className="text-matrix-green">99.9%</span>
                </div>
              </div>
            </div>

            <MCPServerList />
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <div data-testid="mobile-home" className="min-h-screen bg-[#000000]" {...handlers}>
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

        {/* Recent Conversations */}
        {recentConversations.length > 0 && (
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-sm font-medium text-[rgba(255,255,255,0.5)] mb-1 uppercase tracking-widest font-mono">Recent Conversations</h2>
              <p className="text-xs text-[rgba(255,255,255,0.5)] font-mono">
                Past session history
              </p>
            </div>
            <div className="space-y-2">
              {recentConversations.map((conv) => (
                <div
                  key={conv.sessionName}
                  className="flex items-center gap-3 p-3 bg-[#0e0e0e] border border-[#3b4b37]/30 hover:border-[#3b4b37]/60 transition-colors"
                >
                  <MessageSquare size={16} className="text-[#00FF41] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-[#e2e2e2] truncate">{conv.sessionName}</p>
                    <p className="text-xs font-mono text-[rgba(255,255,255,0.4)]">
                      {conv.messageCount} messages
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MCP Servers */}
        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-[rgba(255,255,255,0.5)] mb-1 uppercase tracking-widest font-mono">MCP Servers</h2>
            <p className="text-xs text-[rgba(255,255,255,0.5)] font-mono">
              Configured tool servers
            </p>
          </div>
          <MCPServerList />
        </div>
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
