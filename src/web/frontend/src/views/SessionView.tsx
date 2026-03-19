import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Terminal as TerminalIcon, Folder, Activity, Loader2, AlertCircle } from 'lucide-react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { useSessionStore } from '../stores/sessionStore';
import { api } from '../utils/api';
import { LazyTerminal } from '../components/LazyTerminal';
import { ActivityFeed } from '../components/ActivityFeed';
import { ApprovalCard } from '../components/ApprovalCard';
import { LazyFileView } from '../components/LazyFileView';
import { SessionTabBar } from '../components/TabBar';
import { VoiceInput } from '../components/VoiceInput';
import { useResponsive } from '../hooks/useResponsive';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { clsx } from 'clsx';

export function SessionView() {
  const { name, tab } = useParams<{ name: string; tab?: string }>();
  const navigate = useNavigate();
  const { subscribe, subscribeTerminal, unsubscribeTerminal } = useWebSocket();
  const { selectedSession, setSelectedSession } = useSessionStore();
  const { isDesktop } = useResponsive();
  const [showTerminal, setShowTerminal] = useState(false);
  const [message, setMessage] = useState('');

  useKeyboardShortcuts();

  const decodedName = name ? decodeURIComponent(name) : '';

  useEffect(() => {
    if (!decodedName) return;

    async function loadSession() {
      try {
        const session = await api.sessions.get(decodedName);
        setSelectedSession(session);
      } catch (err) {
        console.error('Failed to load session:', err);
        navigate('/');
      }
    }

    loadSession();

    // Poll every 3 seconds for updates (spec US-3.1)
    const pollInterval = setInterval(loadSession, 3000);
    return () => clearInterval(pollInterval);
  }, [decodedName, setSelectedSession, navigate]);

  // Real-time updates via WebSocket
  useEffect(() => {
    const unsubs = [
      subscribe('session_updated', (event) => {
        if (event.sessionName === decodedName) {
          api.sessions.get(decodedName).then(setSelectedSession).catch(() => {});
        }
      }),
      subscribe('approval_needed', (event) => {
        const payload = event.payload as { sessionName?: string };
        if (payload?.sessionName === decodedName) {
          api.sessions.get(decodedName).then(setSelectedSession).catch(() => {});
        }
      }),
      subscribe('approval_cleared', (event) => {
        const payload = event.payload as { sessionName?: string };
        if (payload?.sessionName === decodedName) {
          api.sessions.get(decodedName).then(setSelectedSession).catch(() => {});
        }
      }),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [subscribe, decodedName, setSelectedSession]);

  useEffect(() => {
    if ((tab === 'terminal' || showTerminal) && decodedName) {
      subscribeTerminal(decodedName);
    }
    return () => {
      if (tab === 'terminal' || showTerminal) {
        unsubscribeTerminal();
      }
    };
  }, [tab, showTerminal, decodedName, subscribeTerminal, unsubscribeTerminal]);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!decodedName || !message.trim() || sending) return;
    
    setSending(true);
    setSendError(null);
    
    try {
      await api.sessions.message(decodedName, message.trim());
      setMessage('');
      // Haptic feedback on success
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      console.error('Failed to send message:', err);
      setSendError(errorMsg);
      // Haptic feedback on error
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter allows newline (default behavior)
  };

  if (!selectedSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const session = selectedSession;
  const activeTab = tab || 'feed';

  if (isDesktop) {
    return (
      <div className="flex flex-col h-screen">
        <header className="floating-header px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="btn btn-ghost p-2"
              aria-label="Go back"
            >
              <ArrowLeft size={22} />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-fg-strong truncate">{session.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted mt-0.5">
                <span className="flex items-center gap-1.5">
                  <Play size={12} className="text-accent" />
                  {session.agentType}
                </span>
                {session.branch && (
                  <>
                    <span className="text-border-strong">•</span>
                    <span className="font-mono">{session.branch}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-3 gap-6 p-6 overflow-hidden">
          <div className="col-span-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="p-2 rounded-xl bg-accent-soft">
                <Activity size={16} className="text-accent" />
              </div>
              <h2 className="text-sm font-semibold text-fg-strong">Activity</h2>
            </div>
            <div className="flex-1 overflow-y-auto rounded-2xl bg-surface/50 border border-border">
              {session.hasPendingApproval && (
                <div className="p-4 border-b border-border">
                  <ApprovalCard session={session} />
                </div>
              )}
              <ActivityFeed sessionName={session.name} />
            </div>
          </div>

          <div className="col-span-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="p-2 rounded-xl bg-accent-soft">
                <TerminalIcon size={16} className="text-accent" />
              </div>
              <h2 className="text-sm font-semibold text-fg-strong">Terminal</h2>
            </div>
            <div className="flex-1 overflow-hidden rounded-2xl bg-surface/50 border border-border">
              <LazyTerminal sessionId={session.name} />
            </div>
          </div>

          <div className="col-span-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="p-2 rounded-xl bg-accent-soft">
                <Folder size={16} className="text-accent" />
              </div>
              <h2 className="text-sm font-semibold text-fg-strong">Files</h2>
            </div>
            <div className="flex-1 overflow-hidden rounded-2xl bg-surface/50 border border-border">
              <LazyFileView sessionName={session.name} />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 p-6 pt-4 bg-gradient-to-t from-bg to-transparent">
          <div className="flex gap-3 max-w-2xl mx-auto items-end">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message... (Shift+Enter for new line)"
              className="input-field flex-1 resize-none min-h-[44px] max-h-32"
              rows={1}
              aria-label="Message input"
            />
            <VoiceInput
              onTranscript={(text) => setMessage((prev) => prev + (prev ? ' ' : '') + text)}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="btn btn-primary self-end flex items-center gap-2"
              aria-label={sending ? 'Sending message' : 'Send message'}
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </>
              ) : (
                'Send'
              )}
            </button>
          </div>
          {sendError && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-400 max-w-2xl mx-auto">
              <AlertCircle size={14} />
              {sendError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="floating-header px-5 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost p-2"
            aria-label="Go back"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-fg-strong truncate">{session.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted mt-0.5">
              <span className="flex items-center gap-1.5">
                <Play size={12} className="text-accent" />
                {session.agentType}
              </span>
              {session.branch && (
                <>
                  <span className="text-border-strong">•</span>
                  <span className="font-mono">{session.branch}</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={clsx(
              'btn p-3 rounded-xl transition-all duration-200',
              showTerminal 
                ? 'bg-accent text-white shadow-[0_0_20px_rgba(232,152,94,0.4)]' 
                : 'btn-ghost'
            )}
            aria-label={showTerminal ? 'Hide terminal' : 'Show terminal'}
          >
            <TerminalIcon size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden pb-32">
        {session.hasPendingApproval && (
          <div className="p-5">
            <ApprovalCard session={session} />
          </div>
        )}

        {activeTab === 'feed' && !showTerminal && (
          <div className="h-full overflow-y-auto">
            <ActivityFeed sessionName={session.name} />
          </div>
        )}

        {(activeTab === 'terminal' || showTerminal) && (
          <div className="h-full">
            <LazyTerminal sessionId={session.name} />
          </div>
        )}

        {activeTab === 'files' && (
          <div className="h-full">
            <LazyFileView sessionName={session.name} />
          </div>
        )}
      </div>

      <SessionTabBar />

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-bg via-bg to-transparent safe-area-inset z-10">
        <div className="flex gap-3 max-w-3xl mx-auto items-end">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message... (Shift+Enter for new line)"
            className="input-field flex-1 resize-none min-h-[48px] max-h-32"
            rows={1}
            aria-label="Message input"
          />
          <VoiceInput
            onTranscript={(text) => setMessage((prev) => prev + (prev ? ' ' : '') + text)}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="btn btn-primary self-end flex items-center gap-2 px-6"
            aria-label={sending ? 'Sending message' : 'Send message'}
          >
            {sending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending...
              </>
            ) : (
              'Send'
            )}
          </button>
        </div>
        {sendError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-400 max-w-3xl mx-auto">
            <AlertCircle size={14} />
            {sendError}
          </div>
        )}
      </div>
    </div>
  );
}
