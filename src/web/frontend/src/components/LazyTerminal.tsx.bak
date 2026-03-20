import { lazy, Suspense } from 'react';
import { TerminalSkeleton } from './Skeleton';

const Terminal = lazy(() => 
  import('./Terminal').then(m => ({ default: m.Terminal }))
);

interface LazyTerminalProps {
  sessionId: string;
}

export function LazyTerminal({ sessionId }: LazyTerminalProps) {
  return (
    <Suspense fallback={<TerminalSkeleton />}>
      <Terminal sessionId={sessionId} />
    </Suspense>
  );
}
