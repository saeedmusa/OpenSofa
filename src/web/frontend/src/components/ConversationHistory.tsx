import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { useWebSocket } from '../providers/WebSocketProvider';
import type { AgentAPIMessage, ActivityEvent } from '../types';
import { clsx } from 'clsx';
import { ArrowDown, Loader2, AlertCircle } from 'lucide-react';

interface ConversationHistoryProps {
  sessionName: string;
}

/**
 * Clean terminal-formatted text from AgentAPI.
 * AgentAPI returns text with hard line breaks at ~80 chars.
 * We join lines that appear to be soft wraps (not code blocks, prompts, or blank lines).
 */
function cleanTerminalText(text: string): string {
  const lines = text.split('\n');
  const cleaned: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Keep blank lines as intentional breaks
    if (trimmed === '') {
      cleaned.push('');
      i++;
      continue;
    }

    // Keep lines that look like code/prompts (start with $, >, #, |, or are indented)
    if (/^[\s$>#|]/.test(line) || line.startsWith('```')) {
      cleaned.push(line);
      i++;
      continue;
    }

    // Join with next line if current line doesn't end with punctuation
    // and next line exists and isn't a special line
    let joined = line;
    while (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextTrimmed = nextLine.trim();

      // Stop joining if next line is blank, special, or current line ends with sentence-ending punctuation
      if (nextTrimmed === '' || /^[\s$>#|]/.test(nextLine) || nextLine.startsWith('```')) break;
      if (/[.!?;:]$/.test(trimmed)) break;

      // Join the lines
      joined = `${joined} ${nextTrimmed}`;
      i++;
    }

    cleaned.push(joined);
    i++;
  }

  return cleaned.join('\n');
}

/**
 * Format timestamp to relative time (e.g., "2m ago") or absolute on tap
 */
function formatTime(isoTime: string, showAbsolute: boolean): string {
  const date = new Date(isoTime);
  if (showAbsolute) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/** Max lines to show before truncating */
const MAX_VISIBLE_LINES = 20;

export function ConversationHistory({ sessionName }: ConversationHistoryProps) {
  const [messages, setMessages] = useState<AgentAPIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAbsoluteTime, setShowAbsoluteTime] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { subscribe } = useWebSocket();
  const refetchTimerRef = useRef<number | null>(null);
  const lastMessageCountRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Fetch messages from API
  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.sessions.messages(sessionName);
      setMessages(data.messages);
      // If we got new messages, clear streaming text (it's now in the completed messages)
      if (data.messages.length > lastMessageCountRef.current) {
        setStreamingText('');
      }
      lastMessageCountRef.current = data.messages.length;
      // Auto-scroll after render
      requestAnimationFrame(scrollToBottom);
    } catch {
      // Silently fail on refetch — initial load error is already shown
    }
  }, [sessionName, scrollToBottom]);

  // Debounced refetch — prevents hammering API on rapid events
  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
    }
    refetchTimerRef.current = window.setTimeout(() => {
      fetchMessages();
      refetchTimerRef.current = null;
    }, 500);
  }, [fetchMessages]);

  // Load messages on mount
  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.sessions.messages(sessionName);
        if (!cancelled) {
          setMessages(data.messages);
          lastMessageCountRef.current = data.messages.length;
          // Auto-scroll after render
          requestAnimationFrame(scrollToBottom);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load messages');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadMessages();
    return () => { cancelled = true; };
  }, [sessionName, scrollToBottom]);

  // Subscribe to WS events for real-time updates
  useEffect(() => {
    const unsubs = [
      // When session updates (agent status change, etc.), refetch messages
      subscribe('session_updated', (event) => {
        if (event.sessionName === sessionName) {
          debouncedRefetch();
        }
      }),
      // When activity events arrive, capture streaming text and trigger refetch
      subscribe('activity', (event) => {
        const payload = event.payload as { sessionName?: string; events?: ActivityEvent[] } | undefined;
        if (payload?.sessionName !== sessionName) return;

        if (payload.events) {
          for (const actEvent of payload.events) {
            // agent_message type means text from the agent
            if (actEvent.type === 'agent_message' && actEvent.summary) {
              setStreamingText(prev => prev + actEvent.summary);
              requestAnimationFrame(scrollToBottom);
            }
          }
        }

        // Refetch completed messages (debounced)
        debouncedRefetch();
      }),
      // When approval is needed/cleared, refetch
      subscribe('approval_needed', (event) => {
        const payload = event.payload as { sessionName?: string };
        if (payload?.sessionName === sessionName) debouncedRefetch();
      }),
      subscribe('approval_cleared', (event) => {
        const payload = event.payload as { sessionName?: string };
        if (payload?.sessionName === sessionName) debouncedRefetch();
      }),
    ];

    return () => {
      unsubs.forEach(fn => fn());
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
    };
  }, [subscribe, sessionName, debouncedRefetch, scrollToBottom]);

  // Track scroll position for "scroll to bottom" button
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollButton(distanceFromBottom > 200);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-matrix-green" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertCircle size={24} className="text-neon-red mb-3" />
        <p className="text-sm text-muted font-mono">{error}</p>
      </div>
    );
  }

  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <span className="material-symbols-outlined text-matrix-green text-3xl mb-3">chat_bubble_outline</span>
        <p className="text-sm text-on-surface font-mono">NO_MESSAGES</p>
        <p className="text-xs text-muted font-mono mt-1">Conversation will appear here</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto terminal-scroll p-4 space-y-4"
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            showAbsoluteTime={showAbsoluteTime}
            onToggleTime={() => setShowAbsoluteTime(prev => !prev)}
          />
        ))}

        {/* Streaming text — shows live agent output */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-4 py-3 bg-surface-container-low border border-outline-variant/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-accent">
                  AGENT
                </span>
                <span className="text-[10px] text-muted font-mono flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 bg-matrix-green rounded-full animate-pulse" />
                  typing...
                </span>
              </div>
              <div className="text-sm font-mono whitespace-pre-wrap break-words text-on-surface/90">
                {streamingText}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2 bg-surface-container-high border border-outline-variant/30 shadow-lg hover:bg-surface-container-highest transition-colors"
          aria-label="Scroll to latest message"
        >
          <ArrowDown size={16} className="text-matrix-green" />
        </button>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: AgentAPIMessage;
  showAbsoluteTime: boolean;
  onToggleTime: () => void;
}

function MessageBubble({ message, showAbsoluteTime, onToggleTime }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const cleanedContent = isUser ? message.content : cleanTerminalText(message.content);
  const [expanded, setExpanded] = useState(false);

  const lines = cleanedContent.split('\n');
  const isTruncated = lines.length > MAX_VISIBLE_LINES && !expanded;
  const displayContent = isTruncated
    ? lines.slice(0, MAX_VISIBLE_LINES).join('\n')
    : cleanedContent;

  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-lg px-4 py-3',
          isUser
            ? 'bg-matrix-green/10 border border-matrix-green/30'
            : 'bg-surface-container-low border border-outline-variant/20'
        )}
      >
        {/* Role label + timestamp */}
        <div className="flex items-center gap-2 mb-1">
          <span className={clsx(
            'text-[10px] font-mono uppercase tracking-wider',
            isUser ? 'text-matrix-green' : 'text-cyan-accent'
          )}>
            {isUser ? 'YOU' : 'AGENT'}
          </span>
          <button
            onClick={onToggleTime}
            className="text-[10px] text-muted font-mono hover:text-on-surface transition-colors"
          >
            {formatTime(message.time, showAbsoluteTime)}
          </button>
        </div>

        {/* Message content */}
        <div className={clsx(
          'text-sm font-mono whitespace-pre-wrap break-words',
          isUser ? 'text-on-surface' : 'text-on-surface/90'
        )}>
          {displayContent}
        </div>

        {/* Show more/less for long messages */}
        {isTruncated && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-2 text-xs text-matrix-green font-mono hover:underline"
          >
            Show more ({lines.length - MAX_VISIBLE_LINES} more lines)
          </button>
        )}
        {expanded && lines.length > MAX_VISIBLE_LINES && (
          <button
            onClick={() => setExpanded(false)}
            className="mt-2 text-xs text-muted font-mono hover:underline"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
