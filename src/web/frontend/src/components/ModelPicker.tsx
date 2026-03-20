import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { api } from '../utils/api';

interface ModelPickerProps {
    sessionName: string;
    agentType: string;  // 'claude' or 'opencode'
    currentModel?: string;
    onClose: () => void;
    onModelChanged?: (newModel: string) => void;
}

interface ModelOption {
    id: string;
    provider: string;
    name: string;
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

    const handleSwitch = async () => {
        if (!selected || selected === currentModel) return;

        setSwitching(true);
        setError(null);
        try {
            await api.sessions.switchModel(sessionName, selected);
            setSuccess(true);
            onModelChanged?.(selected);
            // Haptic
            if (navigator.vibrate) navigator.vibrate(50);
            setTimeout(onClose, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Model switch failed');
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
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
                className="w-full max-w-md mx-4 max-h-[80vh] bg-bg-elevated border border-border rounded-2xl shadow-float-lg overflow-hidden animate-in slide-in-from-bottom flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-accent-soft">
                            <Zap size={18} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-fg-strong">Switch Model</h2>
                            <p className="text-xs text-muted mt-0.5">Session context is preserved</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-muted hover:text-fg hover:bg-surface transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Switching overlay */}
                {switching && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-bg-elevated/90 backdrop-blur-sm">
                        <Loader2 size={32} className="animate-spin text-accent mb-3" />
                        <p className="text-sm text-fg-strong font-medium">Switching model...</p>
                        <p className="text-xs text-muted mt-1">Session history preserved</p>
                    </div>
                )}

                {/* Success overlay */}
                {success && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-bg-elevated/90 backdrop-blur-sm animate-in fade-in">
                        <CheckCircle2 size={32} className="text-success mb-3" />
                        <p className="text-sm text-fg-strong font-medium">Model switched!</p>
                    </div>
                )}

                {/* Model list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={32} className="animate-spin text-accent mb-3" />
                            <p className="text-sm text-muted">Loading models...</p>
                        </div>
                    ) : loadError ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <p className="text-sm text-danger mb-2">Failed to load models</p>
                            <p className="text-xs text-muted">{loadError}</p>
                        </div>
                    ) : options.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <p className="text-sm text-muted">No models available</p>
                            <p className="text-xs text-muted mt-1">
                                Configure a provider for {agentType} first
                            </p>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([provider, models]) => (
                            <div key={provider}>
                                <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2 px-1">{provider}</p>
                                <div className="space-y-1.5">
                                    {models.map(model => {
                                        const isCurrent = model.id === currentModel;
                                        const isSelected = model.id === selected;
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() => setSelected(model.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all min-h-[48px] ${isSelected
                                                    ? 'bg-accent-soft border border-accent/30'
                                                    : 'bg-surface border border-transparent hover:border-border'
                                                    }`}
                                                aria-pressed={isSelected}
                                            >
                                                {/* Radio indicator */}
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'border-accent bg-accent' : 'border-border'
                                                    }`}>
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-fg-strong">{model.name}</span>
                                                        {isCurrent && (
                                                            <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-semibold uppercase">
                                                                Current
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted mt-0.5">{model.description}</p>
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
                    <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
                        {error}
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border flex-shrink-0">
                    <button
                        onClick={handleSwitch}
                        disabled={!selected || selected === currentModel || switching || loading}
                        className="btn btn-primary w-full py-3 font-medium disabled:opacity-40"
                    >
                        {loading ? (
                            'Loading models...'
                        ) : selected === currentModel ? (
                            'Already using this model'
                        ) : (
                            `Switch to ${options.find(m => m.id === selected)?.name || 'selected'}`
                        )}
                    </button>
                </div>

                {/* iOS safe area */}
                <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
            </div>
        </div>
    );
}