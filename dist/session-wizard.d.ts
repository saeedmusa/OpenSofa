/**
 * OpenSofa - Session Wizard
 *
 * Interactive step-by-step session creation flow for WhatsApp.
 * Guides the user through agent selection, directory picking, and naming
 * instead of requiring a single complex command.
 */
import type { AgentType, OpenSofaConfig } from './types.js';
import type { AgentRegistry } from './agent-registry.js';
export type WizardResult = {
    type: 'message';
    text: string;
} | {
    type: 'create';
    name: string;
    dir: string;
    agent: AgentType;
    model: string;
};
export declare class SessionWizard {
    private state;
    private config;
    private agentRegistry;
    constructor(config: OpenSofaConfig, agentRegistry: AgentRegistry);
    get isActive(): boolean;
    /**
     * Start the wizard. Returns the first message to send.
     */
    start(): string;
    /**
     * Handle a user reply while wizard is active.
     * Returns a message to continue the wizard, or a create result to finish.
     * Returns null if wizard is not active.
     */
    handleReply(text: string): WizardResult | null;
    /**
     * Cancel the wizard. Returns confirmation message.
     */
    cancel(): string;
    private handleAgentStep;
    private buildDirectoryPrompt;
    private handleDirectoryStep;
    private browseDirectory;
    private handleBrowseStep;
    private selectDirectory;
    private handleNameStep;
    /**
     * Discover git repos in configured project directories.
     * Returns absolute paths to directories containing .git.
     */
    private discoverGitRepos;
}
//# sourceMappingURL=session-wizard.d.ts.map