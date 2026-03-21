import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { MCPServerCard, type MCPServer } from './MCPServerCard';
import { AddMCPServerModal } from './AddMCPServerModal';
import { Server, Loader2, Plus } from 'lucide-react';

export function MCPServerList() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadServers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.mcp.servers();
      setServers(data.servers as MCPServer[]);
    } catch {
      setServers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-[#00FF41]" />
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="text-center py-6">
        <Server size={20} className="text-[rgba(255,255,255,0.3)] mx-auto mb-2" />
        <p className="text-xs font-mono text-[rgba(255,255,255,0.4)]">
          No MCP servers configured
        </p>
        <p className="text-[10px] font-mono text-[rgba(255,255,255,0.3)] mt-1">
          Add them with: <code className="text-[#00FF41]">claude mcp add</code>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {servers.map((server) => (
          <MCPServerCard key={`${server.agent}-${server.name}`} server={server} onRemoved={loadServers} />
        ))}
      </div>

      {/* Add MCP Server button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full mt-3 flex items-center justify-center gap-2 p-3 border border-dashed border-[#3b4b37]/30 text-xs font-mono text-[rgba(255,255,255,0.4)] hover:border-[#00FF41]/50 hover:text-[#00FF41] transition-colors"
      >
        <Plus size={14} />
        Add MCP Server
      </button>

      <AddMCPServerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={loadServers}
      />
    </>
  );
}
