import { useState } from 'react';
import { FileBrowser } from './FileBrowser';
import { FileContent } from './FileContent';
import { useResponsive } from '../hooks/useResponsive';
import { ArrowLeft } from 'lucide-react';

interface FileViewProps {
  sessionName: string;
}

export function FileView({ sessionName }: FileViewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    return (
      <div className="h-full flex">
        <div className="w-1/3 min-w-[200px] max-w-[300px] border-r border-border overflow-hidden">
          <FileBrowser
            sessionName={sessionName}
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          {selectedFile ? (
            <FileContent sessionName={sessionName} filePath={selectedFile} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted text-sm">
              Select a file to view contents
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedFile) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface">
          <button
            className="touch-target flex items-center justify-center text-muted hover:text-fg"
            onClick={() => setSelectedFile(null)}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm truncate flex-1" title={selectedFile}>
            {selectedFile.split('/').pop()}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <FileContent sessionName={sessionName} filePath={selectedFile} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <FileBrowser
        sessionName={sessionName}
        onFileSelect={setSelectedFile}
        selectedFile={selectedFile}
      />
    </div>
  );
}
