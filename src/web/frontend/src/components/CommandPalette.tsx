import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';

export interface Command {
  name: string;
  description: string;
  category?: string;
}

export interface CommandOption {
  name: string;
  description: string;
  value: string;
  metadata?: Record<string, any>;
}

interface CommandPaletteProps {
  inputValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  isOpen: boolean;
  options?: CommandOption[]; // Additional options (e.g. models, agents)
}

const COMMON_COMMANDS: Command[] = [
  { name: 'models', description: 'Switch model' },
  { name: 'model', description: 'Switch model (alias)' },
  { name: 'agents', description: 'Switch agent' },
  { name: 'agent', description: 'Switch agent or mode (alias)' },
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
 */
export function CommandPalette({ inputValue, onSelect, onClose, isOpen, options = [] }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine if we should show the palette based on input
  const isSlash = inputValue.startsWith('/');

  const parts = isSlash ? inputValue.split(' ') : [];
  const commandPart = parts.length > 0 ? parts[0].substring(1).toLowerCase() : '';
  const subQuery = parts.length > 1 ? parts.slice(1).join(' ').toLowerCase() : '';

  let filtered: (Command | CommandOption)[] = [];
  let displayType: 'command' | 'option' = 'command';

  if (isSlash) {
    if (parts.length === 1) {
      // Top-level commands
      filtered = COMMON_COMMANDS.filter(cmd => 
        cmd.name.toLowerCase().includes(commandPart) || 
        cmd.description.toLowerCase().includes(commandPart)
      );
      displayType = 'command';
    } else if (options.length > 0) {
      // Sub-options (e.g. models or agents)
      filtered = options.filter(opt => 
        opt.name.toLowerCase().includes(subQuery) || 
        opt.description.toLowerCase().includes(subQuery) ||
        opt.value.toLowerCase().includes(subQuery)
      );
      displayType = 'option';
    }
  }

  useEffect(() => {
    setSelectedIndex(0);
  }, [commandPart, subQuery, options.length]);

  useEffect(() => {
    if (!isOpen || !isSlash || filtered.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev: number) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev: number) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selectedIndex]) {
          e.preventDefault();
          const item = filtered[selectedIndex];
          if ('value' in item) {
            onSelect(item.value);
          } else {
            onSelect(item.name);
          }
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const selectedElement = scrollRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, filtered.length]);

  if (!isOpen || !isSlash) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50 animate-in slide-in-from-bottom-2 duration-200">
      <div 
        ref={scrollRef}
        className="max-h-64 overflow-y-auto bg-void border border-matrix-green/30 shadow-[0_0_15px_rgba(0,255,65,0.1)] custom-scrollbar"
      >
        {filtered.length === 0 ? (
          <div className="px-4 py-3 text-muted/50 font-mono text-[10px] text-center italic">
            No matching commands or modes found
          </div>
        ) : filtered.map((item, idx) => {
          const isOption = 'value' in item;
          const name = isOption ? (item as CommandOption).name : (item as Command).name;
          const description = item.description;
          const metadata = isOption ? (item as CommandOption).metadata : null;

          return (
            <div
              key={isOption ? (item as CommandOption).value : (item as Command).name}
              onClick={() => onSelect(isOption ? (item as CommandOption).value : (item as Command).name)}
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
                  {displayType === 'command' ? `/${name}` : name}
                </span>
                {metadata?.provider && (
                  <span className="text-[10px] text-cyan-accent/60 bg-cyan-accent/5 px-1.5 py-0.5 border border-cyan-accent/20">
                    {metadata.provider.toUpperCase()}
                  </span>
                )}
              </div>
              <span className={clsx(
                'text-[10px] truncate max-w-[60%] ml-4',
                idx === selectedIndex ? 'text-cyan-accent' : 'text-muted/60'
              )}>
                {description}
              </span>
            </div>
          );
        })}
      </div>
      
      <div className="bg-void/80 backdrop-blur-sm border-x border-b border-matrix-green/30 px-3 py-1 flex justify-between items-center text-[9px] font-mono text-muted/60">
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-cyan-accent animate-pulse" />
           <span>
             {displayType === 'command' ? 'tab to autocomplete' : 'enter to select'}
           </span>
        </div>
        <span>
           {filtered.length} results
        </span>
      </div>
    </div>
  );
}

