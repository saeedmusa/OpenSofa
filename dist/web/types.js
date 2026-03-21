/**
 * OpenSofa Web - Type Definitions
 *
 * Types specific to the web interface: API responses, WebSocket events,
 * and configuration.
 */
export const DEFAULT_WEB_CONFIG = {
    enabled: true,
    port: 3285,
    tunnel: {
        provider: 'cloudflare',
    },
    auth: {
        tokenPath: '~/.opensofa/web-token',
        tokenExpiryHours: 168, // 7 days — mobile users can't re-scan QR easily
    },
};
// Helper functions for creating responses (pure functions)
export const success = (data) => ({
    success: true,
    data,
});
export const error = (message, code) => ({
    success: false,
    error: message,
    code,
});
// ──────────────────────────────────────
// Helper: Convert Session to API types
// ──────────────────────────────────────
export const sessionToSummary = (session) => ({
    name: session.name,
    status: session.status,
    agentType: session.agentType,
    model: session.model,
    branch: session.branch,
    agentStatus: session.agentStatus,
    hasPendingApproval: !!session.pendingApproval,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
});
export const sessionToDetail = (session) => ({
    name: session.name,
    status: session.status,
    agentType: session.agentType,
    model: session.model,
    branch: session.branch,
    agentStatus: session.agentStatus,
    hasPendingApproval: !!session.pendingApproval,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    workDir: session.workDir,
    repoDir: session.repoDir,
    port: session.port,
    autoApprove: !!(session.autoApprove),
    pendingApproval: session.pendingApproval
        ? {
            detectedAt: session.pendingApproval.detectedAt,
            command: session.pendingApproval.command,
        }
        : null,
});
//# sourceMappingURL=types.js.map