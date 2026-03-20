import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import { safeVibrate } from '../utils/haptics';
import type { DiscoveredModel } from '../types';

interface ModelPickerProps {
    sessionName: string;
    agentType: string;  // 'claude' or 'opencode'
    currentModel?: string;
    onClose: () => void;
    onModelChanged?: (newModel: string) => void;
}

interface ModelOption extends DiscoveredModel {
    description: string;
}

/**
 * Modal for switching the agent's model mid-session (US-17).
 * Fetches available models from the discovery API.
 * Architecture Ref: §1.3 Mid-Session Handoff, §1.10.1 Model Selection
 */
export function ModelPicker({ sessionName, agentType, currentModel, onClose, onModelChanged }: ModelPickerProps) {
    const [selected, setSelected] = useState(currentModel || '');
    const [switching, setSwitching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [options, setOptions] = useState<ModelOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Fetch models from discovery API
    useEffect(() => {
        let cancelled = false;

        async function fetchModels() {
            setLoading(true);
            setLoadError(null);

            try {
                const result = await api.models.discover([agentType]);

                if (cancelled) return;

                if (result.success && result.providers.length > 0) {
                    // Flatten providers into options
                    const fetchedOptions: ModelOption[] = result.providers.flatMap(provider =>
                        provider.models.map(model => ({
                            id: model.id,
                            name: model.name,
                            provider: provider.name,
                            description: `via ${provider.name}`,
                            agent: model.agent,
                            supportsVision: model.supportsVision ?? true,
                            supportsImages: model.supportsImages ?? false,
                        }))
                    );
                    setOptions(fetchedOptions);
                } else {
                    setOptions([]);
                    if (result.errors?.length) {
                        setLoadError(result.errors[0]);
                    }
                }
            } catch (err) {
                if (cancelled) return;
                setLoadError(err instanceof Error ? err.message : 'Failed to load models');
                setOptions([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchModels();

        return () => {
            cancelled = true;
        };
    }, [agentType]);

    // Get selected model for vision warning
    const selectedModel = options.find(m => m.id === selected);
    const isNonVision = selectedModel && !selectedModel.supportsVision;

    const handleSwitch = async () => {
        if (!selected || selected === currentModel) return;

        setSwitching(true);
        setError(null);
        try {
            await api.sessions.switchModel(sessionName, selected);
            setSuccess(true);
            onModelChanged?.(selected);
            // Haptic
            safeVibrate(50);
            setTimeout(onClose, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Model switch failed');
            safeVibrate([30, 50, 30]);
        } finally {
            setSwitching(false);
        }
    };

    // Group models by provider
    const grouped = options.reduce((acc, model) => {
        if (!acc[model.provider]) acc[model.provider] = [];
        acc[model.provider]!.push(model);
        return acc;
    }, {} as Record<string, ModelOption[]>);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Select AI model"
        >
            <div
                className="w-full max-w-md mx-4 max-h-[80vh] bg-[#0e0e0e] border border-[#00FF41]/30 shadow-[0_0_20px_rgba(0,255,65,0.15)] overflow-hidden animate-in slide-in-from-bottom flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header - Kinetic Terminal Style */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#00FF41]/30 bg-black">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#00FF41]">bolt</span>
                        <div>
                            <h2 className="text-sm font-mono font-bold text-[#00FF41] uppercase tracking-wider">Switch Model</h2>
                            <p className="text-[10px] text-[#00FFFF] font-mono">Session context is preserved</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[#00FF41]/60 hover:text-[#00FF41] hover:bg-[#00FF41]/10 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Vision AlertTriangle Banner */}
                {isNonVision && (
                    <div className="mx-4 mt-4 px-3 py-2 bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-[#FF003C] shrink-0" />
                        <span className="text-[10px] font-mono text-[#FF003C] uppercase tracking-wider">
                            No Image Support - This model cannot process images
                        </span>
                    </div>
                )}

                {/* Switching overlay */}
                {switching && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0e0e0e]/90 backdrop-blur-sm">
                        <Loader2 size={32} className="animate-spin text-[#00FF41] mb-3" />
                        <p className="text-sm font-mono text-[#00FF41]">Switching model...</p>
                        <p className="text-xs text-[#00FFFF] font-mono mt-1">Session history preserved</p>
                    </div>
                )}

                {/* Success overlay */}
                {success && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0e0e0e]/90 backdrop-blur-sm animate-in fade-in">
                        <CheckCircle2 size={32} className="text-[#00FF41] mb-3" />
                        <p className="text-sm font-mono text-[#00FF41]">Model switched!</p>
                    </div>
                )}

                {/* Model list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={32} className="animate-spin text-[#00FF41] mb-3" />
                            <p className="text-sm font-mono text-[#00FF41]/60">Loading models...</p>
                        </div>
                    ) : loadError ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <p className="text-sm font-mono text-[#FF003C] mb-2">Failed to load models</p>
                            <p className="text-xs font-mono text-[#00FF41]/40">{loadError}</p>
                        </div>
                    ) : options.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <p className="text-sm font-mono text-[#00FF41]/60">No models available</p>
                            <p className="text-xs font-mono text-[#00FF41]/40 mt-1">
                                Configure a provider for {agentType} first
                            </p>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([provider, models]) => (
                            <div key={provider}>
                                <p className="text-[10px] font-mono text-[#00FFFF] uppercase tracking-widest mb-2 px-1">{provider}</p>
                                <div className="space-y-1">
                                    {models.map(model => {
                                        const isCurrent = model.id === currentModel;
                                        const isSelected = model.id === selected;
                                        const isNonVisionModel = !model.supportsVision;
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() => setSelected(model.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all min-h-[48px] border ${
                                                    isSelected
                                                        ? 'bg-[#00FF41]/10 border-[#00FF41]/50'
                                                        : 'bg-[#1b1b1b] border-transparent hover:border-[#00FF41]/30'
                                                    }`}
                                                aria-pressed={isSelected}
                                            >
                                                {/* Radio indicator */}
                                                <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    isSelected ? 'border-[#00FF41] bg-[#00FF41]' : 'border-[#00FF41]/40'
                                                }`}>
                                                    {isSelected && <div className="w-2 h-2 bg-black" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-mono text-[#00FF41]">{model.name}</span>
                                                        {isCurrent && (
                                                            <span className="px-2 py-0.5 bg-[#00FF41]/20 text-[#00FF41] text-[10px] font-mono uppercase">
                                                                Current
                                                            </span>
                                                        )}
                                                        {isNonVisionModel && (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-[#FF003C]/10 text-[#FF003C] text-[10px] font-mono border border-[#FF003C]/30">
                                                                <AlertTriangle size={10} />
                                                                TEXT ONLY
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-mono text-[#00FF41]/60 mt-0.5">{model.description}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-4 mb-3 px-3 py-2 bg-[#FF003C]/10 border border-[#FF003C]/30 font-mono text-[10px] text-[#FF003C] uppercase">
                        {error}
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[#00FF41]/30 bg-black flex-shrink-0">
                    <button
                        onClick={handleSwitch}
                        disabled={!selected || selected === currentModel || switching || loading}
                        className="btn-primary w-full py-3 font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            'Loading...'
                        ) : selected === currentModel ? (
                            'Already Selected'
                        ) : (
                            <>Switch to {options.find(m => m.id === selected)?.name || 'model'}</>
                        )}
                    </button>
                </div>

                {/* iOS safe area */}
                <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
            </div>
        </div>
    );
}