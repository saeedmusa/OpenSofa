import { useState, useRef, useEffect, useCallback } from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { api } from '../utils/api';
import type { AgentAPIMessage, ActivityEvent } from '../types';
import { ArrowDown, Loader2, AlertCircle } from 'lucide-react';

interface ConversationHistoryProps {
  sessionName: string;
}

const MAX_VISIBLE_LINES = 50;

/**
 * Formats message content, specifically handling 'thoughts' or 'plans'
 * from agents like DeepSeek (which use <think> or direct Planning output).
 */
function formatMessageContent(content: string, expandedThoughts: Set<string>, onToggleThought: (id: string) => void, messageId: number | string) {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const planRegex = /(▣ Plan · [\s\S]*?)(?=\n\n|\n[A-Z]|$)/g; 
  
  if (!content.includes('<think>') && !content.includes('▣')) {
    return cleanTerminalText(content);
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const specialBlocks: { type: 'think' | 'plan', start: number, end: number, content: string, header?: string }[] = [];
  
  let match;
  while ((match = thinkRegex.exec(content)) !== null) {
    specialBlocks.push({ type: 'think', start: match.index, end: thinkRegex.lastIndex, content: match[1].trim() });
  }
  
  while ((match = planRegex.exec(content)) !== null) {
    const lines = match[1].split('\n');
    const header = lines[0];
    const body = lines.slice(1).join('\n').trim();
    specialBlocks.push({ type: 'plan', start: match.index, end: planRegex.lastIndex, content: body, header });
  }

  specialBlocks.sort((a, b) => a.start - b.start);

  for (const block of specialBlocks) {
    if (block.start > lastIndex) {
      parts.push(cleanTerminalText(content.substring(lastIndex, block.start)));
    }

    const blockId = `${messageId}-${block.type}-${block.start}`;
    const isExpanded = expandedThoughts.has(blockId);
    const label = block.type === 'think' ? 'THOUGHTS' : (block.header || 'PLAN');

    parts.push(
      <div key={blockId} className="my-2 border-l-2 border-cyan-accent/30 bg-cyan-accent/5 overflow-hidden">
        <button
          onClick={() => onToggleThought(blockId)}
          className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[10px] font-mono text-cyan-accent/70 hover:bg-cyan-accent/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">
            {isExpanded ? 'expand_more' : 'chevron_right'}
          </span>
          <span className="truncate">{label}</span>
          <span className="text-muted/50 ml-auto flex-shrink-0">
            {isExpanded ? 'Click to hide' : 'Click to show'}
          </span>
        </button>
        {isExpanded && (
          <div className="px-3 py-2 text-xs text-on-surface/70 italic border-t border-cyan-accent/10 whitespace-pre-wrap font-mono">
            {cleanTerminalText(block.content)}
          </div>
        )}
      </div>
    );
    lastIndex = block.end;
  }

  const remaining = content.substring(lastIndex);
  if (remaining) {
    parts.push(cleanTerminalText(remaining));
  }

  return parts;
}

function cleanTerminalText(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  const cleaned: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      cleaned.push('');
      i++;
      continue;
    }

    if (/^[\s$>#|]/.test(line) || line.startsWith('```')) {
      cleaned.push(line);
      i++;
      continue;
    }

    let joined = line;
    while (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextTrimmed = nextLine.trim();

      if (nextTrimmed === '' || /^[\s$>#|]/.test(nextLine) || nextLine.startsWith('```')) break;
      if (/[.!?;:]$/.test(trimmed)) break;

      joined = `${joined} ${nextTrimmed}`;
      i++;
    }

    cleaned.push(joined);
    i++;
  }

  return cleaned.join('\n');
}

function formatTime(iso: string, absolute: boolean) {
  const date = new Date(iso);
  if (absolute) return date.toLocaleString();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ConversationHistory({ sessionName }: ConversationHistoryProps) {
  const [messages, setMessages] = useState<AgentAPIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAbsoluteTime, setShowAbsoluteTime] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [expandedThoughts, setExpandedThoughts] = useState<Set<string>>(new Set());
  
  const handleToggleThought = useCallback((id: string) => {
    setExpandedThoughts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { subscribe } = useWebSocket();

  const refetchTimerRef = useRef<any>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(async () => {
      try {
        const data = await api.sessions.messages(sessionName);
        setMessages(data.messages);
        setStreamingText('');
        requestAnimationFrame(scrollToBottom);
      } catch (err) {
        console.error('Failed to refetch messages:', err);
      }
    }, 100);
  }, [sessionName, scrollToBottom]);

  // Initial load + Event Subscriptions
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const data = await api.sessions.messages(sessionName);
        setMessages(data.messages);
      } catch (err) {
        setError('Failed to load conversation history');
      } finally {
        setIsLoading(false);
        requestAnimationFrame(scrollToBottom);
      }
    }
    init();

    const unsubs = [
      subscribe('agent_response', (event) => {
        const payload = event.payload as { sessionName?: string; agentMessage?: string } | undefined;
        if (payload?.sessionName === sessionName) {
          if (payload.agentMessage) {
            const newMessage: AgentAPIMessage = {
              id: Date.now(),
              role: 'agent',
              content: payload.agentMessage,
              time: new Date().toISOString()
            };
            setMessages(prev => [...prev, newMessage]);
            setStreamingText('');
            requestAnimationFrame(scrollToBottom);
          } else {
            debouncedRefetch();
          }
        }
      }),
      subscribe('activity', (event) => {
        const payload = event.payload as { sessionName?: string; events?: ActivityEvent[] } | undefined;
        if (payload?.sessionName !== sessionName) return;

        if (payload.events) {
          for (const actEvent of payload.events) {
            if (actEvent.type === 'agent_message' && actEvent.summary) {
              setStreamingText(prev => prev + actEvent.summary);
              requestAnimationFrame(scrollToBottom);
            }
          }
        }
        debouncedRefetch();
      }),
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
            expandedThoughts={expandedThoughts}
            onToggleThought={handleToggleThought}
          />
        ))}

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
                {formatMessageContent(streamingText, expandedThoughts, handleToggleThought, 'streaming')}
              </div>
            </div>
          </div>
        )}
      </div>

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
  expandedThoughts: Set<string>;
  onToggleThought: (id: string) => void;
}

function MessageBubble({ message, showAbsoluteTime, onToggleTime, expandedThoughts, onToggleThought }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [expanded, setExpanded] = useState(false);

  if (isUser) {
    const lines = message.content.split('\n');
    const isTruncated = lines.length > MAX_VISIBLE_LINES && !expanded;
    const displayContent = isTruncated
      ? lines.slice(0, MAX_VISIBLE_LINES).join('\n')
      : message.content;

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg px-4 py-3 bg-matrix-green/10 border border-matrix-green/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-matrix-green">YOU</span>
            <button onClick={onToggleTime} className="text-[10px] text-muted font-mono hover:text-on-surface transition-colors">
              {formatTime(message.time, showAbsoluteTime)}
            </button>
          </div>
          <div className="text-sm font-mono whitespace-pre-wrap break-words text-on-surface">
            {displayContent}
          </div>
          {isTruncated && (
            <button onClick={() => setExpanded(true)} className="mt-2 text-xs text-matrix-green font-mono hover:underline">
              Show more ({lines.length - MAX_VISIBLE_LINES} more lines)
            </button>
          )}
        </div>
      </div>
    );
  }

  const content = formatMessageContent(message.content, expandedThoughts, onToggleThought, message.id);
  const lines = message.content.split('\n');
  const isTruncated = lines.length > MAX_VISIBLE_LINES && !expanded;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg px-4 py-3 bg-surface-container-low border border-outline-variant/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-accent">AGENT</span>
          <button onClick={onToggleTime} className="text-[10px] text-muted font-mono hover:text-on-surface transition-colors">
            {formatTime(message.time, showAbsoluteTime)}
          </button>
        </div>
        <div className="text-sm font-mono break-words text-on-surface/90">
          {isTruncated && !expanded ? (
            <div className="whitespace-pre-wrap">{cleanTerminalText(lines.slice(0, MAX_VISIBLE_LINES).join('\n'))}</div>
          ) : (
            content
          )}
        </div>
        {isTruncated && !expanded && (
          <button onClick={() => setExpanded(true)} className="mt-2 text-xs text-matrix-green font-mono hover:underline">
            Show more ({lines.length - MAX_VISIBLE_LINES} more lines)
          </button>
        )}
        {expanded && lines.length > MAX_VISIBLE_LINES && (
          <button onClick={() => setExpanded(false)} className="mt-2 text-xs text-muted font-mono hover:underline">
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
