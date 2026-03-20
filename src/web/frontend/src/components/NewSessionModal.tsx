import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { ModelProvider, DiscoveredModel } from '../types';
import { useToast } from './Toast';
import { X, Folder, GitBranch, ChevronRight, Loader2, Cpu, FolderPlus, Send, Sparkles, AlertTriangle } from 'lucide-react';
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
  const navigate = useNavigate();
  const [step, setStep] = useState<'agent' | 'directory' | 'prompt'>('agent');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedDir, setSelectedDir] = useState<string>('');
  const [initialMessage, setInitialMessage] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  // Auto-save token from URL on component mount
  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get('token');
    if (urlToken) {
      localStorage.setItem('opensofa_token', urlToken);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Auto-generate session name from initial message
  const generateSessionName = (message: string): string => {
    if (!message.trim()) return '';
    // Take first few words, lowercase, replace spaces with hyphens, max 30 chars
    const words = message.trim().split(/\s+/).slice(0, 4);
    const name = words.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 28);
    return name || `session-${Date.now()}`;
  };

  // State for unified model discovery
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Get current selected model info for vision warning
  const selectedModelInfo: DiscoveredModel | undefined = modelProviders
    .flatMap(p => p.models)
    .find(m => m.id === selectedModel);
  const isNonVisionModel = selectedModelInfo && !selectedModelInfo.supportsVision;

  // Fetch models using unified discovery API
  useEffect(() => {
    if (!selectedAgent) {
      setModelProviders([]);
      return;
    }

    let cancelled = false;
    setModelsLoading(true);
    setModelsError(null);

    api.models.discover([selectedAgent])
      .then(result => {
        if (cancelled) return;
        if (result.success && result.providers) {
          setModelProviders(result.providers);
        } else {
          setModelProviders([]);
          setModelsError(result.errors?.[0] || 'Failed to load models');
        }
      })
      .catch(err => {
        if (cancelled) return;
        setModelsError(err instanceof Error ? err.message : 'Failed to load models');
        setModelProviders([]);
      })
      .finally(() => {
        if (!cancelled) {
          setModelsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAgent]);

  // Update selected model when agent changes and models are loaded
  useEffect(() => {
    if (modelProviders.length > 0) {
      const firstProvider = modelProviders[0];
      if (firstProvider.models.length > 0) {
        setSelectedModel(firstProvider.models[0].id);
      }
    } else if (!modelsLoading && !modelsError) {
      setSelectedModel('');
    }
  }, [selectedAgent, modelProviders, modelsLoading, modelsError]);

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(),
    enabled: isOpen,
  });

  const { data: browseData, isLoading: browseLoading } = useQuery({
    queryKey: ['browse', currentPath],
    queryFn: async () => {
      const token = api.getToken();
      const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      const res = await fetch(`/api/browse?path=${encodeURIComponent(currentPath)}`, { headers });
      return res.json();
    },
    enabled: isOpen && step === 'directory',
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; dir: string; agent: string; model?: string; message?: string }) => {
      // Create session
      const token = api.getToken();
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      // If there's an initial message, wait for session to be ready then send it
      if (data.message && result.success) {
        // Poll session status until it's active (max 120 seconds)
        const maxAttempts = 60;
        const pollInterval = 2000; // 2 seconds
        let attempts = 0;

        while (attempts < maxAttempts) {
          try {
            const statusRes = await fetch(`/api/sessions/${data.name}`, {
              headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
            });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.data?.status === 'active') {
                // Session is ready, send the initial message
                await fetch(`/api/sessions/${data.name}/message`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ content: data.message }),
                });
                break;
              }
            }
          } catch {
            // Ignore errors during polling, keep trying
          }
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      return { ...result, name: data.name };
    },
    onSuccess: (data) => {
      const sessionName = typeof data === 'object' && data !== null && 'name' in data
        ? (data as { name: string }).name
        : name;
      toast.success('Session created! Navigating to chat...');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      onClose();
      resetForm();
      // Navigate to the session view
      if (sessionName) {
        navigate(`/session/${encodeURIComponent(sessionName)}`);
      }
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
    setInitialMessage('');
    setCurrentPath('');
  };

  const handleConfirmCreate = () => {
    const name = generateSessionName(initialMessage);
    if (!name) {
      toast.error('Please enter a message');
      return;
    }
    createMutation.mutate({
      name,
      dir: selectedDir,
      agent: selectedAgent,
      model: selectedModel,
      message: initialMessage.trim(),
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    const token = api.getToken();
    const targetPath = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;

    try {
      const res = await fetch('/api/browse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ path: targetPath, create: true }),
      });

      if (res.ok) {
        setNewFolderName('');
        setShowNewFolderInput(false);
        queryClient.invalidateQueries({ queryKey: ['browse', currentPath] });
        toast.success('Directory created!');
      } else {
        toast.error('Failed to create directory');
      }
    } catch {
      toast.error('Failed to create directory');
    }
  };

  if (!isOpen) return null;

  const agents = agentsData?.agents || [];
  const entries: BrowseEntry[] = browseData?.data?.entries || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-surface-container-lowest border border-matrix-green/30 shadow-[0_0_20px_rgba(0,255,65,0.15)] animate-scale-in">

        {/* Header - Kinetic Terminal Style */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-matrix-green/30 bg-black">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-matrix-green text-xl">terminal</span>
            <div>
              <h2 className="text-sm font-mono font-bold text-matrix-green uppercase tracking-wider">New Session</h2>
              <p className="text-[10px] font-mono text-cyan-accent">ROOT@OPENSOFA:~#</p>
            </div>
          </div>
          <button
            onClick={() => { onClose(); resetForm(); }}
            className="p-2 text-matrix-green/60 hover:text-matrix-green hover:bg-matrix-green/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {step === 'agent' && (
            <div className="space-y-4">
              <p className="text-xs font-mono text-cyan-accent uppercase tracking-widest mb-3">Select Coding Agent</p>
              {agentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-matrix-green" />
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
                        'w-full flex items-center gap-3 p-4 border transition-all',
                        selectedAgent === agent.type
                          ? 'bg-matrix-green/10 border-matrix-green text-matrix-green'
                          : 'bg-surface-container-low border-matrix-green/20 hover:border-matrix-green/50 text-matrix-green/80'
                      )}
                    >
                      <div className="flex-1 text-left">
                        <div className="font-mono font-bold text-sm">{agent.displayName}</div>
                        <div className="text-[10px] font-mono text-matrix-green/60">{agent.type}</div>
                      </div>
                      <ChevronRight size={18} className="text-matrix-green/40" />
                    </button>
                  ))}
                  {agents.filter(a => a.installed).length === 0 && (
                    <div className="text-center py-8 font-mono text-matrix-green/60">
                      No agents installed. Install claude, aider, or opencode first.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'directory' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  onClick={() => setStep('agent')}
                  className="text-cyan-accent hover:underline"
                >
                  ← Back
                </button>
                <span className="text-matrix-green/40">|</span>
                <span className="text-matrix-green/60">Agent: <span className="text-matrix-green">{selectedAgent}</span></span>
              </div>

              <p className="text-xs font-mono text-cyan-accent uppercase tracking-widest">Select Project Directory</p>

              {/* Path breadcrumb */}
              <div className="flex items-center gap-1 text-xs bg-surface-container-low p-3 overflow-x-auto border border-matrix-green/20">
                <button
                  onClick={() => setCurrentPath('')}
                  className="text-matrix-green hover:underline whitespace-nowrap font-mono"
                >
                  ~/
                </button>
                {currentPath.split('/').filter(Boolean).map((part, idx, arr) => (
                  <span key={idx} className="flex items-center gap-1">
                    <span className="text-matrix-green/40">/</span>
                    <button
                      onClick={() => setCurrentPath(arr.slice(0, idx + 1).join('/'))}
                      className="text-matrix-green hover:underline whitespace-nowrap font-mono"
                    >
                      {part}
                    </button>
                  </span>
                ))}
              </div>

              {/* Model selection */}
              <div>
                <label className="flex items-center gap-2 text-xs font-mono text-cyan-accent uppercase tracking-widest mb-2">
                  <Cpu size={14} />
                  Model
                  {modelsLoading && <span className="text-matrix-green/60">(loading...)</span>}
                  {modelsError && <span className="text-neon-red">({modelsError})</span>}
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-surface-container-low border border-matrix-green/30 text-matrix-green font-mono px-3 py-2 text-sm focus:border-matrix-green focus:outline-none"
                  disabled={modelsLoading || !!modelsError}
                >
                  {modelsLoading ? (
                    <option value="">Loading models...</option>
                  ) : modelsError ? (
                    <option value="">No models available</option>
                  ) : modelProviders.length === 0 ? (
                    <option value="">No models available for {selectedAgent}</option>
                  ) : (
                    modelProviders
                      .filter(p => p.agent === selectedAgent)
                      .map(provider => (
                        <optgroup key={provider.id} label={provider.name}>
                          {provider.models.map(model => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </optgroup>
                      ))
                  )}
                </select>

                {/* Vision Warning */}
                {isNonVisionModel && (
                  <div className="mt-2 px-3 py-2 bg-neon-red/10 border border-neon-red/30 flex items-center gap-2">
                    <AlertTriangle size={12} className="text-neon-red shrink-0" />
                    <span className="text-[10px] font-mono text-neon-red uppercase">
                      Text Only - This model cannot process images
                    </span>
                  </div>
                )}

                {!modelsLoading && !modelsError && modelProviders.length > 0 && (
                  <p className="text-[10px] font-mono text-matrix-green/60 mt-1">
                    {modelProviders.reduce((sum, p) => sum + p.models.length, 0)} models from {modelProviders.filter(p => p.agent === selectedAgent).length} provider(s)
                  </p>
                )}
              </div>

              {/* Quick select current directory */}
              {currentPath && (
                <button
                  onClick={() => {
                    setSelectedDir(`~/${currentPath}`);
                    setStep('prompt');
                  }}
                  className="w-full p-3 bg-matrix-green text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-matrix-green-fixed transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  Continue with ~/{currentPath}
                </button>
              )}

              {/* New folder input */}
              {showNewFolderInput ? (
                <div className="flex gap-2 items-center p-3 bg-surface-container-low border border-matrix-green/30">
                  <FolderPlus size={16} className="text-cyan-accent" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="folder name"
                    className="flex-1 bg-transparent outline-none text-matrix-green font-mono text-sm placeholder:text-matrix-green/40"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <button
                    onClick={handleCreateFolder}
                    className="px-3 py-1 bg-matrix-green text-black font-mono text-xs font-bold hover:bg-matrix-green-fixed"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                    className="p-1.5 text-matrix-green/60 hover:text-matrix-green"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  className="w-full flex items-center gap-2 p-3 border border-dashed border-matrix-green/30 text-matrix-green/60 hover:text-matrix-green hover:border-matrix-green/50 font-mono text-xs transition-colors"
                >
                  <FolderPlus size={16} />
                  <span>Create new folder</span>
                </button>
              )}

              {/* File list */}
              {browseLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-matrix-green" />
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
                      className="w-full flex items-center gap-3 p-3 hover:bg-surface-container-low text-matrix-green/60 font-mono"
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
                          'w-full flex items-center gap-3 p-3 hover:bg-surface-container-low transition-colors border-l-2',
                          entry.isWorktree ? 'border-l-neon-red/30 opacity-50' : 'border-l-transparent'
                        )}
                      >
                        <div className="p-1">
                          <Folder size={16} className="text-cyan-accent" />
                        </div>
                        <span className="flex-1 text-left font-mono text-sm text-matrix-green truncate">{entry.name}</span>
                        {entry.isGitRepo && !entry.isWorktree && (
                          <GitBranch size={12} className="text-matrix-green" />
                        )}
                        {entry.isWorktree && (
                          <span className="text-[10px] font-mono text-matrix-green/60">worktree</span>
                        )}
                        <ChevronRight size={14} className="text-matrix-green/40" />
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {step === 'prompt' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  onClick={() => setStep('directory')}
                  className="text-cyan-accent hover:underline"
                >
                  ← Back
                </button>
              </div>

              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-matrix-green/10 mb-3 border border-matrix-green/30">
                  <Sparkles size={20} className="text-matrix-green" />
                </div>
                <h3 className="text-sm font-mono font-bold text-matrix-green uppercase tracking-wider">Instruct Agent</h3>
                <p className="text-[10px] font-mono text-matrix-green/60 mt-1">Describe what you want to accomplish</p>
              </div>

              {/* Vision Warning */}
              {isNonVisionModel && (
                <div className="px-3 py-2 bg-neon-red/10 border border-neon-red/30 flex items-center gap-2 mb-3">
                  <AlertTriangle size={12} className="text-neon-red shrink-0" />
                  <span className="text-[10px] font-mono text-neon-red uppercase">
                    Note: Selected model cannot process images
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-cyan-accent uppercase tracking-widest mb-2">Your Request</label>
                  <textarea
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="e.g., Help me add a new feature..."
                    className="w-full min-h-[120px] bg-surface-container-low border border-matrix-green/30 text-matrix-green font-mono px-3 py-2 text-sm placeholder:text-matrix-green/30 focus:border-matrix-green focus:outline-none resize-none"
                    autoFocus
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'prompt' && (
          <div className="flex gap-3 p-4 border-t border-matrix-green/30 bg-black">
            <button
              onClick={() => { onClose(); resetForm(); }}
              className="flex-1 py-3 border border-matrix-green/30 text-matrix-green font-mono text-xs uppercase tracking-wider hover:bg-matrix-green/10 transition-colors disabled:opacity-40"
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCreate}
              disabled={createMutation.isPending || !initialMessage.trim()}
              className="flex-1 py-3 bg-matrix-green text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-matrix-green-fixed transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Start Session
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
