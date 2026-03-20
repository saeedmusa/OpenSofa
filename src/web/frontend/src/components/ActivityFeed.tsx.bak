import { useEffect, useState, useMemo } from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { clsx } from 'clsx';
import type { ActivityEvent } from '../types';
import { DiffViewer } from './DiffViewer';

interface ActivityFeedProps {
  sessionName: string;
}

export function ActivityFeed({ sessionName }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    return subscribe('activity', (msg) => {
      const payload = msg.payload as { events?: ActivityEvent[] } | undefined;
      if (msg.sessionName === sessionName && payload?.events) {
        setEvents(prev => [...payload.events!, ...prev].slice(0, 100));
      }
    });
  }, [subscribe, sessionName]);

  const grouped = useMemo(() => groupByTime(events), [events]);

  return (
    <div className="space-y-6 p-5">
      {grouped.map(({ label, events: groupEvents }) => (
        <div key={label} className="animate-float-in">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-strong to-transparent" />
            <span className="text-xs text-muted font-medium uppercase tracking-wider px-3">
              {label}
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-strong to-transparent" />
          </div>
          <div className="space-y-3">
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
            <span className="text-2xl">✨</span>
          </div>
          <p className="text-sm text-muted font-medium">No activity yet</p>
          <p className="text-xs text-muted mt-1">
            Activity will appear here as the agent works
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

  return (
    <div
      className={clsx(
        "surface-floating p-4 cursor-pointer transition-all duration-200 animate-scale-in group",
        isError && "border-danger/30",
        isApproval && "border-warning/30"
      )}
      onClick={() => setExpanded(!expanded)}
      style={style}
    >
      <div className="flex items-start gap-4">
        <div className={clsx(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform',
          isError ? 'bg-danger-soft' : isApproval ? 'bg-warning-soft' : 'bg-accent-soft',
          'group-hover:scale-110'
        )}>
          <span className="text-lg">{event.icon}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm text-fg-strong font-medium leading-relaxed break-words">{event.summary}</p>
          
          {expanded && event.details && (
            <div className="mt-3 space-y-2 text-xs">
              {event.details.filePath && (
                <div className="flex items-center gap-2 text-muted-light">
                  <span className="font-mono bg-surface px-2 py-1 rounded-lg">{event.details.filePath}</span>
                </div>
              )}
              {event.details.command && (
                <pre className="bg-bg-elevated p-3 rounded-xl overflow-x-auto text-muted font-mono border border-border">
                  {event.details.command}
                </pre>
              )}
              {event.details.errorStack && (
                <pre className="bg-danger/10 p-3 rounded-xl overflow-x-auto text-danger font-mono border border-danger/20">
                  {event.details.errorStack}
                </pre>
              )}
              {event.details.diff && (
                <div className="mt-3 overflow-hidden rounded-xl border border-border" onClick={e => e.stopPropagation()}>
                    <DiffViewer diffText={event.details.diff} filePath={event.details.filePath || 'Changes'} />
                </div>
              )}
            </div>
          )}
        </div>
        
        {event.details && (
          <div className={clsx(
            'text-muted text-xs transition-transform duration-200',
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

    if (diff < 60000) label = 'Now';
    else if (diff < 3600000) label = `${Math.floor(diff / 60000)} minutes ago`;
    else label = `${Math.floor(diff / 3600000)} hours ago`;

    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(event);
  }

  return Array.from(groups.entries()).map(([label, events]) => ({ label, events }));
}
