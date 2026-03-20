import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { ModelProvider } from '../types';
import { useToast } from './Toast';
import { X, Folder, GitBranch, ChevronRight, Loader2, Cpu, FolderPlus, Send, Sparkles } from 'lucide-react';
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

              {/* Model selection */}
              <div>
                <label className="flex items-center gap-2 text-sm text-muted mb-2">
                  <Cpu size={14} />
                  Model
                  {modelsLoading && <span className="text-xs">(loading...)</span>}
                  {modelsError && <span className="text-xs text-error">({modelsError})</span>}
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="input-field w-full"
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
                {!modelsLoading && !modelsError && modelProviders.length > 0 && (
                  <p className="text-xs text-muted mt-1">
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
                  className="w-full p-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} />
                  Continue with ~/{currentPath}
                </button>
              )}

              {/* New folder input */}
              {showNewFolderInput ? (
                <div className="flex gap-2 items-center p-3 rounded-xl bg-surface-elevated border border-accent/30">
                  <FolderPlus size={18} className="text-accent" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="folder name"
                    className="flex-1 bg-transparent outline-none text-fg placeholder:text-muted"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <button
                    onClick={handleCreateFolder}
                    className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                    className="p-1.5 rounded-lg hover:bg-surface text-muted"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-border hover:border-accent/50 text-muted hover:text-accent transition-colors"
                >
                  <FolderPlus size={18} />
                  <span className="text-sm">Create new folder</span>
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
                      <span className="text-muted">..</span>
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

          {step === 'prompt' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('directory')}
                  className="text-sm text-accent hover:underline"
                >
                  ← Back
                </button>
              </div>

              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-accent to-coral mb-3">
                  <Sparkles size={24} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold text-fg-strong">What would you like help with?</h3>
                <p className="text-sm text-muted mt-1">Describe what you want to accomplish</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-muted mb-2">Your request</label>
                  <textarea
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="e.g., Help me add a new feature to the homepage, or review this code..."
                    className="input-field w-full min-h-[120px] resize-none"
                    autoFocus
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'prompt' && (
          <div className="flex gap-3 p-5 border-t border-border">
            <button
              onClick={() => { onClose(); resetForm(); }}
              className="btn btn-secondary flex-1"
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCreate}
              disabled={createMutation.isPending || !initialMessage.trim()}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send size={16} />
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
