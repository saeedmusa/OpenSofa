/**
 * OpenSofa - Command Parser
 *
 * Parses / prefixed commands using regex pattern matching.
 * Zero LLM cost - pure regex-based parsing.
 * Based on LOW_LEVEL_DESIGN.md §6
 */
/**
 * Control plane command patterns (direct chat)
 * Order matters: more specific patterns first
 */
const CONTROL_PATTERNS = [
    // /stop all - must be before /stop <name>
    {
        regex: /^\/stop\s+all$/i,
        parse: () => ({ cmd: 'stop_all' }),
    },
    // /new <name> <dir> [agent] [model]
    {
        regex: /^\/new\s+(\S+)\s+(\S+)(?:\s+(\S+))?(?:\s+(\S+))?$/i,
        parse: (match, defaultAgent) => ({
            cmd: 'new',
            name: match[1],
            dir: match[2],
            agent: match[3] ?? defaultAgent,
            model: match[4] ?? '',
        }),
    },
    // /stop <name>
    {
        regex: /^\/stop\s+(\S+)$/i,
        parse: (match) => ({
            cmd: 'stop',
            name: match[1],
        }),
    },
    // /list
    {
        regex: /^\/list$/i,
        parse: () => ({ cmd: 'list' }),
    },
    // /status [name]
    {
        regex: /^\/status(?:\s+(\S+))?$/i,
        parse: (match) => ({
            cmd: 'status',
            name: match[1] || undefined,
        }),
    },
    // /restart <name>
    {
        regex: /^\/restart\s+(\S+)$/i,
        parse: (match) => ({
            cmd: 'restart',
            name: match[1],
        }),
    },
    // /set <session> <key> [value]  — value is optional (e.g. "/set frontend autoyes" enables it)
    {
        regex: /^\/set\s+(\S+)\s+(\S+)(?:\s+(.+))?$/i,
        parse: (match) => ({
            cmd: 'set',
            name: match[1],
            key: match[2],
            value: match[3]?.trim() ?? '',
        }),
    },
    // /new (bare — start wizard)
    {
        regex: /^\/new$/i,
        parse: () => ({ cmd: 'new_wizard' }),
    },
    // /cancel (cancel active wizard)
    {
        regex: /^\/cancel$/i,
        parse: () => ({ cmd: 'cancel' }),
    },
    // /agents
    {
        regex: /^\/agents$/i,
        parse: () => ({ cmd: 'agents' }),
    },
    // /web - show web interface info + QR code
    {
        regex: /^\/web$/i,
        parse: () => ({ cmd: 'web' }),
    },
    // /check - verify prerequisites
    {
        regex: /^\/check$/i,
        parse: () => ({ cmd: 'check' }),
    },
    // /help
    {
        regex: /^\/help$/i,
        parse: () => ({ cmd: 'help' }),
    },
];
/**
 * Session command patterns (group chat)
 */
const SESSION_PATTERNS = [
    { regex: /^\/stop$/i, parse: () => ({ cmd: 'stop' }) },
    { regex: /^\/approve$/i, parse: () => ({ cmd: 'approve' }) },
    { regex: /^\/reject$/i, parse: () => ({ cmd: 'reject' }) },
    { regex: /^\/rollback$/i, parse: () => ({ cmd: 'rollback' }) },
    { regex: /^\/screenshot$/i, parse: () => ({ cmd: 'screenshot' }) },
    { regex: /^\/full$/i, parse: () => ({ cmd: 'full' }) },
    { regex: /^\/help$/i, parse: () => ({ cmd: 'help' }) },
];
/**
 * Command Parser class
 * Stateless - pure function: string in → parsed command out
 */
export class CommandParser {
    defaultAgent;
    constructor(defaultAgent) {
        this.defaultAgent = defaultAgent;
    }
    /**
     * Parse a control plane command from direct chat
     * @param text - The message text to parse
     * @returns Parsed command or null if not a command
     */
    parseControlCommand(text) {
        const trimmed = text.trim();
        // Must start with /
        if (!trimmed.startsWith('/')) {
            return null;
        }
        // Try each pattern in order
        for (const { regex, parse } of CONTROL_PATTERNS) {
            const match = trimmed.match(regex);
            if (match) {
                return parse(match, this.defaultAgent);
            }
        }
        // Unknown command - return null, caller should send help message
        return null;
    }
    /**
     * Parse a session command from group chat
     * @param text - The message text to parse
     * @returns Parsed command or null if not a command
     */
    parseSessionCommand(text) {
        const trimmed = text.trim();
        // Must start with /
        if (!trimmed.startsWith('/')) {
            return null;
        }
        // Try each pattern in order
        for (const { regex, parse } of SESSION_PATTERNS) {
            const match = trimmed.match(regex);
            if (match) {
                return parse();
            }
        }
        // Unknown command - return null
        return null;
    }
    /**
     * Get help text for control plane commands
     */
    getHelpText() {
        return `*OpenSofa Commands*

 👋 *Quick Start:*
1. Create a session via the web interface or /new command
2. Send coding tasks in the session panel
3. Monitor agent output live in the browser

*Session Management:*
/new — Start interactive wizard (recommended)
/new <name> <dir> [agent] — Quick create
  Example: /new frontend ~/myapp claude

/agents — List installed coding agents
/check — Verify all prerequisites are installed
/web — Open web interface

/list — Show all active sessions
/status [name] — Show session status
/stop <name> — Stop a session
/stop all — Stop all sessions
/restart <name> — Restart a crashed session

/set <name> agent <agent> — Switch coding agent
/set <name> autoyes — Toggle auto-approve
/set <name> screenshots — Toggle screenshots

/help — Show this help

*In Session:*
Just type your coding task!
/approve — Approve pending action
/reject — Reject pending action
/stop — Emergency stop (Ctrl+C)
/rollback — Undo uncommitted changes
/screenshot — Take a terminal screenshot
/full — Show full terminal output
/help — Show commands`;
    }
    /**
     * Get help text for session commands only
     */
    getSessionHelpText() {
        return `*Session Commands*
/stop — Emergency Ctrl+C (session stays active)
/approve — Approve pending action
/reject — Reject pending action
/rollback — Revert uncommitted changes
/screenshot — Take a terminal screenshot
/full — Show full output (if truncated)
/help — Show this help`;
    }
}
/**
 * Check if text starts with / (potential command)
 */
export function isCommand(text) {
    return text.trim().startsWith('/');
}
//# sourceMappingURL=command-parser.js.map