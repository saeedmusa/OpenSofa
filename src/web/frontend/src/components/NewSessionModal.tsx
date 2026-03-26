import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { ModelProvider, DiscoveredModel } from '../types';
import { useToast } from './Toast';
import { useSessionCreation } from '../hooks/useSessionCreation';
import { X, Folder, GitBranch, ChevronRight, Loader2, Cpu, FolderPlus, Send, Sparkles, AlertTriangle, Layout, RefreshCw, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface BrowseEntry {
  name: string;
  type: 'directory' | 'file';
  isGitRepo?: boolean;
  isWorktree?: boolean;
}

interface SessionTemplate {
  id: string;
  name: string;
  agent: string;
  model?: string;
  description?: string;
  mcpServers?: string[];
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewSessionModal({ isOpen, onClose }: NewSessionModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'template' | 'agent' | 'directory' | 'prompt'>('template');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedDir, setSelectedDir] = useState<string>('');
  const [initialMessage, setInitialMessage] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [sessionCreationState, sessionCreationActions] = useSessionCreation();

  // Auto-save token from URL on component mount
  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get('token');
    if (urlToken) {
      localStorage.setItem('opensofa_token', urlToken);
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Load templates when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setTemplatesLoading(true);
    api.templates.list()
      .then(data => { if (!cancelled) setTemplates(data.templates); })
      .catch(() => { /* templates are optional */ })
      .finally(() => { if (!cancelled) setTemplatesLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Auto-generate session name from initial message
  const generateSessionName = (message: string): string => {
    if (!message.trim()) return '';
    // Take first few words, lowercase, replace spaces with hyphens, max 20 chars
    const words = message.trim().split(/\s+/).slice(0, 4);
    const baseName = words.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 20);
    // Add random suffix to avoid conflicts (4 chars = 1.6M combinations)
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${baseName}-${suffix}` || `session-${Date.now()}`;
  };

  // State for unified model discovery with timeout handling
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsTimedOut, setModelsTimedOut] = useState(false);
  const [modelsRetryCount, setModelsRetryCount] = useState(0);
  const modelsAbortRef = useRef<AbortController | null>(null);

  // Get current selected model info for vision warning
  const selectedModelInfo: DiscoveredModel | undefined = modelProviders
    .flatMap(p => p.models)
    .find(m => m.id === selectedModel);
  const isNonVisionModel = selectedModelInfo && !selectedModelInfo.supportsVision;

  // Fetch models with timeout and retry
  const fetchModels = useCallback(async (agent: string, retryCount: number = 0) => {
    // Cancel any existing request
    if (modelsAbortRef.current) {
      modelsAbortRef.current.abort();
    }

    const controller = new AbortController();
    modelsAbortRef.current = controller;

    setModelsLoading(true);
    setModelsError(null);
    setModelsTimedOut(false);
    setModelsRetryCount(retryCount);

    const timeoutId = setTimeout(() => {
      controller.abort();
      setModelsLoading(false);
      setModelsTimedOut(true);
      setModelsError('Model discovery timed out');
    }, 15000);

    try {
      const result = await api.models.discover([agent], controller.signal);
      clearTimeout(timeoutId);

      if (controller.signal.aborted) return;

      if (result.success && result.providers) {
        setModelProviders(result.providers);
        setModelsError(null);
        setModelsTimedOut(false);
      } else {
        setModelProviders([]);
        setModelsError(result.errors?.[0] || 'Failed to load models');
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (controller.signal.aborted) return;

      const errorMessage = err instanceof Error ? err.message : 'Failed to load models';

      // Auto-retry with exponential backoff (max 2 retries)
      if (retryCount < 2) {
        const delay = 1000 * Math.pow(2, retryCount);
        setTimeout(() => fetchModels(agent, retryCount + 1), delay);
        return;
      }

      setModelsError(errorMessage);
      setModelProviders([]);
    } finally {
      if (!controller.signal.aborted) {
        setModelsLoading(false);
      }
    }
  }, []);

  // Fetch models using unified discovery API
  useEffect(() => {
    if (!selectedAgent) {
      setModelProviders([]);
      setModelsError(null);
      setModelsTimedOut(false);
      return;
    }

    fetchModels(selectedAgent);

    return () => {
      if (modelsAbortRef.current) {
        modelsAbortRef.current.abort();
      }
    };
  }, [selectedAgent, fetchModels]);

  // Retry model discovery
  const handleRetryModels = useCallback(() => {
    if (selectedAgent) {
      fetchModels(selectedAgent, 0);
    }
  }, [selectedAgent, fetchModels]);

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

  const handleConfirmCreate = async () => {
    const name = generateSessionName(initialMessage);
    if (!name) {
      toast.error('Please enter a message');
      return;
    }

    const sessionId = await sessionCreationActions.create({
      name,
      dir: selectedDir,
      agent: selectedAgent,
      model: selectedModel,
      message: initialMessage.trim(),
    });

    if (sessionId) {
      toast.success('Session created! Navigating to chat...');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      onClose();
      resetForm();
      navigate(`/session/${encodeURIComponent(sessionId)}`);
    } else if (sessionCreationState.error) {
      toast.error(sessionCreationState.error);
    }
  };

  const resetForm = () => {
    setStep('agent');
    setSelectedAgent('');
    setSelectedModel('');
    setSelectedDir('');
    setInitialMessage('');
    setCurrentPath('');
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
      <div className="w-full max-w-md bg-[#0e0e0e] border border-[#00FF41]/30 shadow-[0_0_20px_rgba(0,255,65,0.15)] animate-scale-in">

        {/* Header - Kinetic Terminal Style */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#00FF41]/30 bg-black">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#00FF41] text-xl">terminal</span>
            <div>
              <h2 className="text-sm font-mono font-bold text-[#00FF41] uppercase tracking-wider">New Session</h2>
              <p className="text-[10px] font-mono text-[#00FFFF]">ROOT@OPENSOFA:~#</p>
            </div>
          </div>
          <button
            onClick={() => { onClose(); resetForm(); }}
            className="p-2 text-[#00FF41]/60 hover:text-[#00FF41] hover:bg-[#00FF41]/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {step === 'template' && (
            <div className="space-y-4">
              <p className="text-xs font-mono text-[#00FFFF] uppercase tracking-widest mb-3">Choose Template</p>

              {/* Custom (no template) */}
              <button
                onClick={() => setStep('agent')}
                className="w-full text-left p-3 border border-[#3b4b37]/30 bg-[#0e0e0e] hover:border-[#00FF41]/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Sparkles size={16} className="text-[#00FF41]" />
                  <div>
                    <p className="text-sm font-mono text-[#e2e2e2]">Custom</p>
                    <p className="text-xs font-mono text-[rgba(255,255,255,0.4)]">Start from scratch</p>
                  </div>
                </div>
              </button>

              {/* Templates */}
              {templatesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[#00FF41]" />
                </div>
              ) : templates.length > 0 ? (
                templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => {
                      setSelectedAgent(tmpl.agent);
                      if (tmpl.model) setSelectedModel(tmpl.model);
                      setStep('directory');
                    }}
                    className="w-full text-left p-3 border border-[#3b4b37]/30 bg-[#0e0e0e] hover:border-[#00FF41]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Layout size={16} className="text-cyan-accent" />
                      <div>
                        <p className="text-sm font-mono text-[#e2e2e2]">{tmpl.name}</p>
                        <p className="text-xs font-mono text-[rgba(255,255,255,0.4)]">
                          {tmpl.description || `${tmpl.agent}${tmpl.model ? ` / ${tmpl.model}` : ''}`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : null}
            </div>
          )}

          {step === 'agent' && (
            <div className="space-y-4">
              <p className="text-xs font-mono text-[#00FFFF] uppercase tracking-widest mb-3">Select Coding Agent</p>
              {agentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#00FF41]" />
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
                          ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41]'
                          : 'bg-[#1b1b1b] border-[#00FF41]/20 hover:border-[#00FF41]/50 text-[#00FF41]/80'
                      )}
                    >
                      <div className="flex-1 text-left">
                        <div className="font-mono font-bold text-sm">{agent.displayName}</div>
                        <div className="text-[10px] font-mono text-[#00FF41]/60">{agent.type}</div>
                      </div>
                      <ChevronRight size={18} className="text-[#00FF41]/40" />
                    </button>
                  ))}
                  {agents.filter(a => a.installed).length === 0 && (
                    <div className="text-center py-8 font-mono text-[#00FF41]/60">
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
                  className="text-[#00FFFF] hover:underline"
                >
                  ← Back
                </button>
                <span className="text-[#00FF41]/40">|</span>
                <span className="text-[#00FF41]/60">Agent: <span className="text-[#00FF41]">{selectedAgent}</span></span>
              </div>

              <p className="text-xs font-mono text-[#00FFFF] uppercase tracking-widest">Select Project Directory</p>

              {/* Path breadcrumb */}
              <div className="flex items-center gap-1 text-xs bg-[#1b1b1b] p-3 overflow-x-auto border border-[#00FF41]/20">
                <button
                  onClick={() => setCurrentPath('')}
                  className="text-[#00FF41] hover:underline whitespace-nowrap font-mono"
                >
                  ~/
                </button>
                {currentPath.split('/').filter(Boolean).map((part, idx, arr) => (
                  <span key={idx} className="flex items-center gap-1">
                    <span className="text-[#00FF41]/40">/</span>
                    <button
                      onClick={() => setCurrentPath(arr.slice(0, idx + 1).join('/'))}
                      className="text-[#00FF41] hover:underline whitespace-nowrap font-mono"
                    >
                      {part}
                    </button>
                  </span>
                ))}
              </div>

              {/* Model selection */}
              <div>
                <label className="flex items-center gap-2 text-xs font-mono text-[#00FFFF] uppercase tracking-widest mb-2">
                  <Cpu size={14} />
                  Model
                  {modelsLoading && !modelsTimedOut && (
                    <span className="text-[#00FF41]/60 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" />
                      loading{modelsRetryCount > 0 ? ` (retry ${modelsRetryCount})` : ''}...
                    </span>
                  )}
                </label>

                {/* Error/Timeout state */}
                {(modelsError || modelsTimedOut) && !modelsLoading && (
                  <div className="mb-2 px-3 py-2 bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={12} className="text-[#FF003C] shrink-0" />
                      <span className="text-[10px] font-mono text-[#FF003C]">
                        {modelsTimedOut ? 'Model discovery timed out' : modelsError}
                      </span>
                    </div>
                    <button
                      onClick={handleRetryModels}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-[#00FF41] bg-[#00FF41]/10 border border-[#00FF41]/30 hover:bg-[#00FF41]/20 transition-colors"
                    >
                      <RefreshCw size={10} />
                      Retry
                    </button>
                  </div>
                )}

                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-[#1b1b1b] border border-[#00FF41]/30 text-[#00FF41] font-mono px-3 py-2 text-sm focus:border-[#00FF41] focus:outline-none"
                  disabled={modelsLoading || (!!modelsError && !modelsTimedOut)}
                >
                  {modelsLoading ? (
                    <option value="">Loading models...</option>
                  ) : modelsError && !modelsTimedOut ? (
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
                  <div className="mt-2 px-3 py-2 bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center gap-2">
                    <AlertTriangle size={12} className="text-[#FF003C] shrink-0" />
                    <span className="text-[10px] font-mono text-[#FF003C] uppercase">
                      Text Only - This model cannot process images
                    </span>
                  </div>
                )}

                {!modelsLoading && !modelsError && modelProviders.length > 0 && (
                  <p className="text-[10px] font-mono text-[#00FF41]/60 mt-1">
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
                  className="w-full p-3 bg-[#00FF41] text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00FF41]-fixed transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  Continue with ~/{currentPath}
                </button>
              )}

              {/* New folder input */}
              {showNewFolderInput ? (
                <div className="flex gap-2 items-center p-3 bg-[#1b1b1b] border border-[#00FF41]/30">
                  <FolderPlus size={16} className="text-[#00FFFF]" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="folder name"
                    className="flex-1 bg-transparent outline-none text-[#00FF41] font-mono text-sm placeholder:text-[#00FF41]/40"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <button
                    onClick={handleCreateFolder}
                    className="px-3 py-1 bg-[#00FF41] text-black font-mono text-xs font-bold hover:bg-[#00FF41]-fixed"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                    className="p-1.5 text-[#00FF41]/60 hover:text-[#00FF41]"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  className="w-full flex items-center gap-2 p-3 border border-dashed border-[#00FF41]/30 text-[#00FF41]/60 hover:text-[#00FF41] hover:border-[#00FF41]/50 font-mono text-xs transition-colors"
                >
                  <FolderPlus size={16} />
                  <span>Create new folder</span>
                </button>
              )}

              {/* File list */}
              {browseLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#00FF41]" />
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
                      className="w-full flex items-center gap-3 p-3 hover:bg-[#1b1b1b] text-[#00FF41]/60 font-mono"
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
                          'w-full flex items-center gap-3 p-3 hover:bg-[#1b1b1b] transition-colors border-l-2',
                          entry.isWorktree ? 'border-l-neon-red/30 opacity-50' : 'border-l-transparent'
                        )}
                      >
                        <div className="p-1">
                          <Folder size={16} className="text-[#00FFFF]" />
                        </div>
                        <span className="flex-1 text-left font-mono text-sm text-[#00FF41] truncate">{entry.name}</span>
                        {entry.isGitRepo && !entry.isWorktree && (
                          <GitBranch size={12} className="text-[#00FF41]" />
                        )}
                        {entry.isWorktree && (
                          <span className="text-[10px] font-mono text-[#00FF41]/60">worktree</span>
                        )}
                        <ChevronRight size={14} className="text-[#00FF41]/40" />
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
                  className="text-[#00FFFF] hover:underline"
                >
                  ← Back
                </button>
              </div>

              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#00FF41]/10 mb-3 border border-[#00FF41]/30">
                  <Sparkles size={20} className="text-[#00FF41]" />
                </div>
                <h3 className="text-sm font-mono font-bold text-[#00FF41] uppercase tracking-wider">Instruct Agent</h3>
                <p className="text-[10px] font-mono text-[#00FF41]/60 mt-1">Describe what you want to accomplish</p>
              </div>

              {/* Vision Warning */}
              {isNonVisionModel && (
                <div className="px-3 py-2 bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center gap-2 mb-3">
                  <AlertTriangle size={12} className="text-[#FF003C] shrink-0" />
                  <span className="text-[10px] font-mono text-[#FF003C] uppercase">
                    Note: Selected model cannot process images
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-[#00FFFF] uppercase tracking-widest mb-2">Your Request</label>
                  <textarea
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="e.g., Help me add a new feature..."
                    className="w-full min-h-[120px] bg-[#1b1b1b] border border-[#00FF41]/30 text-[#00FF41] font-mono px-3 py-2 text-sm placeholder:text-[#00FF41]/30 focus:border-[#00FF41] focus:outline-none resize-none"
                    autoFocus
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'prompt' && (
          <div className="flex gap-3 p-4 border-t border-[#00FF41]/30 bg-black">
            <button
              onClick={() => { onClose(); resetForm(); }}
              className="flex-1 py-3 border border-[#00FF41]/30 text-[#00FF41] font-mono text-xs uppercase tracking-wider hover:bg-[#00FF41]/10 transition-colors disabled:opacity-40"
              disabled={sessionCreationState.isCreating}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCreate}
              disabled={sessionCreationState.isCreating || !initialMessage.trim()}
              className="flex-1 py-3 bg-[#00FF41] text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00FF41]-fixed transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {sessionCreationState.isCreating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {sessionCreationState.phase || 'Creating...'}
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
