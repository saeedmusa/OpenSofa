import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Terminal as TerminalIcon, Loader2, AlertCircle, ChevronDown, Square } from 'lucide-react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { useSessionStore } from '../stores/sessionStore';
import { api } from '../utils/api';
import { safeVibrate } from '../utils/haptics';
import { LazyTerminal } from '../components/LazyTerminal';
import { ActivityFeed } from '../components/ActivityFeed';
import { ApprovalCard } from '../components/ApprovalCard';
import { LazyFileView } from '../components/LazyFileView';
import { ConversationHistory } from '../components/ConversationHistory';
import { FilesChanged } from '../components/FilesChanged';
import { ModelPicker } from '../components/ModelPicker';
import { SessionTabBar } from '../components/TabBar';
import { VoiceInput } from '../components/VoiceInput';
import { CameraUpload } from '../components/CameraUpload';
import { Logo } from '../components/Logo';
import { useResponsive } from '../hooks/useResponsive';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { useToast } from '../components/Toast';
import { clsx } from 'clsx';

export function SessionView() {
  const { name, tab } = useParams<{ name: string; tab?: string }>();
  const navigate = useNavigate();
  const { subscribe, subscribeTerminal, unsubscribeTerminal } = useWebSocket();
  const { selectedSession, setSelectedSession } = useSessionStore();
  const { isDesktop } = useResponsive();
  const [showTerminal, setShowTerminal] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [message, setMessage] = useState('');
  const toast = useToast();

  // Swipe right to go back (mobile only)
  const swipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeRight: () => {
      if (!isDesktop) {
        safeVibrate(10);
        navigate('/');
      }
    },
    disabled: isDesktop,
  });

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
    // WS events handle real-time updates — no polling needed
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
  const [autoApprove, setAutoApprove] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Initialize autoApprove from server state
  useEffect(() => {
    if (selectedSession && 'autoApprove' in selectedSession) {
      setAutoApprove(!!(selectedSession as unknown as Record<string, unknown>).autoApprove);
    }
  }, [selectedSession]);

  // iOS keyboard handling — adjust input bar position when virtual keyboard opens
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // The difference between window.innerHeight and viewport height is the keyboard
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(Math.max(0, offset));
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  const handleStop = async () => {
    if (!decodedName) return;
    try {
      await api.sessions.stop(decodedName);
      toast.success('Agent stopped');
      safeVibrate(50);
    } catch (err) {
      toast.error('Failed to stop agent');
    }
  };

  const handleAutoApproveToggle = async () => {
    if (!decodedName) return;
    const newValue = !autoApprove;
    try {
      await api.sessions.updateSettings(decodedName, { autoApprove: newValue });
      setAutoApprove(newValue);
      toast.success(newValue ? 'Auto-approve ON' : 'Auto-approve OFF');
      safeVibrate(30);
    } catch {
      toast.error('Failed to toggle auto-approve');
    }
  };

  const handleSend = async () => {
    if (!decodedName || !message.trim() || sending) return;
    
    setSending(true);
    setSendError(null);
    
    try {
      await api.sessions.message(decodedName, message.trim());
      setMessage('');
      // Haptic feedback on success
      safeVibrate(50);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      console.error('Failed to send message:', err);
      setSendError(errorMsg);
      // Haptic feedback on error
      safeVibrate([30, 50, 30]);
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
      <div className="flex items-center justify-center min-h-screen bg-void">
        <div className="w-10 h-10 border-2 border-matrix-green border-t-transparent animate-spin" />
      </div>
    );
  }

  const session = selectedSession;
  const activeTab = tab || 'feed';

  if (isDesktop) {
    return (
      <div className="flex flex-col h-screen bg-void">
        {/* Terminal-style header — HUD glassmorphism */}
        <header className="header-terminal px-6 py-3">
          <div className="flex items-center gap-4">
            <Logo size="md" />

            <button
              onClick={() => navigate('/')}
              className="text-matrix-green hover:bg-matrix-green/10 p-2 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-cyan-accent bg-cyan-accent/10 px-2 py-0.5 border border-cyan-accent/30">
                  {session.agentType.toUpperCase()}
                </span>
                <h1 className="text-lg font-mono font-bold text-on-surface truncate">{session.name}</h1>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {session.branch && (
                  <span className="text-xs font-mono text-muted">
                    BRANCH: <span className="text-matrix-green">{session.branch}</span>
                  </span>
                )}
                {session.model && (
                  <button
                    onClick={() => setShowModelPicker(true)}
                    className="text-xs font-mono text-muted hover:text-on-surface flex items-center gap-1 transition-colors"
                    aria-label="Change model"
                  >
                    MODEL: <span className="text-cyan-accent">{session.model}</span>
                    <ChevronDown size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {session.agentStatus === 'running' && (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-1 text-[10px] font-mono text-neon-red bg-neon-red/10 border border-neon-red/30 px-2 py-1 hover:bg-neon-red/20 transition-colors"
                  aria-label="Stop agent"
                >
                  <Square size={10} /> STOP
                </button>
              )}
              <button
                onClick={handleAutoApproveToggle}
                className={clsx(
                  'text-[10px] font-mono px-2 py-1 border transition-colors',
                  autoApprove
                    ? 'text-matrix-green bg-matrix-green/10 border-matrix-green/30'
                    : 'text-muted bg-surface-container border-outline-variant/30 hover:border-matrix-green/30'
                )}
                aria-label={autoApprove ? 'Disable auto-approve' : 'Enable auto-approve'}
              >
                AUTO: {autoApprove ? 'ON' : 'OFF'}
              </button>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-matrix-green">SYS:</span>
                <span className="text-muted">ONLINE</span>
              </div>
            </div>
          </div>
        </header>

        {/* Four-column layout — Activity | Chat | Terminal | Files */}
        <div className="flex-1 grid grid-cols-4 gap-4 p-6 overflow-hidden">
          {/* Activity Column */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4 px-2">
              <span className="material-symbols-outlined text-cyan-accent text-lg">receipt_long</span>
              <h2 className="text-sm font-mono font-bold text-on-surface tracking-wider">ACTIVITY_LOG</h2>
            </div>
            <div className="flex-1 overflow-y-auto terminal-scroll bg-surface-container-low border border-outline-variant/30">
              {session.hasPendingApproval && (
                <div className="p-4 border-b border-outline-variant/30">
                  <ApprovalCard session={session} />
                </div>
              )}
              <ActivityFeed sessionName={session.name} />
            </div>
          </div>

          {/* Chat Column */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4 px-2">
              <span className="material-symbols-outlined text-cyan-accent text-lg">chat</span>
              <h2 className="text-sm font-mono font-bold text-on-surface tracking-wider">CHAT</h2>
            </div>
            <div className="flex-1 overflow-hidden bg-surface-container-low border border-outline-variant/30">
              <ConversationHistory sessionName={session.name} />
            </div>
          </div>

          {/* Terminal Column */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4 px-2">
              <span className="material-symbols-outlined text-matrix-green text-lg">terminal</span>
              <h2 className="text-sm font-mono font-bold text-on-surface tracking-wider">TERMINAL</h2>
            </div>
            <div className="flex-1 overflow-hidden bg-void border border-matrix-green/20">
              <LazyTerminal sessionId={session.name} />
            </div>
          </div>

          {/* Files Column */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4 px-2">
              <span className="material-symbols-outlined text-cyan-accent text-lg">folder_open</span>
              <h2 className="text-sm font-mono font-bold text-on-surface tracking-wider">FILES</h2>
            </div>
            <div className="flex-1 overflow-hidden bg-surface-container-low border border-outline-variant/30">
              <LazyFileView sessionName={session.name} />
            </div>
          </div>
        </div>

        {/* Input area — Terminal prompt style */}
        <div className="p-6 pt-4 bg-void border-t border-matrix-green/30">
          <div className="flex gap-3 max-w-2xl mx-auto items-end">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-matrix-green font-mono font-bold">&gt;</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="instruct agent..."
                className="w-full bg-surface-container-lowest border-b-2 border-surface-container-high focus:border-matrix-green text-matrix-green font-mono pl-10 pr-4 py-3 resize-none min-h-[48px] max-h-32 placeholder:opacity-30 placeholder:text-muted"
                rows={1}
                aria-label="Message input"
              />
            </div>
            <CameraUpload
              sessionName={session.name}
              onUploaded={(_url) => toast.success(`Image uploaded`)}
            />
            <VoiceInput
              onTranscript={(text) => setMessage((prev) => prev + (prev ? ' ' : '') + text)}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="bg-matrix-green text-void px-6 py-3 font-mono font-bold text-xs hover:bg-matrix-green-fixed active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={sending ? 'Sending message' : 'Send message'}
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'SEND'
              )}
            </button>
          </div>
          {sendError && (
            <div className="mt-2 flex items-center gap-2 text-sm text-neon-red max-w-2xl mx-auto font-mono">
              <AlertCircle size={14} />
              {sendError}
            </div>
          )}
        </div>

        {/* Model Picker Modal */}
        {showModelPicker && (
          <ModelPicker
            sessionName={session.name}
            agentType={session.agentType}
            currentModel={session.model}
            onClose={() => setShowModelPicker(false)}
            onModelChanged={(newModel) => {
              toast.success(`Model switched to ${newModel}`);
              setShowModelPicker(false);
              // Refresh session data
              api.sessions.get(decodedName).then(setSelectedSession).catch(() => {});
            }}
          />
        )}
      </div>
    );
  }

  // Mobile layout
  return (
    <div ref={swipeRef} className="flex flex-col h-screen bg-void">
      {/* Terminal-style header */}
      <header className="header-terminal px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-matrix-green hover:bg-matrix-green/10 p-2 -ml-2 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>

          <Logo size="sm" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-cyan-accent bg-cyan-accent/10 px-1.5 py-0.5 border border-cyan-accent/30">
                {session.agentType.toUpperCase()}
              </span>
              <h1 className="text-sm font-mono font-bold text-on-surface truncate">{session.name}</h1>
            </div>
          </div>

          {session.agentStatus === 'running' && (
            <button
              onClick={handleStop}
              className="p-2 text-neon-red hover:bg-neon-red/10 transition-colors"
              aria-label="Stop agent"
            >
              <Square size={20} />
            </button>
          )}
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={clsx(
              'p-2 transition-all',
              showTerminal 
                ? 'bg-matrix-green text-void' 
                : 'text-matrix-green hover:bg-matrix-green/10'
            )}
            aria-label={showTerminal ? 'Hide terminal' : 'Show terminal'}
          >
            <TerminalIcon size={20} />
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden pb-32">
        {session.hasPendingApproval && (
          <div className="p-5">
            <ApprovalCard session={session} />
          </div>
        )}

        {activeTab === 'feed' && !showTerminal && (
          <div className="h-full overflow-y-auto terminal-scroll">
            <ActivityFeed sessionName={session.name} />
          </div>
        )}

        {activeTab === 'chat' && !showTerminal && (
          <div className="h-full">
            <ConversationHistory sessionName={session.name} />
          </div>
        )}

        {(activeTab === 'terminal' || showTerminal) && (
          <div className="h-full bg-void">
            <LazyTerminal sessionId={session.name} />
          </div>
        )}

        {activeTab === 'files' && (
          <div className="h-full">
            <LazyFileView sessionName={session.name} />
          </div>
        )}

        {activeTab === 'changes' && (
          <div className="h-full">
            <FilesChanged sessionName={session.name} />
          </div>
        )}
      </div>

      <SessionTabBar />

      {/* Fixed input bar at bottom — Terminal prompt */}
      <div className="fixed left-0 right-0 p-4 bg-void border-t border-matrix-green/30 z-10" style={{ bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : '64px' }}>
        <div className="flex gap-3 max-w-3xl mx-auto items-end">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-matrix-green font-mono font-bold text-lg">&gt;</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="instruct agent..."
              className="w-full bg-surface-container-lowest border-b-2 border-surface-container-high focus:border-matrix-green text-matrix-green font-mono text-sm pl-9 pr-4 py-2.5 resize-none min-h-[44px] max-h-32 placeholder:opacity-30 placeholder:text-muted"
              rows={1}
              aria-label="Message input"
            />
          </div>
          <CameraUpload
            sessionName={session.name}
            onUploaded={(_url) => toast.success(`Image uploaded`)}
          />
          <VoiceInput
            onTranscript={(text) => setMessage((prev) => prev + (prev ? ' ' : '') + text)}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="bg-matrix-green text-void px-5 py-2.5 font-mono font-bold text-xs hover:bg-matrix-green-fixed active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={sending ? 'Sending message' : 'Send message'}
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              'SEND'
            )}
          </button>
        </div>
        {sendError && (
          <div className="mt-2 flex items-center gap-2 text-xs text-neon-red max-w-3xl mx-auto font-mono">
            <AlertCircle size={12} />
            {sendError}
          </div>
        )}
      </div>
    </div>
  );
}
