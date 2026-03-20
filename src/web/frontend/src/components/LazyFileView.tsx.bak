import { lazy, Suspense } from 'react';
import { FileListSkeleton } from './Skeleton';

const FileView = lazy(() => 
  import('./FileView').then(m => ({ default: m.FileView }))
);

interface LazyFileViewProps {
  sessionName: string;
}

export function LazyFileView({ sessionName }: LazyFileViewProps) {
  return (
    <Suspense fallback={<FileListSkeleton />}>
      <FileView sessionName={sessionName} />
    </Suspense>
  );
}
