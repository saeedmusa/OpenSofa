import { useNavigate } from 'react-router-dom';
import { Play, Square, AlertCircle, Clock, ChevronRight, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { Session } from '../types';
import { formatRelativeTime } from '../utils/format';
import { useState, useEffect } from 'react';

interface SessionCardProps {
  session: Session;
  onStop?: (name: string) => void;
  onApprove?: (name: string) => void;
  onReject?: (name: string) => void;
}

export function SessionCard({ session, onStop, onApprove, onReject }: SessionCardProps) {
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const statusClass = session.agentStatus === 'stable' 
    ? 'status-dot--stable' 
    : 'status-dot--running';

  const formattedTime = formatRelativeTime(session.lastActivityAt);

  return (
    <article
      className="session-card session-card--floating animate-float-in touch-target group"
      onClick={() => navigate(`/session/${encodeURIComponent(session.name)}`)}
      role="button"
      tabIndex={0}
      aria-label={`${session.name}, ${session.agentType}, status: ${session.agentStatus}${session.hasPendingApproval ? ', needs approval' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/session/${encodeURIComponent(session.name)}`);
        }
      }}
    >
      <div className="flex items-center gap-4">
        <div className={clsx('status-dot flex-shrink-0', statusClass)} aria-hidden="true" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-fg-strong text-base truncate">{session.name}</h3>
            {session.hasPendingApproval && (
              <span className="badge badge-warning flex-shrink-0">
                <AlertCircle size={12} aria-hidden="true" />
                Approval
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 mt-1.5 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Play size={13} aria-hidden="true" className="text-accent" />
              {session.agentType}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} aria-hidden="true" />
              {formattedTime}
            </span>
          </div>

          {session.branch && (
            <div className="mt-2 text-xs text-muted-light font-mono bg-surface px-2.5 py-1 rounded-full inline-block">
              {session.branch}
            </div>
          )}

          {session.hasPendingApproval && (onApprove || onReject) && (
            <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              {onApprove && (
                <button
                  onClick={() => onApprove(session.name)}
                  aria-label={`Approve session ${session.name}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-success hover:bg-success/90 text-white py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                >
                  <Check size={14} />
                  Approve
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(session.name)}
                  aria-label={`Reject session ${session.name}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-danger hover:bg-danger/90 text-white py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                >
                  <X size={14} />
                  Reject
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onStop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStop(session.name);
              }}
              aria-label={`Stop session ${session.name}`}
              className="btn btn-danger btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Square size={14} aria-hidden="true" />
            </button>
          )}
          <ChevronRight 
            size={20} 
            className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" 
            aria-hidden="true" 
          />
        </div>
      </div>
    </article>
  );
}
