/**
 * OpenSofa - Session Wizard
 *
 * Interactive step-by-step session creation flow for WhatsApp.
 * Guides the user through agent selection, directory picking, and naming
 * instead of requiring a single complex command.
 */
import fs from 'fs';
import path from 'path';
import { expandPath } from './utils/expand-path.js';
import { createLogger } from './utils/logger.js';
const log = createLogger('wizard');
const WIZARD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
// ──────────────────────────────────────
// Session Wizard
// ──────────────────────────────────────
export class SessionWizard {
    state = null;
    config;
    agentRegistry;
    constructor(config, agentRegistry) {
        this.config = config;
        this.agentRegistry = agentRegistry;
    }
    get isActive() {
        if (!this.state)
            return false;
        // Auto-timeout after 5 minutes
        if (Date.now() - this.state.createdAt > WIZARD_TIMEOUT_MS) {
            log.debug('Wizard timed out');
            this.state = null;
            return false;
        }
        return true;
    }
    /**
     * Start the wizard. Returns the first message to send.
     */
    start() {
        const installed = this.agentRegistry.discoverInstalled();
        const agents = installed.map((type, i) => {
            const def = this.agentRegistry.getDefinition(type);
            return { type, displayName: def.displayName, index: i + 1 };
        });
        if (agents.length === 0) {
            return '❌ No coding agents found on this machine.\nInstall one first (e.g. claude, opencode, aider).\nRun /agents to see the full list.';
        }
        const dirs = this.discoverGitRepos();
        this.state = {
            step: 'agent',
            agents,
            directories: dirs,
            createdAt: Date.now(),
        };
        log.info('Wizard started', { agentCount: agents.length, dirCount: dirs.length });
        const lines = ['🔧 *New Session Wizard*', '', '*Step 1: Pick an agent:*'];
        for (const a of agents) {
            lines.push(`${a.index}. ${a.displayName} (\`${a.type}\`)`);
        }
        lines.push('', 'Reply with a number or agent name.');
        lines.push('Send /cancel to abort.');
        return lines.join('\n');
    }
    /**
     * Handle a user reply while wizard is active.
     * Returns a message to continue the wizard, or a create result to finish.
     * Returns null if wizard is not active.
     */
    handleReply(text) {
        if (!this.isActive || !this.state)
            return null;
        const trimmed = text.trim();
        switch (this.state.step) {
            case 'agent':
                return this.handleAgentStep(trimmed);
            case 'directory':
                return this.handleDirectoryStep(trimmed);
            case 'browse':
                return this.handleBrowseStep(trimmed);
            case 'name':
                return this.handleNameStep(trimmed);
            default:
                return null;
        }
    }
    /**
     * Cancel the wizard. Returns confirmation message.
     */
    cancel() {
        this.state = null;
        return '❌ Session wizard cancelled.';
    }
    // ──────────────────────────────────────
    // Step handlers
    // ──────────────────────────────────────
    handleAgentStep(text) {
        const num = parseInt(text, 10);
        let selected;
        if (!isNaN(num) && num >= 1 && num <= this.state.agents.length) {
            selected = this.state.agents[num - 1];
        }
        else {
            // Try matching by type or display name
            const lower = text.toLowerCase();
            selected = this.state.agents.find(a => a.type === lower || a.displayName.toLowerCase() === lower);
        }
        if (!selected) {
            return {
                type: 'message',
                text: `❌ Invalid choice. Reply with a number (1-${this.state.agents.length}) or an agent name.`,
            };
        }
        this.state.agent = selected.type;
        this.state.step = 'directory';
        log.debug('Wizard: agent selected', { agent: selected.type });
        return { type: 'message', text: this.buildDirectoryPrompt() };
    }
    buildDirectoryPrompt() {
        const home = expandPath('~');
        const cwd = process.cwd();
        const lines = ['📂 *Step 2: Pick a project directory:*', ''];
        // Add current directory as first option if it's a git repo
        const isCwdGitRepo = fs.existsSync(path.join(cwd, '.git'));
        if (isCwdGitRepo) {
            const cwdDisplay = cwd.replace(home, '~');
            lines.push(`📍 Current directory:`);
            lines.push(`   ${cwdDisplay}`);
            lines.push('');
        }
        if (this.state.directories.length > 0) {
            lines.push(`📁 Discovered repos:`);
            for (let i = 0; i < this.state.directories.length; i++) {
                const dir = this.state.directories[i];
                // Skip if it's the same as cwd (already shown above)
                if (dir === cwd)
                    continue;
                const display = dir.replace(home, '~');
                lines.push(`   ${i + 1}. ${display}`);
            }
            lines.push('');
        }
        else if (!isCwdGitRepo) {
            lines.push('_(No git repos found)_');
            lines.push('');
        }
        lines.push('Reply with:');
        lines.push('• `.` or `here` — use current directory');
        lines.push('• A number — select from list');
        lines.push('• A full path — e.g. `~/projects/myapp`');
        lines.push('• `browse <path>` — explore directories');
        lines.push('Send /cancel to abort.');
        return lines.join('\n');
    }
    handleDirectoryStep(text) {
        const lowerText = text.toLowerCase();
        // Check for "here" or "." - use current directory
        if (lowerText === 'here' || lowerText === '.') {
            const cwd = process.cwd();
            if (fs.existsSync(path.join(cwd, '.git'))) {
                return this.selectDirectory(cwd);
            }
            else {
                return {
                    type: 'message',
                    text: `❌ Current directory is not a git repo.\n\nInitialize with \`git init\` first, or select another directory.`,
                };
            }
        }
        // Check for browse command
        if (lowerText.startsWith('browse')) {
            const browsePath = text.slice(6).trim() || '~';
            return this.browseDirectory(browsePath);
        }
        // Check for number selection
        const num = parseInt(text, 10);
        if (!isNaN(num) && num >= 1 && num <= this.state.directories.length) {
            const dir = this.state.directories[num - 1];
            return this.selectDirectory(dir);
        }
        // Try as a direct path
        const expanded = expandPath(text);
        if (fs.existsSync(expanded) && fs.statSync(expanded).isDirectory()) {
            return this.selectDirectory(expanded);
        }
        return {
            type: 'message',
            text: `❌ Directory not found: ${text}\n\nType \`here\` for current dir, a valid path, or use \`browse <path>\` to explore.`,
        };
    }
    browseDirectory(inputPath) {
        const expanded = expandPath(inputPath);
        const home = expandPath('~');
        if (!fs.existsSync(expanded)) {
            return { type: 'message', text: `❌ Path not found: ${inputPath}` };
        }
        if (!fs.statSync(expanded).isDirectory()) {
            return { type: 'message', text: `❌ Not a directory: ${inputPath}` };
        }
        try {
            const entries = fs.readdirSync(expanded, { withFileTypes: true })
                .filter(e => e.isDirectory() && !e.name.startsWith('.'))
                .sort((a, b) => a.name.localeCompare(b.name))
                .slice(0, 20); // Cap at 20
            if (entries.length === 0) {
                return { type: 'message', text: `📂 ${inputPath} has no subdirectories.\n\nType a path directly.` };
            }
            // Store browse results as selectable options
            const browseDirs = entries.map(e => path.join(expanded, e.name));
            this.state.directories = browseDirs;
            this.state.step = 'browse';
            this.state.browsePath = expanded;
            const display = expanded.replace(home, '~');
            const lines = [`📂 *${display}:*`, ''];
            entries.forEach((e, i) => {
                const fullPath = path.join(expanded, e.name);
                const isGit = fs.existsSync(path.join(fullPath, '.git'));
                const marker = isGit ? ' 📦' : '';
                lines.push(`${i + 1}. ${e.name}${marker}`);
            });
            lines.push('');
            lines.push('📦 = git repo');
            lines.push('');
            lines.push('Reply with a number to select, or:');
            lines.push('• `browse <path>` — explore deeper');
            lines.push('• `use` — use current directory (' + display + ')');
            lines.push('Send /cancel to abort.');
            return { type: 'message', text: lines.join('\n') };
        }
        catch (err) {
            return { type: 'message', text: `❌ Cannot read directory: ${String(err)}` };
        }
    }
    handleBrowseStep(text) {
        // "use" selects the current browse path
        if (text.toLowerCase() === 'use' && this.state.browsePath) {
            return this.selectDirectory(this.state.browsePath);
        }
        // Forward to directory step for number/path/browse handling
        this.state.step = 'directory';
        return this.handleDirectoryStep(text);
    }
    selectDirectory(dir) {
        this.state.dir = dir;
        const home = expandPath('~');
        // Generate suggested name from directory basename
        const basename = path.basename(dir)
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 20);
        this.state.suggestedName = basename || 'session';
        this.state.step = 'name';
        const display = dir.replace(home, '~');
        const isGit = fs.existsSync(path.join(dir, '.git'));
        const gitNote = isGit ? '' : '\n⚠️ Not a git repo — `git init` may be needed.';
        return {
            type: 'message',
            text: `📝 *Step 3: Session name?* (default: \`${this.state.suggestedName}\`)${gitNote}\n\nReply with a name or \`ok\` for default:`,
        };
    }
    handleNameStep(text) {
        const lower = text.toLowerCase();
        const name = (lower === 'ok' || lower === 'y' || lower === 'yes')
            ? this.state.suggestedName
            : text.trim();
        // Validate name
        if (!/^[a-zA-Z0-9-]{1,30}$/.test(name)) {
            return {
                type: 'message',
                text: '❌ Name must be 1-30 characters, alphanumeric + hyphens only.\n\nTry again:',
            };
        }
        const result = {
            type: 'create',
            name,
            dir: this.state.dir,
            agent: this.state.agent,
            model: '',
        };
        log.info('Wizard completed', { name, dir: this.state.dir, agent: this.state.agent });
        this.state = null;
        return result;
    }
    // ──────────────────────────────────────
    // Directory discovery
    // ──────────────────────────────────────
    /**
     * Discover git repos in configured project directories.
     * Returns absolute paths to directories containing .git.
     */
    discoverGitRepos() {
        const projectDirs = this.config.projectDirs || ['~/development', '~/projects'];
        const repos = [];
        for (const rawDir of projectDirs) {
            const dir = expandPath(rawDir);
            if (!fs.existsSync(dir))
                continue;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory() || entry.name.startsWith('.'))
                        continue;
                    const fullPath = path.join(dir, entry.name);
                    const gitPath = path.join(fullPath, '.git');
                    // Check if it's a git repo
                    if (fs.existsSync(gitPath)) {
                        // Skip worktrees (worktrees have .git as a file, not a directory)
                        try {
                            const stats = fs.statSync(gitPath);
                            if (stats.isFile()) {
                                // This is a worktree, skip it
                                continue;
                            }
                        }
                        catch {
                            continue;
                        }
                        repos.push(fullPath);
                    }
                }
            }
            catch {
                // Skip unreadable directories
            }
        }
        // Deduplicate and cap at 15
        return [...new Set(repos)].slice(0, 15);
    }
}
//# sourceMappingURL=session-wizard.js.map