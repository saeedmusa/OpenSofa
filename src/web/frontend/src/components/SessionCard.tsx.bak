import { useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, ChevronRight, Check, X } from 'lucide-react';
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
    ? 'bg-matrix-green shadow-glow-primary' 
    : 'bg-warning animate-pulse-live';

  const formattedTime = formatRelativeTime(session.lastActivityAt);

  return (
    <article
      className="session-card animate-fade-in-up touch-target group cursor-pointer border-l-2 border-l-transparent hover:border-l-matrix-green transition-all"
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
        {/* Status indicator */}
        <div className={clsx('status-dot flex-shrink-0', statusClass)} aria-hidden="true" />
        
        <div className="flex-1 min-w-0">
          {/* Header row with name and agent type */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-mono font-bold text-on-surface text-base truncate">{session.name}</h3>
            <span className="text-[10px] font-mono text-cyan-accent bg-cyan-accent/10 px-1.5 py-0.5 border border-cyan-accent/30">
              {session.agentType.toUpperCase()}
            </span>
          </div>
          
          {/* Info row */}
          <div className="flex items-center gap-4 text-xs font-mono text-muted">
            <span className="flex items-center gap-1">
              <Clock size={12} aria-hidden="true" />
              {formattedTime}
            </span>
            {session.branch && (
              <span className="text-matrix-green/60">{session.branch}</span>
            )}
          </div>

          {/* Pending approval banner */}
          {session.hasPendingApproval && (
            <div className="mt-3 bg-neon-red/10 border border-neon-red/30 p-3">
              <div className="flex items-center gap-2 text-neon-red text-xs font-mono mb-2">
                <AlertCircle size={14} />
                <span>PENDING APPROVAL</span>
              </div>
              {onApprove || onReject ? (
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {onApprove && (
                    <button
                      onClick={() => onApprove(session.name)}
                      aria-label={`Approve session ${session.name}`}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-matrix-green hover:bg-matrix-green-fixed text-black py-2 font-mono text-xs font-bold transition-colors"
                    >
                      <Check size={14} />
                      APPROVE
                    </button>
                  )}
                  {onReject && (
                    <button
                      onClick={() => onReject(session.name)}
                      aria-label={`Reject session ${session.name}`}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-neon-red/20 hover:bg-neon-red text-white py-2 font-mono text-xs font-bold transition-colors"
                    >
                      <X size={14} />
                      REJECT
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onStop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStop(session.name);
              }}
              aria-label={`Stop session ${session.name}`}
              className="btn-stop px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
            >
              STOP
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
