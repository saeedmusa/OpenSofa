import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useToast } from './Toast';
import { X, Folder, GitBranch, ChevronRight, Loader2, Plus, Cpu } from 'lucide-react';
import { clsx } from 'clsx';

interface BrowseEntry {
  name: string;
  type: 'directory' | 'file';
  isGitRepo?: boolean;
  isWorktree?: boolean;
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewSessionModal({ isOpen, onClose }: NewSessionModalProps) {
  const [step, setStep] = useState<'agent' | 'directory' | 'name'>('agent');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedDir, setSelectedDir] = useState<string>('');
  const [sessionName, setSessionName] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  // Models per agent type
  const modelsByAgent: Record<string, string[]> = {
    claude: [
      'anthropic/claude-sonnet-4-5-20250514',
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-sonnet-4',
      'anthropic/claude-3-5-sonnet-20241022',
      'anthropic/claude-3-5-sonnet',
      'anthropic/claude-3-opus',
      'anthropic/claude-3-sonnet',
      'anthropic/claude-3-haiku',
    ],
    openai: [
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'openai/gpt-4-turbo',
      'openai/gpt-4',
    ],
    google: [
      'google/gemini-2.0-flash-exp',
      'google/gemini-1.5-pro',
      'google/gemini-1.5-flash',
    ],
    aider: [
      'anthropic/claude-sonnet-4-5-20250514',
      'anthropic/claude-sonnet-4-5',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
    ],
    opencode: [
      'anthropic/claude-sonnet-4-5-20250514',
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-sonnet-4',
      'anthropic/claude-3-5-sonnet-20241022',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-exp',
      'google/gemini-1.5-pro',
    ],
  };

  // Get models for selected agent
  const availableModels = selectedAgent ? modelsByAgent[selectedAgent] || [] : [];

  // Update selected model when agent changes
  useEffect(() => {
    if (availableModels.length > 0) {
      setSelectedModel(availableModels[0]);
    }
  }, [selectedAgent]);

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(),
    enabled: isOpen,
  });

  const { data: browseData, isLoading: browseLoading } = useQuery({
    queryKey: ['browse', currentPath],
    queryFn: async () => {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(currentPath)}`);
      return res.json();
    },
    enabled: isOpen && step === 'directory',
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; dir: string; agent: string; model?: string }) =>
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      toast.success('Session creation started! Check the activity feed for progress.');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      onClose();
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create session');
    },
  });

  const resetForm = () => {
    setStep('agent');
    setSelectedAgent('');
    setSelectedModel('');
    setSelectedDir('');
    setSessionName('');
    setCurrentPath('');
  };

  const handleCreate = () => {
    if (!sessionName.trim()) {
      toast.error('Please enter a session name');
      return;
    }
    if (!/^[a-zA-Z0-9-]{1,30}$/.test(sessionName)) {
      toast.error('Name must be 1-30 chars: letters, numbers, hyphens only');
      return;
    }
    createMutation.mutate({
      name: sessionName.trim(),
      dir: selectedDir,
      agent: selectedAgent,
      model: selectedModel,
    });
  };

  if (!isOpen) return null;

  const agents = agentsData?.agents || [];
  const entries: BrowseEntry[] = browseData?.data?.entries || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-fg-strong">New Session</h2>
          <button
            onClick={() => { onClose(); resetForm(); }}
            className="p-2 rounded-xl hover:bg-surface-elevated text-muted hover:text-fg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {step === 'agent' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">Select a coding agent:</p>
              {agentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
              ) : (
                <div className="space-y-2">
                  {agents.filter(a => a.installed).map((agent) => (
                    <button
                      key={agent.type}
                      onClick={() => {
                        setSelectedAgent(agent.type);
                        setStep('directory');
                      }}
                      className={clsx(
                        'w-full flex items-center gap-3 p-4 rounded-xl border transition-all',
                        selectedAgent === agent.type
                          ? 'bg-accent-soft border-accent text-accent'
                          : 'bg-surface-elevated border-border hover:border-accent/50'
                      )}
                    >
                      <div className="flex-1 text-left">
                        <div className="font-medium">{agent.displayName}</div>
                        <div className="text-xs text-muted">{agent.type}</div>
                      </div>
                      <ChevronRight size={18} className="text-muted" />
                    </button>
                  ))}
                  {agents.filter(a => a.installed).length === 0 && (
                    <div className="text-center py-8 text-muted">
                      No agents installed. Install claude, aider, or opencode first.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'directory' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('agent')}
                  className="text-sm text-accent hover:underline"
                >
                  ← Back
                </button>
                <span className="text-muted">|</span>
                <span className="text-sm text-muted">Agent: <span className="text-fg">{selectedAgent}</span></span>
              </div>
              
              <p className="text-sm text-muted">Select a project directory:</p>
              
              {/* Path breadcrumb */}
              <div className="flex items-center gap-1 text-xs bg-surface-elevated p-3 rounded-xl overflow-x-auto">
                <button
                  onClick={() => setCurrentPath('')}
                  className="text-accent hover:underline whitespace-nowrap"
                >
                  ~
                </button>
                {currentPath.split('/').filter(Boolean).map((part, idx, arr) => (
                  <span key={idx} className="flex items-center gap-1">
                    <span className="text-muted">/</span>
                    <button
                      onClick={() => setCurrentPath(arr.slice(0, idx + 1).join('/'))}
                      className="text-accent hover:underline whitespace-nowrap"
                    >
                      {part}
                    </button>
                  </span>
                ))}
              </div>

              {/* Quick select current directory */}
              {currentPath && (
                <button
                  onClick={() => {
                    setSelectedDir(`~/${currentPath}`);
                    setStep('name');
                  }}
                  className="w-full p-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Use this directory: ~/{currentPath}
                </button>
              )}

              {/* File list */}
              {browseLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {currentPath && (
                    <button
                      onClick={() => {
                        const parts = currentPath.split('/');
                        parts.pop();
                        setCurrentPath(parts.join('/'));
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-elevated text-muted"
                    >
                      <span>..</span>
                    </button>
                  )}
                  {entries
                    .filter((entry) => entry.type === 'directory')
                    .map((entry) => (
                      <button
                        key={entry.name}
                        onClick={() => setCurrentPath(currentPath ? `${currentPath}/${entry.name}` : entry.name)}
                        className={clsx(
                          'w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-elevated transition-colors',
                          entry.isWorktree && 'opacity-50'
                        )}
                      >
                        <div className="p-1.5 rounded-lg bg-warning-soft">
                          <Folder size={16} className="text-warning" />
                        </div>
                        <span className="flex-1 text-left truncate">{entry.name}</span>
                        {entry.isGitRepo && !entry.isWorktree && (
                          <GitBranch size={14} className="text-success" />
                        )}
                        {entry.isWorktree && (
                          <span className="text-xs text-muted">worktree</span>
                        )}
                        <ChevronRight size={16} className="text-muted" />
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {step === 'name' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('directory')}
                  className="text-sm text-accent hover:underline"
                >
                  ← Back
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-muted mb-2">Agent</label>
                  <div className="p-3 rounded-xl bg-surface-elevated text-fg">{selectedAgent}</div>
                </div>

                <div>
                  <label className="block text-sm text-muted mb-2">Directory</label>
                  <div className="p-3 rounded-xl bg-surface-elevated text-fg font-mono text-sm truncate">
                    {selectedDir}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm text-muted mb-2">
                    <Cpu size={14} />
                    Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="input-field w-full"
                  >
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model.split('/').pop()}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted mt-1">
                    {selectedModel}
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-muted mb-2">Session Name</label>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="e.g., my-feature"
                    className="input-field w-full"
                    autoFocus
                  />
                  <p className="text-xs text-muted mt-1">
                    1-30 characters: letters, numbers, hyphens only
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'name' && (
          <div className="flex gap-3 p-5 border-t border-border">
            <button
              onClick={() => { onClose(); resetForm(); }}
              className="btn btn-secondary flex-1"
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!sessionName.trim() || createMutation.isPending}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Session
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
