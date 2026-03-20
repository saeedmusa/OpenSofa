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
    <div className="flex items-center gap-4 p-4 bg-void border-t border-matrix-green/30">
      {/* Terminal prompt */}
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-matrix-green font-mono font-bold">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="instruct agent..."
          className="w-full bg-surface-container-lowest border-b border-surface-container-high focus:border-matrix-green focus:ring-0 text-matrix-green font-mono pl-8 py-2 text-sm placeholder:opacity-30 placeholder:text-muted"
          aria-label="Terminal input"
        />
      </div>
      
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button 
          className="p-2 text-cyan-accent hover:bg-cyan-accent/10 transition-colors"
          aria-label="Voice input"
        >
          <span className="material-symbols-outlined">mic</span>
        </button>
        <button 
          className="p-2 text-cyan-accent hover:bg-cyan-accent/10 transition-colors"
          aria-label="Video"
        >
          <span className="material-symbols-outlined">videocam</span>
        </button>
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          className="bg-matrix-green text-void px-6 py-2 font-mono font-bold text-xs hover:bg-matrix-green-fixed active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isSending ? "Sending command" : "Send command"}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'SEND'
          )}
        </button>
      </div>
    </div>
  );
}
