import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { clsx } from 'clsx';
import { File, Folder, ChevronRight, ChevronDown, ArrowLeft, RefreshCw } from 'lucide-react';
import type { FileEntry } from '../types';
import { formatSize } from '../utils/format';

interface FileBrowserProps {
  sessionName: string;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}

export function FileBrowser({ sessionName, onFileSelect, selectedFile }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['files', sessionName, currentPath],
    queryFn: () => api.sessions.listFiles(sessionName, currentPath),
    staleTime: 10000,
  });

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  const goUp = () => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted text-sm px-6 gap-3 animate-fade-in">
        <div className="empty-state-icon">
          <File size={28} className="text-danger" />
        </div>
        <p className="text-danger font-medium">Failed to load files</p>
        <p className="text-xs text-muted text-center">{error instanceof Error ? error.message : 'Unknown error'}</p>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary btn-sm mt-2"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  if (!data?.entries?.length && !currentPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted text-sm px-6 animate-fade-in">
        <div className="empty-state-icon">
          <File size={28} className="text-accent" />
        </div>
        <p className="font-medium">No files found</p>
      </div>
    );
  }

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {currentPath && (
          <button
            onClick={goUp}
            className="btn btn-ghost p-2 rounded-xl"
            aria-label="Go up"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => navigateTo('')}
              className="text-muted hover:text-accent transition-colors font-medium"
            >
              root
            </button>
            {pathParts.map((part, idx) => (
              <span key={idx} className="flex items-center gap-1.5">
                <span className="text-muted/50">/</span>
                <button
                  onClick={() => navigateTo(pathParts.slice(0, idx + 1).join('/'))}
                  className="text-muted hover:text-accent transition-colors truncate font-medium"
                >
                  {part}
                </button>
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-ghost p-2 rounded-xl"
          aria-label="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
        <div className="space-y-1">
          {data?.entries?.map((entry, index) => (
            <FileEntryRow
              key={entry.name}
              entry={entry}
              basePath={currentPath}
              isSelected={selectedFile === (currentPath ? `${currentPath}/${entry.name}` : entry.name)}
              isExpanded={expandedDirs.has(currentPath ? `${currentPath}/${entry.name}` : entry.name)}
              onSelect={onFileSelect}
              onToggleDir={() => toggleDir(currentPath ? `${currentPath}/${entry.name}` : entry.name)}
              onNavigate={() => navigateTo(currentPath ? `${currentPath}/${entry.name}` : entry.name)}
              style={{ animationDelay: `${index * 30}ms` } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface FileEntryRowProps {
  entry: FileEntry;
  basePath: string;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (path: string) => void;
  onToggleDir: () => void;
  onNavigate: () => void;
  style?: React.CSSProperties;
}

function FileEntryRow({ 
  entry, 
  basePath, 
  isSelected, 
  isExpanded, 
  onSelect, 
  onToggleDir,
  onNavigate,
  style 
}: FileEntryRowProps) {
  const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;
  
  const handleClick = () => {
    if (entry.type === 'directory') {
      onNavigate();
    } else {
      onSelect(fullPath);
    }
  };

  return (
    <button
      className={clsx(
        'flex items-center gap-3 w-full py-2.5 px-3 rounded-xl text-sm',
        'transition-all duration-200 animate-fade-in',
        isSelected 
          ? 'bg-accent-soft text-accent border border-accent/30' 
          : 'hover:bg-surface border border-transparent'
      )}
      onClick={handleClick}
      style={style}
    >
      {entry.type === 'directory' ? (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleDir();
            }}
            className="text-muted hover:text-fg p-0.5 rounded-lg hover:bg-surface transition-colors"
          >
            {isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
          <div className="p-1.5 rounded-lg bg-warning-soft">
            <Folder className="w-4 h-4 text-warning flex-shrink-0" />
          </div>
        </>
      ) : (
        <>
          <span className="w-5" />
          <div className="p-1.5 rounded-lg bg-accent-soft">
            <File className="w-4 h-4 text-accent flex-shrink-0" />
          </div>
        </>
      )}
      <span className="truncate flex-1 text-left font-medium">{entry.name}</span>
      {entry.type === 'file' && entry.size !== undefined && (
        <span className="text-xs text-muted font-mono">
          {formatSize(entry.size)}
        </span>
      )}
    </button>
  );
}
