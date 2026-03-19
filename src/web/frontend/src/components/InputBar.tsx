import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { Loader2 } from 'lucide-react';

interface InputBarProps {
  sessionId: string;
  getTerminal: () => import('@xterm/xterm').Terminal | null;
}

export function InputBar({ sessionId, getTerminal }: InputBarProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { send: wsSend } = useWebSocket();

  const handleSend = useCallback(() => {
    if (!input.trim() || isSending) return;
    
    setIsSending(true);
    
    // Send message via WebSocket
    wsSend({
      type: 'terminal_input',
      payload: { sessionId, content: input }
    });
    
    setInput('');
    // Focus terminal after sending so user can see output
    setTimeout(() => getTerminal()?.focus(), 50);
    
    // Clear loading state after a short delay (simulating send complete)
    setTimeout(() => setIsSending(false), 300);
  }, [input, sessionId, wsSend, getTerminal, isSending]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  if (typeof window === 'undefined' || !('ontouchstart' in window)) return null;

  return (
    <div className="flex gap-2 p-2.5 bg-[#0f1512] border-t border-emerald-900/30 flex-shrink-0">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type command..."
        className="flex-1 h-11 px-4 bg-[#1a2a1f] rounded-xl text-sm text-emerald-100 placeholder-emerald-600/50 font-mono outline-none border border-emerald-800/30 focus:border-emerald-500/50 transition-colors"
        aria-label="Terminal input"
      />
      <button
        onClick={handleSend}
        disabled={!input.trim() || isSending}
        className="h-11 px-5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-emerald-800/50 disabled:text-emerald-600/50 rounded-xl text-sm text-white font-semibold transition-colors flex items-center gap-2 min-w-[80px] justify-center"
        aria-label={isSending ? "Sending command" : "Send command"}
      >
        {isSending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
        {isSending ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
