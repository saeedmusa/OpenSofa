/**
 * OpenSofa - Session Manager
 * 
 * Central orchestrator - manages session lifecycle.
 * Web-only architecture: all user-facing notifications go through
 * the SSE broadcaster and Web Push.
 * Based on LOW_LEVEL_DESIGN.md §7
 */

import { EventEmitter } from 'events';
import { spawn, execSync, execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { createLogger } from './utils/logger.js';
import { expandPath, getEnrichedEnv, getEnrichedPath } from './utils/expand-path.js';
import { sleep } from './utils/sleep.js';
import { safeGitExec, safeTmuxExec, isSafePath, isSafeFilename } from './utils/safe-shell.js';
import type { 
  OpenSofaConfig, 
  Session, 
  SessionStatus,
  AgentType,
  ControlCommand,
  SessionCommand,
  PersistedSession,
  FeedbackEvent,
  ResourceStats
} from './types.js';
import { AgentAPIClient, AgentAPIError } from './agentapi-client.js';
import { FeedbackController } from './feedback-controller.js';
import { AgentStateMachine } from './agent-state-machine.js';
import { AgentRegistry } from './agent-registry.js';
import { ResourceMonitor } from './resource-monitor.js';
import { ScreenshotService } from './screenshot-service.js';
import { globalMessageQueue } from './message-queue.js';
import type { Notifier } from './web/notifier.js';

const log = createLogger('session');

/**
 * Session Manager class
 * Owns the session Map - central orchestrator
 */
function agentClient(port: number): AgentAPIClient {
  return new AgentAPIClient(port);
}
export class SessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();   // key: session name
  private usedPorts: Set<number> = new Set();
  private startupProcesses: Map<number, import('child_process').ChildProcess> = new Map();
  private creatingSessions: Set<string> = new Set();  // guards against duplicate in-flight creates
  
  private config: OpenSofaConfig;
  private classifier: AgentStateMachine;
  private agentRegistry: AgentRegistry;
  private resourceMonitor: ResourceMonitor | null = null;
  private screenshotService: ScreenshotService | null = null;
  private notifier: Notifier | null = null;
  private onStateChanged: (() => Promise<void>) | null = null;
  private webUrlProvider: (() => Promise<string | null>) | null = null;

  constructor(
    config: OpenSofaConfig,
    classifier: AgentStateMachine,
    agentRegistry: AgentRegistry,
  ) {
    super();
    this.config = config;
    this.classifier = classifier;
    this.agentRegistry = agentRegistry;
    
    // Set up message queue sender
    globalMessageQueue.setSender(async (msg) => {
      const session = this.sessions.get(msg.sessionName);
      if (!session) {
        throw new Error(`Session ${msg.sessionName} not found`);
      }
      
      if (msg.type === 'user_message') {
        await this.sendToAgentInternal(session, msg.content);
      } else if (msg.type === 'approval_response') {
        if (msg.metadata?.isApproval) {
          await this.sendApproval(session, 'yes');
        } else {
          await this.sendApproval(session, 'no');
        }
      }
    });
  }

  private groupBadge(session: { name: string; agentType: string; branch: string }): string {
    return `[${session.name} | ${session.agentType} | ${session.branch}]`;
  }

  private isToggleEnabled(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized !== 'off' && normalized !== 'false' && normalized !== 'no' && normalized !== '0';
  }

  private parseAgentSwitchValue(value: string):
    | { ok: true; agent: AgentType; model: string }
    | { ok: false; error: string } {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        ok: false,
        error: "Usage: /set <session> agent <agent> [model]. Example: /set frontend agent opencode",
      };
    }

    const [agentRaw, ...modelParts] = trimmed.split(/\s+/);
    if (!agentRaw || !this.agentRegistry.isValidType(agentRaw)) {
      return {
        ok: false,
        error: `Unknown agent '${agentRaw || ''}'. Send /agents to see valid options.`,
      };
    }

    return {
      ok: true,
      agent: agentRaw,
      model: modelParts.join(' ').trim(),
    };
  }

  private buildUploadPrompt(filePath: string, caption: string): string {
    if (caption) {
      return `I've uploaded a file to ${filePath}. ${caption}`;
    }
    return `I've uploaded a file to ${filePath}. Please inspect it and continue.`;
  }

  private writeUploadFallback(workDir: string, fileName: string, buffer: Buffer): string {
    const base = path.basename(fileName);
    const fallbackName = `${Date.now()}-${base}`;
    const destination = path.join(workDir, fallbackName);
    fs.writeFileSync(destination, buffer);
    return `./${fallbackName}`;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private extensionFromMime(mimetype: string): string {
    const lower = mimetype.toLowerCase();
    if (lower.includes('png')) return 'png';
    if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
    if (lower.includes('gif')) return 'gif';
    if (lower.includes('pdf')) return 'pdf';
    if (lower.includes('json')) return 'json';
    if (lower.includes('text')) return 'txt';
    return 'bin';
  }

  private validateRepoDirectory(dir: string): { ok: true; expandedDir: string } | { ok: false; error: string } {
    const expandedDir = expandPath(dir);
    if (!fs.existsSync(expandedDir)) {
      return { ok: false, error: `Directory not found: ${dir}` };
    }

    try {
      safeGitExec(expandedDir, ['rev-parse', '--git-dir'], 5000);
    } catch {
      return {
        ok: false,
        error: `Directory is not a git repository: ${dir}. Initialize with 'git init' first.`,
      };
    }

    // Check if this is a worktree (git worktrees have .git as a file, not a directory)
    try {
      const gitPath = path.join(expandedDir, '.git');
      const stats = fs.statSync(gitPath);
      if (stats.isFile()) {
        const gitDirOutput = safeGitExec(expandedDir, ['rev-parse', '--git-common-dir'], 5000).trim();
        
        if (gitDirOutput && !gitDirOutput.includes('worktrees')) {
          const mainRepo = path.dirname(gitDirOutput);
          if (fs.existsSync(mainRepo)) {
            log.info('Detected worktree, using main repo', { worktree: expandedDir, mainRepo });
            return { ok: true, expandedDir: mainRepo };
          }
        } else if (gitDirOutput.includes('worktrees')) {
          const mainRepo = path.normalize(path.join(expandedDir, gitDirOutput.replace('/.git/worktrees/' + path.basename(expandedDir), '')));
          if (fs.existsSync(mainRepo) && mainRepo !== expandedDir) {
            log.info('Detected worktree (new format), using main repo', { worktree: expandedDir, mainRepo });
            return { ok: true, expandedDir: mainRepo };
          }
        }
        
        log.info('Using worktree directly', { dir: expandedDir });
      }
    } catch (err) {
      log.debug('Could not check worktree status', { error: String(err) });
    }

    return { ok: true, expandedDir };
  }

  /**
   * Group-level emergency stop (Ctrl+C only). Session remains active.
   */
  private async emergencyStop(session: Session): Promise<void> {
    try {
      const client = agentClient(session.port);
      await client.sendRaw('\x03');

      await sleep(2000);

      try {
        const status = await client.getStatus();
        session.agentStatus = status.status;

        if (status.status === 'running') {
          await client.sendRaw('\x03');
        }
      } catch {
        // Best effort status probe only.
      }

      this.clearPendingApproval(session);
      session.agentStatus = 'stable';
      this.requestStateSave('emergencyStop');

      log.info('Emergency stop completed', { session: session.name });
      this.emit('session:updated', session);
    } catch (err) {
      log.error('Emergency stop failed', { session: session.name, error: String(err) });
    }
  }

  /**
   * Set the resource monitor (called from main.ts after initialization)
   */
  setResourceMonitor(monitor: ResourceMonitor): void {
    this.resourceMonitor = monitor;
  }

  /**
   * Register a persistence hook to be called on important state transitions.
   */
  setStateChangeHook(hook: () => Promise<void>): void {
    this.onStateChanged = hook;
  }

  public setNotifier(notifier: Notifier): void {
    this.notifier = notifier;
  }

  setScreenshotService(service: ScreenshotService): void {
    this.screenshotService = service;
  }

  /**
   * Set a provider function that returns the current web interface URL.
   */
  setWebUrlProvider(provider: () => Promise<string | null>): void {
    this.webUrlProvider = provider;
  }

  /**
   * Disconnect runtime session objects (SSE connections) without deleting session metadata.
   */
  disconnectAllRuntime(): void {
    for (const session of this.sessions.values()) {
      this.clearRuntime(session);
    }
  }

  /**
   * Create a new coding session
   */
  async createSession(name: string, dir: string, agent: AgentType, model: string = ''): Promise<void> {
    log.info(`Creating session: ${name}`, { dir, agent, model });

    // 1. Quick pre-checks
    if (this.sessions.has(name)) {
      log.warn(`Session '${name}' already exists`);
      throw new Error(`Session '${name}' already exists`);
    }
    if (this.creatingSessions.has(name)) {
      log.warn(`Session '${name}' is already being created`);
      throw new Error(`Session '${name}' is already being created`);
    }
    // Check session limits
    if (this.resourceMonitor) {
      const resourceCheck = this.resourceMonitor.canCreateSession(this.sessions.size);
      if (!resourceCheck.ok) {
        throw new Error(`Cannot create session: ${resourceCheck.reason}`);
      }
    } else {
      if (this.sessions.size >= this.config.maxSessions) {
        throw new Error(`Max sessions (${this.config.maxSessions}) reached`);
      }
    }

    // Guard: mark session as in-flight to prevent duplicate creates
    this.creatingSessions.add(name);

    // Create placeholder session entry immediately so frontend can poll for status
    const placeholderSession: Session = {
      name,
      status: 'creating',
      agentType: agent,
      model,
      port: 0,
      pid: 0,
      repoDir: '',
      workDir: '',
      branch: '',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      agentStatus: 'running',
      feedbackController: null,
      autoApprove: this.config.autoApprove,
      screenshotsEnabled: true,
    };
    this.sessions.set(name, placeholderSession);

    // 2. Validate inputs
    const validation = this.validateSessionInput(name, dir);
    if (!validation.ok) {
      this.creatingSessions.delete(name);
      this.sessions.delete(name);
      throw new Error(validation.error!);
    }

    // 3. Create git worktree
    let workDir: string;
    let branch: string;
    try {
      const worktree = this.createWorktree(dir, name);
      workDir = worktree.workDir;
      branch = worktree.branch;
    } catch (err) {
      const error = err as Error;
      log.error('Failed to create worktree', { error: error.message });
      this.creatingSessions.delete(name);
      this.sessions.delete(name);
      throw new Error(`Failed to create worktree: ${error.message}`);
    }

    // 4. Allocate port
    const port = this.allocatePort();
    const startupTimeoutMs = this.getStartupTimeoutMs(agent);

    // 5. Spawn AgentAPI
    let pid: number;
    try {
      pid = await this.spawnAgentAPI(port, agent, model, workDir);
    } catch (err) {
      const error = err as Error;
      log.error('Failed to spawn AgentAPI', { error: error.message });
      this.creatingSessions.delete(name);
      this.sessions.delete(name);
      this.releasePort(port);
      this.removeWorktree(dir, workDir);
      throw new Error(`Failed to start AgentAPI: ${error.message}`);
    }

    // 6. Health check
    try {
      await this.healthCheck(port, startupTimeoutMs);
    } catch (err) {
      log.error('AgentAPI health check failed', { error: String(err) });
      this.creatingSessions.delete(name);
      this.sessions.delete(name);
      this.killProcess(pid);
      this.releasePort(port);
      this.removeWorktree(dir, workDir);
      throw new Error(`Session '${name}' failed to start — ${agent} didn't respond within ${Math.round(startupTimeoutMs / 1000)}s.`);
    }

    // 7. Create session object
    const session: Session = {
      name,
      status: 'active',
      agentType: agent,
      model,
      port,
      pid,
      repoDir: expandPath(dir),
      workDir,
      branch,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      agentStatus: 'stable',
      feedbackController: null,
      autoApprove: this.config.autoApprove,
      screenshotsEnabled: true,
      pendingApproval: undefined,
    };

    // 8. Initialize FeedbackController (SSE connection)
    this.attachRuntime(session, port);

    // 9. Store session
    this.sessions.set(name, session);
    this.creatingSessions.delete(name);
    this.requestStateSave('createSession');

    log.info(`Session created: ${name}`, { port, workDir });
    this.emit('session:created', session);
  }

  /**
   * Validate session input
   */
  private validateSessionInput(name: string, dir: string): { ok: boolean; error?: string } {
    if (!/^[a-zA-Z0-9-]{1,30}$/.test(name)) {
      return { 
        ok: false, 
        error: 'Session name must be 1-30 characters (letters, numbers, hyphens only)' 
      };
    }

    const dirValidation = this.validateRepoDirectory(dir);
    if (!dirValidation.ok) {
      return { ok: false, error: dirValidation.error };
    }

    return { ok: true };
  }

  /**
   * Create git worktree
   */
  private createWorktree(repoDir: string, sessionName: string): { workDir: string; branch: string } {
    const expandedDir = expandPath(repoDir);
    const repoBasename = path.basename(expandedDir);
    const parentDir = path.dirname(expandedDir);
    const workDir = path.join(parentDir, `${repoBasename}-${sessionName}`);
    const branch = `feat/${sessionName}`;

    try {
      safeGitExec(expandedDir, ['worktree', 'prune'], 10000);
    } catch {
      // Not fatal
    }

    if (fs.existsSync(workDir)) {
      log.info('Cleaning up stale worktree directory', { workDir });
      try {
        safeGitExec(expandedDir, ['worktree', 'remove', workDir, '--force'], 10000);
      } catch {
        try {
          fs.rmSync(workDir, { recursive: true, force: true });
          safeGitExec(expandedDir, ['worktree', 'prune'], 10000);
        } catch {
          throw new Error(
            `Worktree directory already exists and could not be cleaned up: ${workDir}\n` +
            `Remove it manually: rm -rf "${workDir}" && git -C "${expandedDir}" worktree prune`
          );
        }
      }
    }

    try {
      safeGitExec(expandedDir, ['worktree', 'add', workDir, '-b', branch], 30000);
    } catch (err) {
      throw new Error(`Failed to create worktree: ${String(err)}`);
    }

    return { workDir, branch };
  }

  /**
   * Remove git worktree
   */
  private removeWorktree(repoDir: string, workDir: string): void {
    try {
      safeGitExec(expandPath(repoDir), ['worktree', 'remove', workDir, '--force'], 10000);
    } catch {
      // Not fatal
    }
  }

  /**
   * Allocate next available port
   */
  private allocatePort(): number {
    const maxPort = this.config.portRangeStart + 10000; // Reasonable max to prevent infinite loop
    let port = this.config.portRangeStart;
    while (this.usedPorts.has(port)) {
      port++;
      if (port > maxPort) {
        throw new Error(`No available ports - exhausted range ${this.config.portRangeStart}-${maxPort}`);
      }
    }
    this.usedPorts.add(port);
    return port;
  }

  /**
   * Release a port
   */
  private releasePort(port: number): void {
    this.usedPorts.delete(port);
  }

  /**
   * Spawn AgentAPI process inside tmux for terminal capture
   */
  private async spawnAgentAPI(port: number, agent: AgentType, model: string, workDir: string): Promise<number> {
    if (!this.agentRegistry.isAgentApiInstalled()) {
      throw new Error('agentapi CLI is not installed. Install it with: go install github.com/coder/agentapi@latest');
    }
    if (!this.agentRegistry.isInstalled(agent)) {
      throw new Error(`${agent} CLI is not installed or not on PATH. Install it first, then try again.`);
    }
    
    if (!fs.existsSync(workDir)) {
      throw new Error(`Working directory does not exist: ${workDir}`);
    }

    const tmuxSessionName = `agentapi-${port}`;
    const { args, env: agentEnv } = this.agentRegistry.buildSpawnArgs(agent, port, model || undefined);

    const agentCmd = `agentapi ${args.join(' ')}`;
    
    log.info(`Spawning in tmux session ${tmuxSessionName}: ${agentCmd}`);
    if (Object.keys(agentEnv).length > 0) {
      log.debug('Agent env vars:', agentEnv);
    }

    return new Promise((resolve, reject) => {
      try {
        try {
          safeTmuxExec(['kill-session', '-t', tmuxSessionName], 1000);
        } catch {
          // Session doesn't exist, that's fine
        }

        const tmuxArgs = [
          'new-session',
          '-d',
          '-s', tmuxSessionName,
          '-x', '120',
          '-y', '36',
          '-c', workDir,
        ];

        tmuxArgs.push('-e', `PATH=${getEnrichedPath()}`);
        tmuxArgs.push('-e', 'TERM=screen-256color');
        for (const [key, value] of Object.entries(agentEnv)) {
          tmuxArgs.push('-e', `${key}=${value}`);
        }

        tmuxArgs.push('agentapi', ...args);

        log.debug('tmux args', { args: tmuxArgs.join(' ') });

        const tmux = spawn('tmux', tmuxArgs, {
          cwd: workDir,
          env: getEnrichedEnv(agentEnv),
          stdio: 'pipe',
        });

        let stderrOutput = '';
        tmux.stderr?.on('data', (data) => {
          stderrOutput += data.toString();
        });

        tmux.on('error', (err) => {
          reject(new Error(`Failed to spawn tmux: ${err.message}`));
        });

        setTimeout(() => {
          try {
            const result = safeTmuxExec(['list-sessions', '-F', '#{session_name}'], 5000);
            
            if (result.includes(tmuxSessionName)) {
              try {
                const pidOutput = safeTmuxExec(['list-panes', '-t', tmuxSessionName, '-F', '#{pane_pid}'], 5000);
                const pid = parseInt(pidOutput.trim(), 10);
                if (pid > 0) {
                  log.info(`AgentAPI started in tmux`, { port, tmuxSession: tmuxSessionName, pid });
                  resolve(pid);
                } else {
                  reject(new Error('Failed to get AgentAPI PID from tmux'));
                }
              } catch {
                log.info(`AgentAPI started in tmux (no PID)`, { port, tmuxSession: tmuxSessionName });
                resolve(0);
              }
            } else {
              reject(new Error(`tmux session ${tmuxSessionName} was not created. stderr: ${stderrOutput}`));
            }
          } catch (err) {
            reject(new Error(`Failed to verify tmux session: ${err}`));
          }
        }, 500);
      } catch (err) {
        reject(new Error(`Failed to spawn in tmux: ${err}`));
      }
    });
  }

  /**
   * Health check - poll until AgentAPI is ready
   */
  private getStartupTimeoutMs(agent: AgentType): number {
    switch (agent) {
      case 'opencode':
        return 180_000;
      case 'codex':
      case 'cursor':
      case 'gemini':
        return 120_000;
      default:
        return 60_000;
    }
  }

  private isStartupProcessAlive(port: number): boolean {
    const child = this.startupProcesses.get(port);
    if (!child) return true;
    if (!child.pid) return false;

    try {
      process.kill(child.pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async healthCheck(port: number, timeoutMs: number): Promise<void> {
    try {
      await agentClient(port).waitUntilReady(
        timeoutMs,
        500,
        () => this.isStartupProcessAlive(port),
      );
    } finally {
      this.startupProcesses.delete(port);
    }
  }

  /**
   * Verify a PID belongs to an agent/tmux process before killing.
   * Prevents killing wrong process if PID was reused by OS.
   */
  private verifyProcessOwnership(pid: number): boolean {
    if (!pid || pid === 0) return false;
    try {
      // Check process exists and get command name
      // macOS: ps -p PID -o comm=
      // Linux: ps -p PID -o comm= or /proc/PID/comm
      const comm = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 1000,
      }).trim();
      
      // Allowlist: only kill if it's agentapi, tmux, or known agent binaries
      const allowed = ['agentapi', 'tmux', 'node', 'claude', 'opencode', 'aider', 'goose', 'codex', 'gemini', 'amp', 'copilot', 'cursor', 'auggie', 'amazonq'];
      const isOwned = allowed.some(name => comm.toLowerCase().includes(name));
      
      if (!isOwned) {
        log.warn('PID ownership verification failed - not killing', { pid, comm });
      }
      return isOwned;
    } catch {
      // Process doesn't exist or ps failed
      return false;
    }
  }

  /**
   * Kill a process by PID with ownership verification
   */
  private killProcess(pid: number): void {
    if (!pid || pid === 0) return;
    
    // Verify this is actually our process before killing
    const isOwned = this.verifyProcessOwnership(pid);
    if (!isOwned) {
      log.debug('Skipping kill - PID not owned by agent', { pid });
      return;
    }
    
    try {
      process.kill(pid, 'SIGTERM');
      setTimeout(() => {
        try {
          // Re-verify before SIGKILL in case PID was reused during timeout
          const isStillOwned = this.verifyProcessOwnership(pid);
          if (isStillOwned) {
            process.kill(pid, 'SIGKILL');
          }
        } catch {
          // Already dead
        }
      }, 3000);
    } catch {
      // Already dead
    }
  }

  /**
   * Kill tmux session by name
   */
  private killTmuxSession(port: number): void {
    const sessionName = `agentapi-${port}`;
    try {
      safeTmuxExec(['kill-session', '-t', sessionName], 1000);
      log.debug(`Killed tmux session: ${sessionName}`);
    } catch {
      // Session doesn't exist or already killed
    }
  }

  /**
   * Stop a session
   */
  async stopSession(name: string): Promise<void> {
    const session = this.sessions.get(name);
    if (!session) {
      throw new Error(`Session '${name}' not found`);
    }

    log.info(`Stopping session: ${name}`);
    session.status = 'stopping';

    // 1. Send Ctrl+C via AgentAPI
    try {
      await agentClient(session.port).sendRaw('\x03');
    } catch {
      // May already be stopped
    }

    await sleep(1000);

    // 2. Kill tmux session
    this.killTmuxSession(session.port);

    // 3. Disconnect runtime objects
    this.clearRuntime(session);

    // 4. Fallback: kill process by PID
    this.killProcess(session.pid);

    // 5. Remove git worktree
    this.removeWorktree(session.repoDir, session.workDir);

    // 6. Cleanup state
    this.clearPendingApproval(session);
    this.releasePort(session.port);
    this.sessions.delete(name);
    this.requestStateSave('stopSession');

    log.info(`Session stopped: ${name}`);
    this.emit('session:stopped', { name, port: session.port });
  }

  /**
   * Stop all sessions
   */
  async stopAllSessions(): Promise<void> {
    const names = Array.from(this.sessions.keys());
    for (const name of names) {
      await this.stopSession(name);
    }
  }

  /**
   * Send a message to the agent
   */
  async sendToAgent(session: Session, text: string): Promise<void> {
    session.lastActivityAt = Date.now();
    const client = agentClient(session.port);

    // Guard: if there's a pending approval, the agent is at a [Y/n] prompt.
    if (session.pendingApproval) {
      throw new Error('There\'s a pending approval. Send /approve or /reject first.');
    }

    // If local status says running, verify against the real API before rejecting.
    if (session.agentStatus === 'running') {
      try {
        const liveStatus = await client.getStatus(3000);
        if (liveStatus.status === 'stable') {
          log.debug('Local status was stale (running), agent is actually stable', {
            session: session.name,
          });
          session.agentStatus = 'stable';
        }
      } catch {
        // If we can't reach the API, trust the local status
      }

      if (session.agentStatus === 'running') {
        // Queue the message instead of throwing
        globalMessageQueue.enqueue(session.name, 'user_message', text);
        log.info('Agent busy, message queued', { session: session.name, text: text.slice(0, 50) });
        return;
      }
    }

    // Agent is stable - send directly
    await this.sendToAgentInternal(session, text);
  }
  
  /**
   * Internal method to send a message to the agent
   */
  private async sendToAgentInternal(session: Session, text: string): Promise<void> {
    const client = agentClient(session.port);
    
    try {
      await client.sendUserMessage(text);
      session.lastActivityAt = Date.now();
    } catch (err) {
      const friendlyMsg = err instanceof AgentAPIError && err.userFriendlyMessage
        ? err.userFriendlyMessage
        : `Failed to send message: ${String(err)}`;

      throw new Error(friendlyMsg);
    }
  }

  /**
   * Upload media to a session
   */
  async uploadMedia(session: Session, buffer: Buffer, fileName: string, mimetype: string, caption: string): Promise<void> {
    const maxBytes = 10 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error(`File too large (${Math.round(buffer.length / (1024 * 1024))}MB). Max allowed is 10MB.`);
    }

    if (session.pendingApproval) {
      throw new Error('Can\'t upload while an approval is pending. Send /approve or /reject first.');
    }
    if (session.agentStatus === 'running') {
      throw new Error('Agent is busy. Send the file again once it finishes.');
    }

    const sanitizedName = this.sanitizeFileName(fileName);

    try {
      const result = await agentClient(session.port).uploadFile(buffer, sanitizedName, mimetype);
      const uploadedPath = result.filePath || `./${sanitizedName}`;

      await this.sendToAgent(session, this.buildUploadPrompt(uploadedPath, caption));
    } catch (uploadErr) {
      try {
        const fallbackPath = this.writeUploadFallback(session.workDir, sanitizedName, buffer);
        await this.sendToAgent(session, this.buildUploadPrompt(fallbackPath, caption));
        log.warn('AgentAPI /upload failed, used local fallback', { session: session.name, file: sanitizedName });
      } catch (fallbackErr) {
        throw new Error(`Failed to upload media: ${String(uploadErr)}. Fallback also failed: ${String(fallbackErr)}`);
      }
    }
  }

  /**
   * Handle a session command
   */
  async handleSessionCommand(session: Session, command: SessionCommand): Promise<void> {
    session.lastActivityAt = Date.now();
    switch (command.cmd) {
      case 'stop':
        await this.emergencyStop(session);
        break;

      case 'approve':
        await this.sendApproval(session, 'yes');
        break;

      case 'reject':
        await this.sendApproval(session, 'no');
        break;

      case 'rollback':
        await this.rollback(session);
        break;

      case 'screenshot':
        // Screenshots are now handled via the web UI
        log.info('Screenshot requested via command', { session: session.name });
        break;

      case 'full':
        // Full output is now handled via the web UI
        log.info('Full output requested via command', { session: session.name });
        break;

      case 'help':
        break;
    }
  }

  /**
   * Send approval/rejection to agent
   */
  private async sendApproval(session: Session, response: 'yes' | 'no'): Promise<void> {
    if (!session.pendingApproval) {
      throw new Error('No pending approval request.');
    }

    try {
      await agentClient(session.port).sendRaw(`${response}\n`);
      this.clearPendingApproval(session);
      log.info(`Approval ${response === 'yes' ? 'approved' : 'rejected'}`, { session: session.name });
      this.emit('session:updated', session);
    } catch (err) {
      throw new Error(`Failed to send response: ${String(err)}`);
    }
  }

  /**
   * Rollback uncommitted changes
   */
  private async rollback(session: Session): Promise<void> {
    try {
      safeGitExec(session.workDir, ['checkout', '.'], 10000);
      log.info('Rolled back uncommitted changes', { session: session.name });
      this.emit('session:updated', session);
    } catch (err) {
      throw new Error(`Rollback failed: ${String(err)}`);
    }
  }

  /**
   * Switch session agent
   */
  async switchSessionAgent(session: Session, value: string): Promise<void> {
    const parsed = this.parseAgentSwitchValue(value);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    if (!this.agentRegistry.isInstalled(parsed.agent)) {
      throw new Error(`Agent '${parsed.agent}' is not installed on this machine.`);
    }

    if (session.agentType === parsed.agent && (session.model || '') === (parsed.model || '')) {
      throw new Error(`Already using agent '${parsed.agent}'${parsed.model ? ` (${parsed.model})` : ''}.`);
    }

    const previousAgent = session.agentType;
    const previousModel = session.model;
    const previousPid = session.pid;

    this.clearRuntime(session);
    this.killProcess(previousPid);
    await sleep(1000);

    try {
      const pid = await this.spawnAgentAPI(session.port, parsed.agent, parsed.model, session.workDir);
      await this.healthCheck(session.port, this.getStartupTimeoutMs(parsed.agent));

      session.pid = pid;
      session.agentType = parsed.agent;
      session.model = parsed.model;
      session.status = 'active';
      session.agentStatus = 'stable';
      session.lastActivityAt = Date.now();
      this.clearPendingApproval(session);

      this.attachRuntime(session, session.port);
      this.requestStateSave('setSessionSetting:agent');
      this.emit('session:updated', session);
    } catch (switchErr) {
      try {
        const restorePid = await this.spawnAgentAPI(session.port, previousAgent, previousModel, session.workDir);
        await this.healthCheck(session.port, this.getStartupTimeoutMs(previousAgent));

        session.pid = restorePid;
        session.agentType = previousAgent;
        session.model = previousModel;
        session.status = 'active';
        session.agentStatus = 'stable';
        session.lastActivityAt = Date.now();

        this.attachRuntime(session, session.port);
        this.requestStateSave('setSessionSetting:agent-restore');
        throw new Error(`Failed to switch agent: ${String(switchErr)}. Restored previous agent.`);
      } catch (restoreErr) {
        session.status = 'error';
        this.requestStateSave('setSessionSetting:agent-error');
        throw new Error(`Failed to switch agent: ${String(switchErr)}. Restore also failed: ${String(restoreErr)}. Use /restart ${session.name}.`);
      }
    }
  }

  /**
   * Switch session directory
   */
  async switchSessionDirectory(session: Session, value: string): Promise<void> {
    const targetRaw = value.trim();
    if (!targetRaw) {
      throw new Error(`Usage: /set <session> dir <path>`);
    }

    const expandedTarget = expandPath(targetRaw);
    if (expandedTarget === session.repoDir) {
      throw new Error(`Already using repository: ${expandedTarget}`);
    }

    const validation = this.validateRepoDirectory(targetRaw);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    let newWorktree: { workDir: string; branch: string };
    try {
      newWorktree = this.createWorktree(validation.expandedDir, session.name);
    } catch (err) {
      throw new Error(`Failed to prepare new worktree in ${validation.expandedDir}: ${String(err)}`);
    }

    const previous = {
      repoDir: session.repoDir,
      workDir: session.workDir,
      branch: session.branch,
      pid: session.pid,
      agentType: session.agentType,
      model: session.model,
      port: session.port,
    };

    this.clearRuntime(session);
    this.killProcess(previous.pid);
    await sleep(1000);

    try {
      const pid = await this.spawnAgentAPI(
        previous.port,
        previous.agentType,
        previous.model,
        newWorktree.workDir,
      );
      await this.healthCheck(previous.port, this.getStartupTimeoutMs(previous.agentType));

      session.pid = pid;
      session.repoDir = validation.expandedDir;
      session.workDir = newWorktree.workDir;
      session.branch = newWorktree.branch;
      session.status = 'active';
      session.agentStatus = 'stable';
      session.lastActivityAt = Date.now();
      this.clearPendingApproval(session);

      this.attachRuntime(session, previous.port);
      this.removeWorktree(previous.repoDir, previous.workDir);
      this.requestStateSave('setSessionSetting:dir');
      this.emit('session:updated', session);
    } catch (switchErr) {
      this.removeWorktree(validation.expandedDir, newWorktree.workDir);

      try {
        const restorePid = await this.spawnAgentAPI(
          previous.port,
          previous.agentType,
          previous.model,
          previous.workDir,
        );
        await this.healthCheck(previous.port, this.getStartupTimeoutMs(previous.agentType));

        session.pid = restorePid;
        session.repoDir = previous.repoDir;
        session.workDir = previous.workDir;
        session.branch = previous.branch;
        session.status = 'active';
        session.agentStatus = 'stable';
        session.lastActivityAt = Date.now();

        this.attachRuntime(session, previous.port);
        this.requestStateSave('setSessionSetting:dir-restore');
        throw new Error(`Failed to switch repository: ${String(switchErr)}. Restored previous repository.`);
      } catch (restoreErr) {
        session.status = 'error';
        this.requestStateSave('setSessionSetting:dir-error');
        throw new Error(`Failed to switch repository: ${String(switchErr)}. Restore also failed: ${String(restoreErr)}. Use /restart ${session.name}.`);
      }
    }
  }

  /**
   * Set a session setting
   */
  async setSessionSetting(
    name: string, 
    key: string, 
    value: string, 
  ): Promise<void> {
    const session = this.sessions.get(name);
    if (!session) {
      throw new Error(`Session '${name}' not found.`);
    }

    switch (key) {
      case 'autoyes':
        session.autoApprove = this.isToggleEnabled(value);
        this.requestStateSave('setSessionSetting:autoyes');
        this.emit('session:updated', session);
        break;

      case 'screenshots':
        session.screenshotsEnabled = this.isToggleEnabled(value);
        this.requestStateSave('setSessionSetting:screenshots');
        this.emit('session:updated', session);
        break;

      case 'agent':
        await this.switchSessionAgent(session, value);
        break;

      case 'dir':
      case 'folder':
      case 'repo':
        await this.switchSessionDirectory(session, value);
        break;

      default:
        throw new Error(`Unknown setting: ${key}. Available: autoyes, screenshots, agent, dir`);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  /**
   * Get session by name
   */
  getByName(name: string): Session | null {
    return this.sessions.get(name) ?? null;
  }

  /**
   * Get sessions list (alias for listSessions for API compatibility)
   */
  getSessionsList(): Session[] {
    return this.listSessions();
  }

  /**
   * Get session settings
   */
  getSessionSettings(name: string): Record<string, string> {
    const session = this.sessions.get(name);
    if (!session) {
      return {};
    }
    return {
      autoApprove: String(session.autoApprove),
      screenshotsEnabled: String(session.screenshotsEnabled),
      agent: session.agentType || '',
      dir: session.repoDir || '',
    };
  }

  /**
   * Get all sessions
   */
  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get sessions map (for state persistence)
   */
  getSessionsMap(): Map<string, Session> {
    return this.sessions;
  }

  /**
   * Recover sessions from persisted state
   */
  async recoverSessions(persisted: PersistedSession[]): Promise<void> {
    log.info(`Recovering ${persisted.length} sessions...`);

    for (const ps of persisted) {
      if (ps.status === 'stopped') continue;

      const session: Session = {
        ...ps,
        status: ps.status === 'creating' ? 'active' : ps.status,
        agentStatus: 'stable',
        feedbackController: null,
        pendingApproval: undefined,
      };

      try {
        // Check if AgentAPI process is still alive
        process.kill(ps.pid, 0);

        // Health check
        const response = await fetch(`http://localhost:${ps.port}/status`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error('Health check failed');

        // Process alive and healthy — reconnect
        this.attachRuntime(session, ps.port);

        this.sessions.set(ps.name, session);
        this.usedPorts.add(ps.port);
        this.requestStateSave('recoverSessions-success');

        log.info(`Recovered session: ${ps.name}`);
      } catch (err) {
        session.status = 'error';
        this.sessions.set(ps.name, session);
        this.requestStateSave('recoverSessions-error');

        log.warn(`Failed to recover session ${ps.name}`, { error: String(err) });
      }
    }
  }

  /**
   * Attach per-session runtime pipeline (SSE FeedbackController).
   */
  private attachRuntime(session: Session, port: number): void {
    const fc = new FeedbackController(session, this.config, this.classifier);

    fc.on('event', (event: FeedbackEvent) => {
      // Emit for SSE broadcaster to pick up
      this.emit('session:event', session, event);
      session.lastActivityAt = Date.now();

      if (event.type === 'approval') {
        const command = this.classifier.extractCommand(event.content);
        this.setPendingApproval(session, command);

        if (session.autoApprove) {
          void this.sendAutoApproval(session, command).catch((autoErr: Error) => {
            log.error('Auto-approve failed', { session: session.name, error: String(autoErr) });
          });
        }
      }
    });

    fc.on('status', (status: 'stable' | 'running') => {
      const previousStatus = session.agentStatus;
      
      session.lastActivityAt = Date.now();
      
      if (status === 'running') {
        session.agentStatus = 'running';
        this.clearPendingApproval(session);
      } else if (status === 'stable') {
        if (session.pendingApproval) {
          session.agentStatus = 'awaiting_human_input';
        } else {
          session.agentStatus = 'stable';
          
          // Flush queued messages when agent becomes stable
          if (globalMessageQueue.hasPending(session.name)) {
            log.info('Agent stable, flushing message queue', { session: session.name });
            void globalMessageQueue.flush(session.name).then((result) => {
              log.debug('Message queue flushed', { 
                session: session.name, 
                delivered: result.delivered, 
                failed: result.failed 
              });
            }).catch((err) => {
              log.error('Message queue flush failed', { session: session.name, error: String(err) });
            });
          }
        }
      }

      if (previousStatus !== session.agentStatus) {
        this.requestStateSave('status-change');
        this.emit('session:updated', session);
      }
    });

    fc.on('error', (err: Error) => {
      log.warn('SSE connection error', { session: session.name, error: err.message });
    });

    fc.connect(port);
    session.feedbackController = fc;
  }

  private clearRuntime(session: Session): void {
    this.clearPendingApproval(session);

    if (session.feedbackController) {
      (session.feedbackController as FeedbackController).disconnect();
      session.feedbackController = null;
    }
  }

  private async sendAutoApproval(session: Session, command: string | null): Promise<void> {
    try {
      await agentClient(session.port).sendRaw('yes\n');
      this.clearPendingApproval(session);
      log.info(`Auto-approved${command ? `: ${command}` : ''}`, { session: session.name });
      this.emit('session:updated', session);
    } catch (err) {
      log.error('Auto-approve send failed', { session: session.name, error: String(err) });
    }
  }

  /**
   * Restart a session
   */
  async restartSession(name: string): Promise<void> {
    const session = this.sessions.get(name);
    if (!session) {
      throw new Error(`Session '${name}' not found.`);
    }

    if (!fs.existsSync(session.workDir)) {
      throw new Error(`Session '${name}' cannot be restarted because worktree is missing (${session.workDir}). Use /new instead.`);
    }

    if (session.status === 'active') {
      try {
        process.kill(session.pid, 0);
        const status = await agentClient(session.port).getStatus();
        if (status) {
          throw new Error(`Session '${name}' is already running.`);
        }
      } catch {
        // Continue with restart path
      }
    }

    this.clearRuntime(session);
    const originalPort = session.port;
    let restartPort = originalPort;
    const portUsedByAnotherSession = Array.from(this.sessions.values()).some(
      s => s.name !== session.name && s.status === 'active' && s.port === restartPort,
    );

    if (portUsedByAnotherSession) {
      restartPort = this.allocatePort();
    } else {
      this.usedPorts.add(restartPort);
    }

    try {
      const pid = await this.spawnAgentAPI(restartPort, session.agentType, session.model, session.workDir);
      await this.healthCheck(restartPort, this.getStartupTimeoutMs(session.agentType));

      session.pid = pid;
      session.port = restartPort;
      session.status = 'active';
      session.agentStatus = 'stable';
      session.lastActivityAt = Date.now();
      this.clearPendingApproval(session);

      this.attachRuntime(session, restartPort);
      this.requestStateSave('restartSession');
      this.emit('session:updated', session);
    } catch (err) {
      if (restartPort !== originalPort) {
        this.releasePort(restartPort);
      }
      session.status = 'error';
      this.clearPendingApproval(session);
      this.requestStateSave('restartSession-error');
      throw new Error(`Failed to restart session '${session.name}': ${String(err)}`);
    }
  }

  private setPendingApproval(session: Session, command: string | null): void {
    this.clearPendingApproval(session);

    const pending: NonNullable<Session['pendingApproval']> = {
      detectedAt: Date.now(),
      command,
    };

    if (this.config.approvalTimeoutMs > 0) {
      pending.timeoutId = setTimeout(() => {
        void this.handleApprovalTimeout(session);
      }, this.config.approvalTimeoutMs);
    }

    session.pendingApproval = pending;
    if (session.agentStatus === 'stable') {
      session.agentStatus = 'awaiting_human_input';
      this.requestStateSave('status-change:awaiting_input');
      this.emit('session:updated', session);
    }
    this.emit('approval:needed', session);

    // Send push notification for offline clients
    if (this.notifier) {
      void this.notifier.sendNotification(
        `OpenSofa Task Stalled`,
        `Agent '${session.name}' requires human input for: ${command || 'a shell command'}`,
        `/?session=${session.name}`
      );
    }
  }

  private clearPendingApproval(session: Session): void {
    if (session.pendingApproval?.timeoutId) {
      clearTimeout(session.pendingApproval.timeoutId);
    }
    session.pendingApproval = undefined;
    if (session.agentStatus === 'awaiting_human_input') {
      session.agentStatus = 'stable';
      this.requestStateSave('status-change:stable');
      this.emit('session:updated', session);
    }
    this.emit('approval:cleared', session);
  }

  private async handleApprovalTimeout(session: Session): Promise<void> {
    const pending = session.pendingApproval;
    if (!pending || session.status !== 'active') {
      return;
    }

    this.clearPendingApproval(session);

    try {
      await agentClient(session.port).sendRaw('no\n');
      log.info('Approval timed out, auto-rejected', { session: session.name });
      this.emit('session:updated', session);
    } catch (err) {
      log.error('Approval timeout handling failed', { session: session.name, error: String(err) });
    }
  }

  private requestStateSave(reason: string): void {
    if (!this.onStateChanged) {
      return;
    }

    void this.onStateChanged().catch((err) => {
      log.error('State persistence hook failed', { reason, error: String(err) });
    });
  }
}