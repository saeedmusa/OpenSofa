import { useState, useRef, useCallback, useEffect } from 'react';
import { ShieldCheck, X, Loader2 } from 'lucide-react';
import { useTOTP } from '../hooks/useTOTP';
import { useSecurityStore } from '../stores/securityStore';

interface TOTPModalProps {
    onVerified: () => void;
    onCancel: () => void;
}

export function TOTPModal({ onVerified, onCancel }: TOTPModalProps) {
    const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const { verify, isLoading, error } = useTOTP();
    const { pendingChallenge } = useSecurityStore();

    // Focus first input on mount
    useEffect(() => {
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }, []);

    const handleDigitChange = useCallback((index: number, value: string) => {
        // Only allow single digits
        const digit = value.replace(/\D/g, '').slice(-1);

        setDigits(prev => {
            const next = [...prev];
            next[index] = digit;
            return next;
        });

        // Auto-advance to next field
        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit on 6th digit
        if (digit && index === 5) {
            const code = [...digits.slice(0, 5), digit].join('');
            if (code.length === 6) {
                handleVerify(code);
            }
        }
    }, [digits]);

    const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }, [digits]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 0) return;

        const newDigits = [...digits];
        for (let i = 0; i < pasted.length && i < 6; i++) {
            newDigits[i] = pasted[i]!;
        }
        setDigits(newDigits);

        // Focus appropriate field
        const nextEmpty = Math.min(pasted.length, 5);
        inputRefs.current[nextEmpty]?.focus();

        // Auto-submit if full code pasted
        if (pasted.length === 6) {
            handleVerify(pasted);
        }
    }, [digits]);

    const handleVerify = async (code: string) => {
        const success = await verify(code);
        if (success) {
            onVerified();
        } else {
            // Clear and refocus
            setDigits(['', '', '', '', '', '']);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label="TOTP verification"
        >
            <div className="w-full max-w-sm mx-4 bg-bg-elevated border border-border rounded-2xl shadow-float-lg animate-in slide-in-from-bottom duration-300 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-warning/20">
                            <ShieldCheck size={20} className="text-warning" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-fg-strong">Security Verification</h2>
                            <p className="text-xs text-[rgba(255,255,255,0.5)] mt-0.5">Enter your 6-digit code</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-xl text-[rgba(255,255,255,0.5)] hover:text-fg hover:bg-surface transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Command preview */}
                {pendingChallenge && (
                    <div className="px-5 pt-4">
                        <p className="text-xs text-[rgba(255,255,255,0.5)] mb-2">Destructive command:</p>
                        <div className="bg-danger/5 border border-danger/20 rounded-xl p-3 font-mono text-xs text-danger overflow-x-auto">
                            {pendingChallenge.command}
                        </div>
                    </div>
                )}

                {/* OTP Input */}
                <div className="px-5 py-6">
                    <div className="flex justify-center gap-2" onPaste={handlePaste}>
                        {digits.map((digit, i) => (
                            <input
                                key={i}
                                ref={el => { inputRefs.current[i] = el; }}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={1}
                                value={digit}
                                onChange={e => handleDigitChange(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                className="w-12 h-14 text-center text-xl font-mono font-bold bg-surface border-2 border-border rounded-xl text-fg-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-soft)] transition-all"
                                aria-label={`Digit ${i + 1}`}
                                autoComplete="one-time-code"
                                disabled={isLoading}
                            />
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-danger text-xs text-center mt-3 font-medium animate-scale-in">
                            {error}
                        </p>
                    )}

                    {/* Loading */}
                    {isLoading && (
                        <div className="flex items-center justify-center gap-2 mt-3 text-[rgba(255,255,255,0.5)] text-xs">
                            <Loader2 size={14} className="animate-spin" />
                            Verifying...
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 pb-5">
                    <button
                        onClick={onCancel}
                        className="w-full py-3 text-sm text-[rgba(255,255,255,0.5)] hover:text-fg font-medium rounded-xl hover:bg-surface transition-colors"
                    >
                        Cancel
                    </button>
                </div>

                {/* Safe area padding for iOS */}
                <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
            </div>
        </div>
    );
}
