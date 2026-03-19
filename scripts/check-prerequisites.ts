#!/usr/bin/env node
/**
 * OpenSofa - Prerequisites Checker
 * 
 * Verifies all required and optional dependencies for running OpenSofa.
 * Run with: node scripts/check-prerequisites.js
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface CheckResult {
  name: string;
  status: 'ok' | 'missing' | 'warning';
  version?: string;
  message: string;
  fix?: string;
}

const results: CheckResult[] = [];

function checkCommand(name: string, command: string, versionFlag: string, fix: string): void {
  try {
    const output = execSync(`${command} ${versionFlag}`, { 
      encoding: 'utf-8', 
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000 
    });
    const version = output.split('\n')[0]?.slice(0, 50) || 'installed';
    results.push({
      name,
      status: 'ok',
      version,
      message: `✅ ${name}: ${version}`,
    });
  } catch {
    results.push({
      name,
      status: 'missing',
      message: `❌ ${name}: Not found`,
      fix,
    });
  }
}

function checkNodeVersion(): void {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]!, 10);
  
  if (major >= 18) {
    results.push({
      name: 'Node.js',
      status: 'ok',
      version,
      message: `✅ Node.js: ${version} (requires 18+)`,
    });
  } else {
    results.push({
      name: 'Node.js',
      status: 'missing',
      version,
      message: `❌ Node.js: ${version} (requires 18+)`,
      fix: 'Install Node.js 18 or later from https://nodejs.org',
    });
  }
}

function checkDirectory(path: string, name: string, create?: string): void {
  if (existsSync(path)) {
    results.push({
      name,
      status: 'ok',
      message: `✅ ${name}: ${path}`,
    });
  } else if (create) {
    results.push({
      name,
      status: 'warning',
      message: `⚠️ ${name}: Will be created at ${path}`,
    });
  } else {
    results.push({
      name,
      status: 'missing',
      message: `❌ ${name}: Not found at ${path}`,
      fix: `Create the directory or configure a different path`,
    });
  }
}

console.log('🔍 OpenSofa Prerequisites Checker\n');
console.log('─'.repeat(50));
console.log('CORE REQUIREMENTS:\n');

// Check Node.js
checkNodeVersion();

// Check core tools
checkCommand('git', 'git', '--version', 'Install from https://git-scm.com');
checkCommand('tmux', 'tmux', '-V', 'Install with: brew install tmux (mac) or apt install tmux (linux)');
checkCommand('AgentAPI', 'agentapi', '--version', 'Install with: go install github.com/coder/agentapi@latest');

console.log('\nCODING AGENTS:\n');

// Check coding agents
const agents = [
  { name: 'Claude Code', cmd: 'claude', flag: '--version', fix: 'Install from https://claude.ai/code' },
  { name: 'OpenCode', cmd: 'opencode', flag: '--version', fix: 'Install from https://github.com/opencode-ai/opencode' },
  { name: 'Aider', cmd: 'aider', flag: '--version', fix: 'Install with: pip install aider-chat' },
  { name: 'Codex', cmd: 'codex', flag: '--version', fix: 'Install from OpenAI' },
  { name: 'Gemini', cmd: 'gemini', flag: '--version', fix: 'Install from Google' },
  { name: 'Goose', cmd: 'goose', flag: 'version', fix: 'Install from Block Goose' },
];

let hasAgent = false;
for (const agent of agents) {
  try {
    const output = execSync(`${agent.cmd} ${agent.flag}`, { 
      encoding: 'utf-8', 
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      env: { ...process.env, PATH: `${process.env.PATH}:${homedir()}/.opencode/bin` }
    });
    hasAgent = true;
    results.push({
      name: agent.name,
      status: 'ok',
      version: output.split('\n')[0]?.slice(0, 30),
      message: `✅ ${agent.name}: installed`,
    });
  } catch {
    results.push({
      name: agent.name,
      status: 'warning',
      message: `⬚ ${agent.name}: not installed`,
      fix: agent.fix,
    });
  }
}

console.log('\nCONFIGURATION:\n');

// Check config directory
const configDir = join(homedir(), '.opensofa');
checkDirectory(configDir, 'Config directory', 'auto-created');

// Check auth directory
const authDir = join(configDir, 'auth');
checkDirectory(authDir, 'Auth directory', 'auto-created');

// Check VAPID keys
const vapidPath = join(configDir, 'vapid-keys.json');
if (existsSync(vapidPath)) {
  results.push({
    name: 'VAPID Keys',
    status: 'ok',
    message: '✅ VAPID Keys: configured (Web Push ready)',
  });
} else {
  results.push({
    name: 'VAPID Keys',
    status: 'warning',
    message: '⚠️ VAPID Keys: Will be auto-generated on first run',
  });
}

console.log('\n' + '─'.repeat(50));
console.log('RESULTS:\n');

// Print all results
for (const r of results) {
  console.log(r.message);
  if (r.fix && (r.status === 'missing' || r.status === 'warning')) {
    console.log(`   → ${r.fix}`);
  }
}

console.log('\n' + '─'.repeat(50));

// Summary
const ok = results.filter(r => r.status === 'ok').length;
const missing = results.filter(r => r.status === 'missing').length;
const warnings = results.filter(r => r.status === 'warning').length;

console.log(`\n📊 Summary: ${ok} passed, ${warnings} warnings, ${missing} missing\n`);

if (missing > 0) {
  console.log('❌ Some required dependencies are missing. Please install them before running OpenSofa.\n');
  process.exit(1);
}

if (!hasAgent) {
  console.log('⚠️ No coding agents found. Install at least one agent (claude, aider, etc.)\n');
  process.exit(1);
}

console.log('✅ All prerequisites satisfied! You can run OpenSofa with: npm start\n');
process.exit(0);
