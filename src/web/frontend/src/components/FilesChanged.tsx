import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface FileChange {
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
  status: string;
  added: number;
  removed: number;
}

interface FilesChangedProps {
  sessionName: string;
}

export function FilesChanged({ sessionName }: FilesChangedProps) {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadChanges = useCallback(async () => {
    try {
      const data = await api.sessions.getChanges(sessionName);
      setChanges((data.changes ?? []) as FileChange[]);
    } catch {
      setChanges([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionName]);

  useEffect(() => {
    loadChanges();
    // Poll every 5 seconds for updates
    const interval = setInterval(loadChanges, 5000);
    return () => clearInterval(interval);
  }, [loadChanges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-matrix-green" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <FileText size={24} className="text-[rgba(255,255,255,0.3)] mb-3" />
        <p className="text-sm text-on-surface font-mono">NO_CHANGES</p>
        <p className="text-xs text-muted font-mono mt-1">File changes will appear here</p>
      </div>
    );
  }

  const totalAdded = changes.reduce((sum, c) => sum + c.added, 0);
  const totalRemoved = changes.reduce((sum, c) => sum + c.removed, 0);

  return (
    <div className="h-full overflow-y-auto terminal-scroll p-4">
      {/* Summary header */}
      <div className="flex items-center gap-4 mb-4 pb-3 border-b border-outline-variant/20">
        <span className="text-xs font-mono text-muted">
          {changes.length} file{changes.length !== 1 ? 's' : ''} changed
        </span>
        <span className="text-xs font-mono text-green-400">+{totalAdded}</span>
        <span className="text-xs font-mono text-red-400">-{totalRemoved}</span>
      </div>

      {/* File list */}
      <div className="space-y-1">
        {changes.map((change) => (
          <FileChangeRow key={change.filePath} change={change} />
        ))}
      </div>
    </div>
  );
}

function FileChangeRow({ change }: { change: FileChange }) {
  const icon = change.changeType === 'created'
    ? <Plus size={12} className="text-green-400" />
    : change.changeType === 'deleted'
    ? <Trash2 size={12} className="text-red-400" />
    : <FileText size={12} className="text-yellow-400" />;

  const badge = change.changeType === 'created' ? 'A'
    : change.changeType === 'deleted' ? 'D'
    : 'M';

  const badgeColor = change.changeType === 'created' ? 'bg-green-500/20 text-green-400'
    : change.changeType === 'deleted' ? 'bg-red-500/20 text-red-400'
    : 'bg-yellow-500/20 text-yellow-400';

  return (
    <div className="flex items-center gap-3 p-2 hover:bg-surface-container-low transition-colors">
      <span className={clsx('text-[10px] font-mono font-bold px-1.5 py-0.5', badgeColor)}>
        {badge}
      </span>
      {icon}
      <span className="flex-1 text-xs font-mono text-on-surface truncate">
        {change.filePath}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {change.added > 0 && (
          <span className="text-[10px] font-mono text-green-400">+{change.added}</span>
        )}
        {change.removed > 0 && (
          <span className="text-[10px] font-mono text-red-400">-{change.removed}</span>
        )}
      </div>
    </div>
  );
}
