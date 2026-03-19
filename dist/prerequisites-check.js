/**
 * OpenSofa - Prerequisites Check
 *
 * Verifies all required and optional dependencies for running OpenSofa.
 * Called from /check command.
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
function checkCommand(name, command, versionFlag) {
    try {
        const output = execSync(`${command} ${versionFlag}`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000
        });
        const version = output.split('\n')[0]?.slice(0, 50) || 'installed';
        return {
            name,
            status: 'ok',
            message: `✅ ${name}: ${version}`,
        };
    }
    catch {
        return {
            name,
            status: 'missing',
            message: `❌ ${name}: Not found`,
        };
    }
}
function checkDirectory(path, name) {
    if (existsSync(path)) {
        return {
            name,
            status: 'ok',
            message: `✅ ${name}: ${path}`,
        };
    }
    return {
        name,
        status: 'warning',
        message: `⚠️ ${name}: Will be created`,
    };
}
/**
 * Run prerequisites check and return formatted message
 */
export async function runPrerequisitesCheck(agentRegistry) {
    const results = [];
    // Check Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    results.push({
        name: 'Node.js',
        status: major >= 18 ? 'ok' : 'missing',
        message: major >= 18
            ? `✅ Node.js: ${nodeVersion}`
            : `❌ Node.js: ${nodeVersion} (requires 18+)`,
    });
    // Check core tools
    results.push(checkCommand('git', 'git', '--version'));
    results.push(checkCommand('tmux', 'tmux', '-V'));
    results.push(checkCommand('AgentAPI', 'agentapi', '--version'));
    // Check coding agents
    const agents = agentRegistry.discoverInstalled();
    const allAgents = agentRegistry.getAllDefinitions();
    for (const def of allAgents) {
        const installed = agents.includes(def.type);
        results.push({
            name: def.displayName,
            status: installed ? 'ok' : 'warning',
            message: installed
                ? `✅ ${def.displayName}: installed`
                : `⬚ ${def.displayName}: not installed`,
        });
    }
    // Check config
    const configDir = join(homedir(), '.opensofa');
    results.push(checkDirectory(configDir, 'Config directory'));
    // Build message
    const lines = ['🔍 *Prerequisites Check*\n'];
    lines.push('*Core Requirements:*');
    for (const r of results.filter(r => ['Node.js', 'git', 'tmux', 'AgentAPI'].includes(r.name))) {
        lines.push(r.message);
    }
    lines.push('\n*Agents:*');
    for (const r of results.filter(r => !['Node.js', 'git', 'tmux', 'AgentAPI', 'Config directory'].includes(r.name))) {
        lines.push(r.message);
    }
    lines.push('\n*Config:*');
    for (const r of results.filter(r => r.name === 'Config directory')) {
        lines.push(r.message);
    }
    // Summary
    const ok = results.filter(r => r.status === 'ok').length;
    const missing = results.filter(r => r.status === 'missing').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    lines.push(`\n📊 Summary: ${ok} ✅ | ${warnings} ⚠️ | ${missing} ❌`);
    if (missing > 0) {
        lines.push('\n❌ Install missing requirements before using OpenSofa.');
    }
    else if (agents.length === 0) {
        lines.push('\n⚠️ Install at least one coding agent (claude, aider, etc.)');
    }
    else {
        lines.push('\n✅ All prerequisites satisfied!');
    }
    return lines.join('\n');
}
//# sourceMappingURL=prerequisites-check.js.map