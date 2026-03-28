import { useEffect, useState, useMemo } from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { clsx } from 'clsx';
import type { ActivityEvent } from '../types';
import { DiffViewer } from './DiffViewer';
import { CatchUpCard } from './CatchUpCard';

interface ActivityFeedProps {
  sessionName: string;
}

export function ActivityFeed({ sessionName }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    return subscribe('activity', (msg) => {
      const payload = msg.payload as { events?: ActivityEvent[] } | undefined;
      // Normalize names for comparison (handle potential encoding/case diffs)
      const msgSession = msg.sessionName?.toLowerCase().trim();
      const currentSession = sessionName.toLowerCase().trim();
      
      if ((!msgSession || msgSession === currentSession) && payload?.events) {
        setEvents(prev => [...payload.events!, ...prev].slice(0, 100));
      }
    });
  }, [subscribe, sessionName]);

  const grouped = useMemo(() => groupByTime(events), [events]);

  return (
    <div className="space-y-6 p-5">
      {/* Catch-up banner — shows after reconnect */}
      <CatchUpCard sessionName={sessionName} />

      {grouped.map(({ label, events: groupEvents }) => (
        <div key={label} className="animate-float-in">
          {/* Time divider — scan-line style, no heavy borders */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-outline-variant/30" />
            <span className="text-[10px] text-muted font-mono uppercase tracking-widest px-2">
              {label}
            </span>
            <div className="h-px flex-1 bg-outline-variant/30" />
          </div>
          <div className="space-y-2">
            {groupEvents.map((event, index) => (
              <ActivityCard 
                key={event.id} 
                event={event} 
                style={{ animationDelay: `${index * 50}ms` } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      ))}

      {events.length === 0 && (
        <div className="empty-state animate-float-in">
          <div className="empty-state-icon">
            <span className="material-symbols-outlined text-matrix-green text-xl">terminal</span>
          </div>
          <p className="text-sm text-on-surface font-mono mt-3">NO_ACTIVITY_LOG</p>
          <p className="text-xs text-muted font-mono mt-1">
            Activity will stream here as the agent executes
          </p>
        </div>
      )}
    </div>
  );
}

interface ActivityCardProps {
  event: ActivityEvent;
  style?: React.CSSProperties;
}

function ActivityCard({ event, style }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isError = event.type === 'error';
  const isApproval = event.type === 'approval_needed';
  const isCodeChange = event.type === 'code_change';

  return (
    <div
      className={clsx(
        "surface-floating p-3 cursor-pointer transition-all duration-150 animate-scale-in group",
        isError && "border-neon-red/30",
        isApproval && "border-warning/30",
        event.mcpServer && "border-cyan-accent/20"
      )}
      onClick={() => setExpanded(!expanded)}
      style={style}
    >
      <div className="flex items-start gap-3">
        {/* Icon — brutalist square, no rounded corners */}
        <div className={clsx(
          'w-8 h-8 flex items-center justify-center flex-shrink-0 transition-transform',
          isError ? 'bg-danger-soft border border-neon-red/20' : 
          isApproval ? 'bg-warning-soft border border-warning/20' : 
          isCodeChange ? 'bg-cyan-accent/10 border border-cyan-accent/20' :
          event.mcpServer ? 'bg-cyan-accent/10 border border-cyan-accent/20' :
          'bg-accent-soft border border-matrix-green/20',
          'group-hover:scale-110'
        )}>
          <span className="text-sm">
            {isCodeChange ? 'diff' : event.icon}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          {/* MCP badge */}
          {event.mcpServer && (
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-mono text-cyan-accent bg-cyan-accent/10 px-1.5 py-0.5 border border-cyan-accent/20">
                MCP: {event.mcpServer}
              </span>
              {event.mcpTool && (
                <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)]">
                  {event.mcpTool}
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-on-surface font-mono leading-relaxed break-words">{event.summary}</p>
          
          {expanded && event.details && (
            <div className="mt-3 space-y-2 text-xs">
              {event.details.filePath && (
                <div className="flex items-center gap-2 text-cyan-accent">
                  <span className="font-mono bg-surface-container px-2 py-1 text-[10px]">{event.details.filePath}</span>
                </div>
              )}
              {event.details.command && (
                <pre className="bg-surface-container-high p-3 overflow-x-auto text-muted font-mono text-[11px] border border-outline-variant/20">
                  {event.details.command}
                </pre>
              )}
              {event.details.errorStack && (
                <pre className="bg-neon-red/10 p-3 overflow-x-auto text-neon-red font-mono text-[11px] border border-neon-red/20">
                  {event.details.errorStack}
                </pre>
              )}
              {event.details.diff && (
                <div className="mt-3 overflow-hidden border border-outline-variant/20" onClick={e => e.stopPropagation()}>
                    <DiffViewer diffText={event.details.diff} filePath={event.details.filePath || 'Changes'} />
                </div>
              )}
            </div>
          )}
        </div>
        
        {event.details && (
          <div className={clsx(
            'text-muted text-xs transition-transform duration-200 font-mono',
            expanded && 'rotate-180'
          )}>
            ▼
          </div>
        )}
      </div>
    </div>
  );
}

function groupByTime(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const groups: Map<string, ActivityEvent[]> = new Map();
  const now = Date.now();

  for (const event of events) {
    const diff = now - event.timestamp;
    let label: string;

    if (diff < 60000) label = 'NOW';
    else if (diff < 3600000) label = `T-${Math.floor(diff / 60000)}M`;
    else label = `T-${Math.floor(diff / 3600000)}H`;

    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(event);
  }

  return Array.from(groups.entries()).map(([label, events]) => ({ label, events }));
}
