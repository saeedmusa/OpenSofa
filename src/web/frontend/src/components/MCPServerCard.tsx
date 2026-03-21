import { clsx } from 'clsx';
import { Server, ChevronDown, ChevronUp, AlertCircle, Search, Loader2, Wrench, Trash2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { api } from '../utils/api';
import { useToast } from './Toast';

export interface MCPServer {
  name: string;
  agent: string;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  envKeys: string[];
  status: 'configured' | 'error';
  configPath: string;
}

interface MCPTool {
  name: string;
  description?: string;
}

interface MCPServerCardProps {
  server: MCPServer;
  onRemoved?: () => void;
}

export function MCPServerCard({ server, onRemoved }: MCPServerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const toast = useToast();

  const discoverTools = useCallback(async () => {
    setToolsLoading(true);
    setToolsError(null);
    try {
      const result = await api.mcp.discoverTools(server.agent, server.name);
      setTools(result.tools);
      if (result.error) {
        setToolsError(result.error);
      }
    } catch (err) {
      setToolsError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setToolsLoading(false);
    }
  }, [server.agent, server.name]);

  const handleRemove = useCallback(async () => {
    if (!confirm(`Remove MCP server '${server.name}'? This will update your ${server.agent} config.`)) {
      return;
    }
    setRemoving(true);
    try {
      await api.mcp.remove(server.agent, server.name);
      toast.success(`MCP server "${server.name}" removed`);
      onRemoved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove server');
    } finally {
      setRemoving(false);
    }
  }, [server.agent, server.name, onRemoved, toast]);

  const statusColor = server.status === 'configured'
    ? 'bg-green-500'
    : 'bg-red-500';

  const transportLabel = server.transport === 'stdio' ? 'STDIO' : server.transport.toUpperCase();

  return (
    <div
      className="border border-[#3b4b37]/30 bg-[#0e0e0e] hover:border-[#3b4b37]/60 transition-colors"
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <Server size={16} className="text-[#00FF41] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-[#e2e2e2] truncate">{server.name}</span>
            <span className={clsx('w-2 h-2 rounded-full shrink-0', statusColor)} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">
              {server.agent}
            </span>
            <span className="text-[10px] font-mono text-[rgba(255,255,255,0.3)]">•</span>
            <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)]">
              {transportLabel}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
          disabled={removing}
          className="p-1.5 text-[rgba(255,255,255,0.3)] hover:text-neon-red transition-colors shrink-0"
          aria-label={`Remove ${server.name}`}
        >
          {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
        {expanded ? (
          <ChevronUp size={14} className="text-[rgba(255,255,255,0.4)] shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-[rgba(255,255,255,0.4)] shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-[#3b4b37]/20 pt-2 space-y-2 animate-float-in">
          {/* Command / URL */}
          {server.command && (
            <div>
              <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">Command</span>
              <p className="text-xs font-mono text-[#e2e2e2] mt-0.5 break-all">
                {server.command} {server.args?.join(' ')}
              </p>
            </div>
          )}
          {server.url && (
            <div>
              <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">URL</span>
              <p className="text-xs font-mono text-[#e2e2e2] mt-0.5 break-all">{server.url}</p>
            </div>
          )}

          {/* Environment variables (names only) */}
          {server.envKeys.length > 0 && (
            <div>
              <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">Env Vars</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {server.envKeys.map(key => (
                  <span
                    key={key}
                    className="text-[10px] font-mono bg-[#1f1f1f] text-[#84967e] px-1.5 py-0.5 border border-[#3b4b37]/20"
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Config path */}
          <div>
            <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">Config</span>
            <p className="text-[10px] font-mono text-[rgba(255,255,255,0.3)] mt-0.5 break-all">
              {server.configPath}
            </p>
          </div>

          {/* Error status */}
          {server.status === 'error' && (
            <div className="flex items-center gap-2 text-neon-red">
              <AlertCircle size={12} />
              <span className="text-xs font-mono">Config error</span>
            </div>
          )}

          {/* Tool Discovery */}
          <div className="pt-2 border-t border-[#3b4b37]/20">
            {tools.length === 0 && !toolsLoading && !toolsError && (
              <button
                onClick={discoverTools}
                className="flex items-center gap-2 text-xs font-mono text-[#00FF41] hover:text-[#00FF41]/80 transition-colors"
              >
                <Search size={12} />
                Discover Tools
              </button>
            )}
            {toolsLoading && (
              <div className="flex items-center gap-2 text-xs font-mono text-[rgba(255,255,255,0.4)]">
                <Loader2 size={12} className="animate-spin" />
                Discovering tools...
              </div>
            )}
            {toolsError && (
              <div className="flex items-center gap-2 text-xs font-mono text-neon-red">
                <AlertCircle size={12} />
                {toolsError}
              </div>
            )}
            {tools.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Wrench size={12} className="text-cyan-accent" />
                  <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">
                    {tools.length} tool{tools.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {tools.map(tool => (
                  <div key={tool.name} className="text-xs font-mono">
                    <span className="text-[#e2e2e2]">{tool.name}</span>
                    {tool.description && (
                      <span className="text-[rgba(255,255,255,0.3)] ml-2">— {tool.description.slice(0, 60)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
