import { create } from 'zustand';

interface PendingChallenge {
    sessionName: string;
    command: string;
}

interface SecurityState {
    totpConfigured: boolean;
    pendingChallenge: PendingChallenge | null;

    setTOTPConfigured: (configured: boolean) => void;
    requestChallenge: (sessionName: string, command: string) => void;
    clearChallenge: () => void;
}

export const useSecurityStore = create<SecurityState>((set) => ({
    totpConfigured: false,
    pendingChallenge: null,

    setTOTPConfigured: (configured) => set({ totpConfigured: configured }),

    requestChallenge: (sessionName, command) =>
        set({ pendingChallenge: { sessionName, command } }),

    clearChallenge: () => set({ pendingChallenge: null }),
}));
