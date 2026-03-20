import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { formatSize } from '../utils/format';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check, AlertTriangle, RefreshCw } from 'lucide-react';

interface FileContentProps {
  sessionName: string;
  filePath: string;
}

function FileContentInner({ sessionName, filePath }: FileContentProps) {
  const { data: fileData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['file', sessionName, filePath],
    queryFn: () => api.sessions.getFile(sessionName, filePath),
    enabled: !!filePath,
  });

  const [currentPage, setCurrentPage] = useState(0);
  const [copied, setCopied] = useState(false);
  const linesPerPage = 40;

  const lines = useMemo(() => {
    if (!fileData?.content) return [];
    return fileData.content.split('\n');
  }, [fileData]);

  const totalPages = Math.ceil(lines.length / linesPerPage);
  const visibleLines = lines.slice(
    currentPage * linesPerPage,
    (currentPage + 1) * linesPerPage
  );

  const handleCopy = async () => {
    if (fileData?.content) {
      await navigator.clipboard.writeText(fileData.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted text-sm px-4 gap-2">
        <AlertTriangle className="w-8 h-8 mb-2 text-danger" />
        <p className="text-danger">Failed to load file</p>
        <p className="text-xs text-muted/60">{error instanceof Error ? error.message : 'Unknown error'}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded text-xs hover:bg-border/50 transition-colors"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  if (!fileData) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        Select a file to view contents
      </div>
    );
  }

  const fileName = filePath.split('/').pop() || filePath;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate" title={fileName}>
            {fileName}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{fileData.language}</span>
            <span>·</span>
            <span>{lines.length} lines</span>
            <span>·</span>
            <span>{formatSize(fileData.size)}</span>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="touch-target flex items-center justify-center p-2 text-muted hover:text-fg"
          title="Copy to clipboard"
        >
          {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-auto font-mono text-xs bg-bg">
        <table className="w-full">
          <tbody>
            {visibleLines.map((line, idx) => (
              <tr key={currentPage * linesPerPage + idx} className="hover:bg-surface/50">
                <td className="w-10 text-right pr-3 text-muted/40 select-none border-r border-border/30 align-top">
                  {currentPage * linesPerPage + idx + 1}
                </td>
                <td className="pl-3 pr-4 whitespace-pre text-fg">
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface">
          <button
            className="touch-target flex items-center justify-center p-1 text-muted hover:text-fg disabled:opacity-30"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs text-muted">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            className="touch-target flex items-center justify-center p-1 text-muted hover:text-fg disabled:opacity-30"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

export function FileContent({ sessionName, filePath }: FileContentProps) {
  return <FileContentInner key={filePath} sessionName={sessionName} filePath={filePath} />;
}
