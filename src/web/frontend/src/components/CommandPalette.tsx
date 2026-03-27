import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';

export interface Command {
  name: string;
  description: string;
  category?: string;
}

interface CommandPaletteProps {
  inputValue: string;
  onSelect: (command: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const COMMON_COMMANDS: Command[] = [
  { name: 'models', description: 'Switch model' },
  { name: 'agents', description: 'Switch agent' },
  { name: 'help', description: 'Show all commands' },
  { name: 'reflection', description: 'Toggle reflection mode on/off' },
  { name: 'optimize', description: 'Analyze and optimize code' },
  { name: 'context', description: 'Context system manager' },
  { name: 'commit', description: 'Create well-formatted commits' },
  { name: 'review', description: 'Review changes [commit|branch|pr]' },
  { name: 'clean', description: 'Clean the codebase or current working t' },
];

/**
 * Slash Command Palette (Autocomplete UI)
 * Replicates the terminal-style dropdown from user screenshots.
 */
export function CommandPalette({ inputValue, onSelect, onClose, isOpen }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine if we should show the palette based on input
  const isSlash = inputValue.startsWith('/');
  const query = isSlash ? inputValue.substring(1).toLowerCase() : '';
  
  const filtered = COMMON_COMMANDS.filter(cmd => 
    cmd.name.toLowerCase().includes(query) || 
    cmd.description.toLowerCase().includes(query)
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen || filtered.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selectedIndex]) {
          e.preventDefault();
          onSelect(filtered[selectedIndex].name);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onSelect, onClose]);

  // Ensure selected item is visible
  useEffect(() => {
    const selectedElement = scrollRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen || !isSlash || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50 animate-in slide-in-from-bottom-2 duration-200">
      <div 
        ref={scrollRef}
        className="max-h-64 overflow-y-auto bg-void border border-matrix-green/30 shadow-[0_0_15px_rgba(0,255,65,0.1)] custom-scrollbar"
      >
        {filtered.map((cmd, idx) => (
          <div
            key={cmd.name}
            onClick={() => onSelect(cmd.name)}
            className={clsx(
              'group flex items-center justify-between px-4 py-2 cursor-pointer transition-colors font-mono text-xs border-b border-matrix-green/5 last:border-0',
              idx === selectedIndex ? 'bg-matrix-green/20' : 'hover:bg-matrix-green/5'
            )}
          >
            <div className="flex items-center gap-3">
              <span className={clsx(
                'font-bold tracking-tight',
                idx === selectedIndex ? 'text-matrix-green' : 'text-matrix-green/70'
              )}>
                /{cmd.name}
              </span>
            </div>
            <span className={clsx(
              'text-[10px] truncate max-w-[60%]',
              idx === selectedIndex ? 'text-cyan-accent' : 'text-muted/60'
            )}>
              {cmd.description}
            </span>
          </div>
        ))}
      </div>
      
      {/* Footer "Tip" style to match screenshots */}
      <div className="bg-void/80 backdrop-blur-sm border-x border-b border-matrix-green/30 px-3 py-1 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-cyan-accent animate-pulse" />
           <span className="text-[9px] font-mono text-muted/60">
             tab <span className="text-cyan-accent">agents</span>
           </span>
        </div>
        <span className="text-[9px] font-mono text-muted/60">
           ctrl+p <span className="text-on-surface/40">commands</span>
        </span>
      </div>
    </div>
  );
}
