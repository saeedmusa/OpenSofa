import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  count?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ className, count = 1, style }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div aria-hidden="true">
      {items.map((i) => (
        <div
          key={i}
          style={style}
          className={clsx(
            'animate-pulse bg-gradient-to-r from-surface via-surface-elevated to-surface rounded-xl',
            className
          )}
        />
      ))}
    </div>
  );
}

export function SessionCardSkeleton() {
  return (
    <div className="session-card session-card--floating" aria-hidden="true" aria-label="Loading session">
      <div className="flex items-center gap-4">
        <div className="w-2.5 h-2.5 rounded-full bg-surface-elevated animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-28 h-5 rounded-lg" />
            <Skeleton className="w-16 h-5 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-4 rounded-lg" />
            <Skeleton className="w-12 h-4 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ animationDelay: `${i * 100}ms` } as React.CSSProperties}>
          <SessionCardSkeleton />
        </div>
      ))}
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="surface-floating p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-full h-4 rounded-lg" />
          <Skeleton className="w-3/4 h-4 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function FileListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface">
          <Skeleton className="w-5 h-5 rounded-lg" />
          <Skeleton className="flex-1 h-4 rounded-lg" />
          <Skeleton className="w-12 h-3 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function TerminalSkeleton() {
  return (
    <div className="w-full h-full min-h-[200px] rounded-2xl overflow-hidden flex flex-col bg-surface/50 border border-border">
      <div className="flex-1 p-4 space-y-2">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-3 rounded-lg" style={{ width: `${Math.random() * 40 + 60}%` } as React.CSSProperties} />
        ))}
      </div>
      <div className="flex gap-2 p-3 bg-surface border-t border-border">
        <Skeleton className="flex-1 h-10 rounded-xl" />
        <Skeleton className="flex-1 h-10 rounded-xl" />
        <Skeleton className="flex-1 h-10 rounded-xl" />
        <Skeleton className="w-12 h-10 rounded-xl" />
        <Skeleton className="w-12 h-10 rounded-xl" />
      </div>
    </div>
  );
}
