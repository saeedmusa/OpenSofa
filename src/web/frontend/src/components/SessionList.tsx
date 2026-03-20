import { useMemo } from 'react';
import { SessionCard } from './SessionCard';
import { SessionListSkeleton } from './Skeleton';
import type { Session } from '../types';

interface SessionListProps {
  sessions: Session[];
  isLoading?: boolean;
  error?: string | null;
  onStop?: (name: string) => void;
  onApprove?: (name: string) => void;
  onReject?: (name: string) => void;
}

export function SessionList({ sessions, isLoading, error, onStop, onApprove, onReject }: SessionListProps) {
  const sorted = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.hasPendingApproval && !b.hasPendingApproval) return -1;
      if (!a.hasPendingApproval && b.hasPendingApproval) return 1;
      return b.lastActivityAt - a.lastActivityAt;
    });
  }, [sessions]);

  if (isLoading) {
    return <SessionListSkeleton count={3} />;
  }

  if (error) {
    return (
      <div className="surface-floating p-6 text-center animate-scale-in">
        <p className="text-danger text-sm font-mono">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="surface-floating p-10 text-center animate-scale-in">
        <div className="empty-state-icon mx-auto mb-4">
          <span className="material-symbols-outlined text-matrix-green text-xl">smart_toy</span>
        </div>
        <p className="text-muted text-sm font-mono mb-1">NO_ACTIVE_SESSIONS</p>
        <p className="text-muted/60 text-xs font-mono">
          Create a session to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((session, index) => (
        <div key={session.name} style={{ animationDelay: `${index * 75}ms` } as React.CSSProperties}>
          <SessionCard
            session={session}
            onStop={onStop}
            onApprove={onApprove}
            onReject={onReject}
          />
        </div>
      ))}
    </div>
  );
}
