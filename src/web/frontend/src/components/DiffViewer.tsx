import { useState, useEffect } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { Copy, Check } from 'lucide-react';

interface DiffViewerProps {
  diffText: string;
  filePath: string;
}

export function DiffViewer({ diffText, filePath }: DiffViewerProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>(() => {
    return (localStorage.getItem('diffViewMode') as 'unified' | 'split') || 'unified';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleViewMode = () => {
    const newMode = viewMode === 'unified' ? 'split' : 'unified';
    setViewMode(newMode);
    localStorage.setItem('diffViewMode', newMode);
  };

  const { oldValue, newValue, additions, deletions } = parsePatchToStings(diffText);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileName = filePath.split('/').pop() || filePath;

  // Force unified view on mobile, otherwise respect user preference
  const splitView = isMobile ? false : viewMode === 'split';

  return (
    <div className="h-full flex flex-col bg-bg border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate" title={fileName}>
            {fileName}
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-success">+{additions}</span>
            <span className="text-danger">-{deletions}</span>
          </div>
        </div>
        
        {!isMobile && (
          <button
            onClick={toggleViewMode}
            className="touch-target flex items-center justify-center px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-border text-sm font-medium transition-colors"
          >
            {viewMode === 'unified' ? 'Split' : 'Unified'}
          </button>
        )}
        
        <button
          onClick={handleCopy}
          className="touch-target flex items-center justify-center p-2 text-[rgba(255,255,255,0.5)] hover:text-fg ml-2"
          aria-label="Copy diff to clipboard"
        >
          {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-bg text-sm">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={splitView}
          useDarkTheme={true} // Assumes dark theme is standard in this app
          leftTitle={splitView ? "Original" : undefined}
          rightTitle={splitView ? "Modified" : undefined}
          styles={{
            variables: {
              dark: {
                diffViewerBackground: 'transparent',
                diffViewerColor: 'inherit',
                addedBackground: 'rgba(16, 185, 129, 0.1)', // text-success/10
                addedColor: '#34d399',
                removedBackground: 'rgba(239, 68, 68, 0.1)', // text-danger/10
                removedColor: '#f87171',
                wordAddedBackground: 'rgba(16, 185, 129, 0.2)',
                wordRemovedBackground: 'rgba(239, 68, 68, 0.2)',
                addedGutterBackground: 'rgba(16, 185, 129, 0.05)',
                removedGutterBackground: 'rgba(239, 68, 68, 0.05)',
                gutterBackground: 'transparent',
                gutterBackgroundDark: 'transparent',
                highlightBackground: 'rgba(255, 255, 255, 0.05)',
                highlightGutterBackground: 'rgba(255, 255, 255, 0.05)',
              }
            },
            lineNumber: {
              color: 'rgba(255, 255, 255, 0.3)',
            }
          }}
        />
      </div>
    </div>
  );
}

// Helper to convert a patch string into oldValue/newValue blocks for ReactDiffViewer
function parsePatchToStings(diffText: string) {
  const lines = diffText.split('\n');
  
  let oldLines: string[] = [];
  let newLines: string[] = [];
  let additions = 0;
  let deletions = 0;
  
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++')) {
      continue;
    }
    
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    
    if (!inHunk) continue;

    if (line.startsWith('+')) {
      newLines.push(line.slice(1));
      additions++;
    } else if (line.startsWith('-')) {
      oldLines.push(line.slice(1));
      deletions++;
    } else if (line.startsWith(' ')) {
      oldLines.push(line.slice(1));
      newLines.push(line.slice(1));
    } else if (line === '') {
      oldLines.push('');
      newLines.push('');
    }
  }

  return {
    oldValue: oldLines.join('\n'),
    newValue: newLines.join('\n'),
    additions,
    deletions
  };
}
