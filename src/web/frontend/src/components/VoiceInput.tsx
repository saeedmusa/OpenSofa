/**
 * VoiceInput — SpeechRecognition wrapper (US-15, Architecture §1.3)
 *
 * Renders a 48×48 mic button with red pulse animation while recording.
 * Hides itself gracefully when the Web Speech API is unavailable.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { clsx } from 'clsx';
import { safeVibrate } from '../utils/haptics';

interface VoiceInputProps {
    /** Called with final transcription when the user stops speaking */
    onTranscript: (text: string) => void;
    disabled?: boolean;
}

// Feature-detect SpeechRecognition API
const SpeechRecognition =
    typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSupported] = useState(() => !!SpeechRecognition);
    const recognitionRef = useRef<any>(null);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const startListening = useCallback(() => {
        if (!SpeechRecognition || disabled) return;
        setError(null);

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const transcript = event.results[0]?.[0]?.transcript;
            if (transcript) {
                onTranscript(transcript);
            }
            stopListening();
        };

        recognition.onerror = (event: any) => {
            const errType = event.error;
            const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
            console.warn(`[VoiceInput] Speech recognition error: ${errType} (Offline: ${isOffline})`);
            
            if (errType === 'network') {
                if (isOffline) {
                    setError('Offline: Voice input requires an internet connection.');
                } else {
                    setError('Network error: Speech engine unreachable. Check connection.');
                }
            } else if (errType === 'not-allowed') {
                setError('Microphone access denied.');
            } else if (errType === 'no-speech') {
                // Ignore no-speech errors to avoid annoying the user
                setIsListening(false);
                return;
            } else {
                setError(`Speech error: ${errType}`);
            }
            
            stopListening();
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);

        // Haptic feedback on start
        safeVibrate(30);
    }, [disabled, onTranscript, stopListening]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    // Graceful fallback — hide entirely if unsupported
    if (!isSupported) return null;

    return (
        <div className="relative">
            {error && (
                <div className="absolute bottom-full mb-2 left-0 right-0 p-3 bg-matrix-green/10 border border-matrix-green/20 rounded shadow-lg backdrop-blur-md z-50">
                    <div className="flex items-center gap-2 text-matrix-green text-xs font-mono mb-2">
                        <span className="material-symbols-outlined text-sm">error</span>
                        {error}
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full py-1.5 bg-matrix-green/20 hover:bg-matrix-green/30 text-matrix-green text-[10px] font-mono uppercase tracking-wider transition-colors rounded"
                    >
                        Hard Reset App
                    </button>
                </div>
            )}
            <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={disabled}
                className={clsx(
                    'relative flex items-center justify-center',
                    'w-12 h-12 min-w-[48px] min-h-[48px]', // Touch target ≥ 48px
                    'rounded-xl transition-all duration-200',
                    isListening
                        ? 'bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                        : 'btn-ghost text-[rgba(255,255,255,0.5)] hover:text-fg-strong',
                    disabled && 'opacity-40 pointer-events-none',
                )}
                aria-label={isListening ? 'Stop recording' : 'Voice input'}
            >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}

                {/* Pulsing ring while recording */}
                {isListening && (
                    <span
                        className="absolute inset-0 rounded-xl border-2 border-red-400 animate-ping opacity-40"
                        aria-hidden="true"
                    />
                )}
            </button>
        </div>
    );
}
