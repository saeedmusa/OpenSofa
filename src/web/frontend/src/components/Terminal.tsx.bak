import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useWebSocket } from '../providers/WebSocketProvider';
import { getResponsiveDimensions } from '../utils/terminal';
import { useResponsive } from '../hooks/useResponsive';
import { useToast } from './Toast';
import { InputBar } from './InputBar';

interface TerminalProps {
  sessionId: string;
}

export function Terminal({ sessionId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastDimensionsRef = useRef<{ cols: number; rows: number } | null>(null);
  const { subscribe, send } = useWebSocket();
  const { isMobile, isTablet } = useResponsive();

  const getTerminal = useCallback(() => terminalRef.current, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    if (lastDimensionsRef.current?.cols === cols && lastDimensionsRef.current?.rows === rows) {
      return;
    }
    lastDimensionsRef.current = { cols, rows };
    
    send({
      type: 'terminal_resize',
      payload: { sessionId, cols, rows }
    });
  }, [sessionId, send]);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const containerWidth = containerRef.current.clientWidth || window.innerWidth;
    const dimensions = getResponsiveDimensions(containerWidth);

    // Larger font for mobile readability
    const fontSize = isMobile ? 16 : isTablet ? 14 : 13;
    const lineHeight = isMobile ? 1.4 : 1.5;

    const term = new XTerm({
      cols: dimensions.cols,
      rows: dimensions.rows,
      theme: {
        background: '#0a0f0c',
        foreground: '#e8f5e8',
        cursor: '#4ade80',
        cursorAccent: '#0a0f0c',
        selectionBackground: 'rgba(74, 222, 128, 0.3)',
        selectionForeground: '#ffffff',
        black: '#1a221c',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#d1fae5',
        brightBlack: '#6b7280',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ecfdf5',
        scrollbarSliderBackground: 'rgba(74, 222, 128, 0.2)',
        scrollbarSliderHoverBackground: 'rgba(74, 222, 128, 0.3)',
        scrollbarSliderActiveBackground: 'rgba(74, 222, 128, 0.4)',
      },
      fontFamily: "'SF Mono', 'Menlo', 'Fira Code', 'Consolas', monospace",
      fontSize,
      lineHeight,
      fontWeight: '400',
      letterSpacing: isMobile ? 0.5 : 0,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      scrollback: isMobile ? 500 : 1000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    
    fitAddon.fit();
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    sendResize(term.cols, term.rows);

    const unsubscribe = subscribe('terminal_output', (event) => {
      const payload = event.payload as { data?: string } | undefined;
      if (payload?.data) {
        try {
          const decoded = atob(payload.data);
          term.write(decoded);
        } catch {
          term.write(payload.data);
        }
      }
    });

    const handleResize = () => {
      if (!fitAddonRef.current || !terminalRef.current) return;
      
      fitAddonRef.current.fit();
      sendResize(terminalRef.current.cols, terminalRef.current.rows);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', handleResize);
      term.dispose();
      terminalRef.current = null;
    };
  }, [sessionId, subscribe, sendResize, isMobile, isTablet]);

    return (
    <div className="w-full h-full min-h-[200px] flex flex-col rounded-2xl overflow-hidden bg-[#0a0f0c] border border-border">
      <TerminalWarning />
      <InputBar 
        sessionId={sessionId}
        getTerminal={getTerminal}
      />
      <div ref={containerRef} className="flex-1 p-2" />
      <MobileTerminalBar getTerminal={getTerminal} sessionId={sessionId} />
    </div>
  );
}

function TerminalWarning() {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed) return null;
  
  const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window;
  if (!isMobile) return null;

  return (
    <div className="bg-emerald-500/10 border-b border-emerald-500/25 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
      <span className="text-emerald-400 text-xs font-medium">
        Use landscape mode for best terminal view
      </span>
      <button
        className="text-emerald-400 hover:text-emerald-300 text-xs ml-2 p-1 rounded-lg hover:bg-emerald-500/10 transition-colors"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss warning"
      >
        ✕
      </button>
    </div>
  );
}

const QUICK_COMMANDS = [
  { command: 'approve', label: 'Approve', icon: '✓', description: 'Approve pending action', color: 'text-emerald-400' },
  { command: 'reject', label: 'Reject', icon: '✕', description: 'Reject pending action', color: 'text-red-400' },
  { command: 'stop', label: 'Stop', icon: '■', description: 'Stop the agent', color: 'text-red-400' },
  { command: 'help', label: 'Help', icon: '?', description: 'Show help', color: 'text-blue-400' },
  { command: 'screenshot', label: 'Screenshot', icon: '📷', description: 'Take screenshot', color: 'text-amber-400' },
] as const;

function QuickCommandsPalette({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { send } = useWebSocket();
  const { info } = useToast();
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleCommand = (command: string) => {
    send({
      type: 'terminal_command',
      payload: { sessionId, command }
    });
    info(`Command sent: /${command}`);
    onClose();
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md mb-0 mx-0 bg-[#0f1512] border border-emerald-900/40 rounded-t-2xl shadow-2xl shadow-emerald-900/20 animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-900/30">
          <span className="text-sm font-semibold text-emerald-300">Quick Commands</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            aria-label="Close command palette"
          >
            ✕
          </button>
        </div>

        {/* Command list */}
        <div className="p-2">
          {QUICK_COMMANDS.map(({ command, icon, description, color }) => (
            <button
              key={command}
              onClick={() => handleCommand(command)}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left active:bg-emerald-500/15 hover:bg-emerald-500/10 transition-colors"
            >
              <span className={`text-lg w-7 text-center ${color}`}>{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-emerald-200">/{command}</div>
                <div className="text-xs text-emerald-600 mt-0.5">{description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>
    </div>
  );
}

function MobileTerminalBar({ getTerminal, sessionId }: { getTerminal: () => XTerm | null; sessionId: string }) {
  if (typeof window === 'undefined' || !('ontouchstart' in window)) return null;

  const { send } = useWebSocket();
  const { info } = useToast();
  const lastInterruptTimeRef = useRef<number>(0);
  const [showPalette, setShowPalette] = useState(false);
  const DEBOUNCE_MS = 1000;

  const sendKey = (key: string) => {
    getTerminal()?.write(key);
  };

  const handleInterrupt = () => {
    const now = Date.now();
    
    // Debounce: prevent multiple interrupts within 1 second
    if (now - lastInterruptTimeRef.current < DEBOUNCE_MS) {
      return;
    }
    
    lastInterruptTimeRef.current = now;
    
    // Send Ctrl+C to local terminal display
    getTerminal()?.write('\x03');
    // Also send interrupt to server via WebSocket
    send({
      type: 'terminal_interrupt',
      payload: { sessionId }
    });
    // Show toast notification
    info('Agent interrupted');
  };

  return (
    <>
      {showPalette && (
        <QuickCommandsPalette
          sessionId={sessionId}
          onClose={() => setShowPalette(false)}
        />
      )}
      <div className="flex gap-1.5 p-2.5 bg-[#0f1512] border-t border-emerald-900/30 flex-shrink-0">
        <button
          className="py-3 px-3.5 bg-amber-900/30 rounded-xl text-xs text-amber-400 font-medium active:bg-amber-900/50 transition-colors border border-amber-800/30"
          onClick={() => setShowPalette(true)}
          aria-label="Quick commands"
        >
          ⚡
        </button>
        <button
          className="flex-1 py-3 bg-[#1a2a1f] rounded-xl text-xs text-emerald-300 font-medium active:bg-[#243828] transition-colors border border-emerald-800/30"
          onClick={() => sendKey('\x1b')}
        >
          Esc
        </button>
        <button
          className="flex-1 py-3 bg-[#1a2a1f] rounded-xl text-xs text-emerald-300 font-medium active:bg-[#243828] transition-colors border border-emerald-800/30"
          onClick={() => sendKey('\t')}
        >
          Tab
        </button>
        <button
          className="flex-1 py-3 bg-red-900/40 rounded-xl text-xs text-red-400 font-medium active:bg-red-900/60 transition-colors border border-red-800/30"
          onClick={handleInterrupt}
        >
          Stop
        </button>
        <button
          className="flex-1 py-3 bg-[#1a2a1f] rounded-xl text-xs text-emerald-300 font-medium active:bg-[#243828] transition-colors border border-emerald-800/30"
          onClick={() => sendKey('\n')}
        >
          Line
        </button>
        <button
          className="py-3 px-4 bg-[#1a2a1f] rounded-xl text-xs text-emerald-300 font-medium active:bg-[#243828] transition-colors border border-emerald-800/30"
          onClick={() => sendKey('\x1b[A')}
        >
          ↑
        </button>
        <button
          className="py-3 px-4 bg-[#1a2a1f] rounded-xl text-xs text-emerald-300 font-medium active:bg-[#243828] transition-colors border border-emerald-800/30"
          onClick={() => sendKey('\x1b[B')}
        >
          ↓
        </button>
      </div>
    </>
  );
}
