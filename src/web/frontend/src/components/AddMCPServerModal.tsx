import { useState } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from './Toast';

interface AddMCPServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddMCPServerModal({ isOpen, onClose, onAdded }: AddMCPServerModalProps) {
  const [name, setName] = useState('');
  const [agent, setAgent] = useState('claude');
  const [transport, setTransport] = useState<'stdio' | 'http'>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Server name is required');
      return;
    }

    if (transport === 'stdio' && !command.trim()) {
      toast.error('Command is required for stdio transport');
      return;
    }

    if (transport === 'http' && !url.trim()) {
      toast.error('URL is required for HTTP transport');
      return;
    }

    setSaving(true);
    try {
      await api.mcp.add({
        agent,
        name: name.trim(),
        ...(transport === 'stdio'
          ? { command: command.trim(), args: args.trim() ? args.split(',').map(a => a.trim()) : undefined }
          : { url: url.trim() }),
      });
      toast.success(`MCP server "${name}" added`);
      onAdded();
      onClose();
      // Reset form
      setName('');
      setCommand('');
      setArgs('');
      setUrl('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add server');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#0e0e0e] border border-[#3b4b37]/30 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3b4b37]/30">
          <h2 className="text-sm font-mono font-bold text-[#e2e2e2] uppercase tracking-wider">Add MCP Server</h2>
          <button onClick={onClose} className="p-1.5 text-[rgba(255,255,255,0.5)] hover:text-[#e2e2e2]">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Server Name */}
          <div>
            <label className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">Server Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., github, filesystem"
              className="w-full mt-1 px-3 py-2 bg-[#1f1f1f] border border-[#3b4b37]/30 text-sm font-mono text-[#e2e2e2] placeholder:text-[rgba(255,255,255,0.2)] focus:border-[#00FF41]/50 outline-none"
            />
          </div>

          {/* Target Agent */}
          <div>
            <label className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">Target Agent *</label>
            <select
              value={agent}
              onChange={e => setAgent(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[#1f1f1f] border border-[#3b4b37]/30 text-sm font-mono text-[#e2e2e2] outline-none"
            >
              <option value="claude">Claude Code</option>
              <option value="opencode">OpenCode</option>
            </select>
          </div>

          {/* Transport */}
          <div>
            <label className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">Transport *</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setTransport('stdio')}
                className={`flex-1 px-3 py-2 text-xs font-mono border transition-colors ${
                  transport === 'stdio'
                    ? 'border-[#00FF41]/50 text-[#00FF41] bg-[#00FF41]/10'
                    : 'border-[#3b4b37]/30 text-[rgba(255,255,255,0.5)]'
                }`}
              >
                STDIO
              </button>
              <button
                onClick={() => setTransport('http')}
                className={`flex-1 px-3 py-2 text-xs font-mono border transition-colors ${
                  transport === 'http'
                    ? 'border-[#00FF41]/50 text-[#00FF41] bg-[#00FF41]/10'
                    : 'border-[#3b4b37]/30 text-[rgba(255,255,255,0.5)]'
                }`}
              >
                HTTP
              </button>
            </div>
          </div>

          {/* Command (stdio) */}
          {transport === 'stdio' && (
            <>
              <div>
                <label className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">Command *</label>
                <input
                  type="text"
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  placeholder="e.g., npx, node, python3"
                  className="w-full mt-1 px-3 py-2 bg-[#1f1f1f] border border-[#3b4b37]/30 text-sm font-mono text-[#e2e2e2] placeholder:text-[rgba(255,255,255,0.2)] focus:border-[#00FF41]/50 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">Arguments (comma-separated)</label>
                <input
                  type="text"
                  value={args}
                  onChange={e => setArgs(e.target.value)}
                  placeholder="e.g., -y, @modelcontextprotocol/server-github"
                  className="w-full mt-1 px-3 py-2 bg-[#1f1f1f] border border-[#3b4b37]/30 text-sm font-mono text-[#e2e2e2] placeholder:text-[rgba(255,255,255,0.2)] focus:border-[#00FF41]/50 outline-none"
                />
              </div>
            </>
          )}

          {/* URL (http) */}
          {transport === 'http' && (
            <div>
              <label className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] uppercase">URL *</label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="e.g., http://localhost:3001/mcp"
                className="w-full mt-1 px-3 py-2 bg-[#1f1f1f] border border-[#3b4b37]/30 text-sm font-mono text-[#e2e2e2] placeholder:text-[rgba(255,255,255,0.2)] focus:border-[#00FF41]/50 outline-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[#3b4b37]/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono text-[rgba(255,255,255,0.5)] hover:text-[#e2e2e2] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#00FF41] text-[#000] text-xs font-mono font-bold hover:bg-[#00FF41]/80 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Server
          </button>
        </div>
      </div>
    </div>
  );
}
