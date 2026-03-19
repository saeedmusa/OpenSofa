/**
 * OpenSofa - Permission Classifier
 *
 * Scans agent output for patterns that indicate an approval/permission request.
 * Best-effort only - not a security boundary.
 * Based on LOW_LEVEL_DESIGN.md §10
 */
/**
 * Permission Classifier class
 * Stateless - pure function: agent output in → classification out
 */
export declare class PermissionClassifier {
    /**
     * Check if agent output contains an approval request
     * @param agentOutput - The agent's output text
     * @returns true if approval pattern detected
     */
    isApprovalRequest(agentOutput: string): boolean;
    /**
     * Extract the command being requested for approval
     * @param agentOutput - The agent's output text
     * @returns The command string or null if can't extract
     */
    extractCommand(agentOutput: string): string | null;
    /**
     * Classify agent output and return both detection and extracted command
     * @param agentOutput - The agent's output text
     * @returns Object with isApproval and optional command
     */
    classify(agentOutput: string): {
        isApproval: boolean;
        command: string | null;
    };
}
//# sourceMappingURL=permission-classifier.d.ts.map