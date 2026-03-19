import { useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';
import { useSecurityStore } from '../stores/securityStore';

interface UseTOTPReturn {
    isConfigured: boolean;
    isLoading: boolean;
    error: string | null;
    setup: () => Promise<{ qrUri: string; secret: string } | null>;
    verify: (code: string) => Promise<boolean>;
    checkStatus: () => Promise<void>;
}

/**
 * Hook for managing TOTP step-up authentication flow.
 * Wraps the TOTP API endpoints and connects to the security store.
 */
export function useTOTP(): UseTOTPReturn {
    const { totpConfigured, setTOTPConfigured } = useSecurityStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkStatus = useCallback(async () => {
        try {
            const status = await api.totp.status();
            setTOTPConfigured(status.configured);
        } catch {
            // If endpoint doesn't exist yet, assume not configured
            setTOTPConfigured(false);
        }
    }, [setTOTPConfigured]);

    // Check TOTP status on mount
    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const setup = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await api.totp.setup();
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'TOTP setup failed';
            setError(msg);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const verify = useCallback(async (code: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await api.totp.verify(code);
            if (result.valid) {
                setTOTPConfigured(true);
                return true;
            }
            setError('Invalid code. Please try again.');
            return false;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Verification failed';
            setError(msg);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [setTOTPConfigured]);

    return {
        isConfigured: totpConfigured,
        isLoading,
        error,
        setup,
        verify,
        checkStatus,
    };
}
