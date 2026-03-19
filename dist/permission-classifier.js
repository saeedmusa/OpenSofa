/**
 * OpenSofa - Permission Classifier
 *
 * Scans agent output for patterns that indicate an approval/permission request.
 * Best-effort only - not a security boundary.
 * Based on LOW_LEVEL_DESIGN.md §10
 */
import { createLogger } from './utils/logger.js';
const log = createLogger('permission-classifier');
/**
 * Approval request patterns from various coding agents
 * These patterns typically appear at the end of agent output
 */
const APPROVAL_PATTERNS = [
    // Claude Code patterns
    /Do you want to proceed\?/i,
    /Would you like me to/i,
    /Shall I/i,
    /May I/i,
    /I'd like to run:/i,
    /I need to execute:/i,
    /Allow this action\?/i,
    /Press Enter to continue/i,
    /\[Y\/n\]/i,
    /\[y\/N\]/i,
    /\(yes\/no\)/i,
    /\(y\/n\)/i,
    // Aider patterns
    /Run .*\? \(Y\)es/i,
    /Allow edit to/i,
    /Add .* to the chat\?/i,
    // OpenCode patterns
    /Allow this tool\?/i,
    /Approve tool use/i,
    /Tool requires approval/i,
    // Gemini CLI patterns
    /Execute this command\?/i,
    /Allow execution\?/i,
    /Confirm action/i,
    // Codex / Copilot patterns
    /approve this action/i,
    /confirm execution/i,
    /allow this change/i,
    // Amp / Cursor patterns
    /accept this change\?/i,
    /apply changes\?/i,
    /proceed with changes\?/i,
    // Generic patterns — require question mark or terminal prompt context
    // to reduce false positives from normal agent conversation
    /Do you want to .+\?/i,
    /Should I .+\?/i,
    /Is it okay to .+\?/i,
    /Would you like to .+\?/i,
    // "Can I" only when followed by action verbs (run, execute, delete, modify, write, create, install, update, remove)
    // Avoids false positives like "Can I use React?" or "Can I refactor this?"
    /Can I (?:run|execute|delete|modify|write|create|install|update|remove|overwrite) .+\?/i,
];
/**
 * Command extraction patterns
 * Try to extract the command being requested for approval
 */
const COMMAND_EXTRACT_PATTERNS = [
    // "I'd like to run: npm install express"
    /I'd like to run:\s*(.+?)(?:\n|$)/i,
    // "Run `npm install`? (Y)es"
    /Run [`'](.+?)[`']\?/i,
    // "Execute: git push origin main"
    /Execute:\s*(.+?)(?:\n|$)/i,
    // "I need to execute: rm -rf node_modules"
    /I need to execute:\s*(.+?)(?:\n|$)/i,
    // Lines starting with $ or > (shell prompt)
    /^\s*[\$>]\s*(.+?)$/m,
    // "Allow edit to <file>"
    /Allow edit to\s+(.+?)(?:\?|$)/i,
    // Command in backticks or quotes
    /[`']([^`']+)[`']\s*\?/i,
];
/**
 * Permission Classifier class
 * Stateless - pure function: agent output in → classification out
 */
export class PermissionClassifier {
    /**
     * Check if agent output contains an approval request
     * @param agentOutput - The agent's output text
     * @returns true if approval pattern detected
     */
    isApprovalRequest(agentOutput) {
        // Only check the last 500 characters (approval patterns appear at the end)
        const tail = agentOutput.slice(-500);
        const detected = APPROVAL_PATTERNS.some(pattern => pattern.test(tail));
        if (detected) {
            log.debug('Approval request detected', { tail: tail.slice(-100) });
        }
        return detected;
    }
    /**
     * Extract the command being requested for approval
     * @param agentOutput - The agent's output text
     * @returns The command string or null if can't extract
     */
    extractCommand(agentOutput) {
        const tail = agentOutput.slice(-500);
        for (const pattern of COMMAND_EXTRACT_PATTERNS) {
            const match = tail.match(pattern);
            if (match && match[1]) {
                const command = match[1].trim();
                log.debug('Extracted command from approval request', { command });
                return command;
            }
        }
        return null;
    }
    /**
     * Classify agent output and return both detection and extracted command
     * @param agentOutput - The agent's output text
     * @returns Object with isApproval and optional command
     */
    classify(agentOutput) {
        const isApproval = this.isApprovalRequest(agentOutput);
        const command = isApproval ? this.extractCommand(agentOutput) : null;
        return { isApproval, command };
    }
}
//# sourceMappingURL=permission-classifier.js.map