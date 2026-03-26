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
import { ProcessManager, getProcessManager } from './process-manager.js';
import { TmuxCompatibility, createTmuxCompat } from './tmux-compat.js';

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
  private processManager: ProcessManager;
  private tmuxCompat: TmuxCompatibility;
  private creationTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    config: OpenSofaConfig,
    classifier: AgentStateMachine,
    agentRegistry: AgentRegistry,
  ) {
    super();
    this.config = config;
    this.classifier = classifier;
    this.agentRegistry = agentRegistry;
    
    // Initialize process management
    this.processManager = getProcessManager();
    this.tmuxCompat = createTmuxCompat({ processManager: this.processManager });
    
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

    // Safety net: auto-fail sessions stuck in 'creating' for too long (3 minutes)
    const CREATION_TIMEOUT_MS = 3 * 60 * 1000;
    const creationTimer = setTimeout(() => {
      const s = this.sessions.get(name);
      if (s && s.status === 'creating') {
        log.error(`Session '${name}' stuck in creating state — marking as error after ${CREATION_TIMEOUT_MS / 1000}s`);
        s.status = 'error';
        s.agentStatus = 'stable';
        this.emit('session:updated', s);
        this.creatingSessions.delete(name);
      }
      this.creationTimeouts.delete(name);
    }, CREATION_TIMEOUT_MS);
    this.creationTimeouts.set(name, creationTimer);

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
      // Update session to error status instead of deleting — so frontend can see the error
      const session = this.sessions.get(name);
      if (session) {
        session.status = 'error';
        session.agentStatus = 'stable';
        this.emit('session:updated', session);
      }
      this.creatingSessions.delete(name);
      throw new Error(`Failed to create worktree: ${error.message}`);
    }

    // 4. Allocate port
    let port: number;
    try {
      port = this.allocatePort();
    } catch (err) {
      const error = err as Error;
      log.error('Failed to allocate port', { error: error.message });
      this.creatingSessions.delete(name);
      this.sessions.delete(name);
      throw new Error(`Failed to allocate port: ${error.message}`);
    }
    const startupTimeoutMs = this.getStartupTimeoutMs(agent);

    // 5. Spawn AgentAPI
    let pid: number;
    try {
      pid = await this.spawnAgentAPI(port, agent, model, workDir);
    } catch (err) {
      const error = err as Error;
      log.error('Failed to spawn AgentAPI', { error: error.message });
      // Update session to error status instead of deleting — so frontend can see the error
      const session = this.sessions.get(name);
      if (session) {
        session.status = 'error';
        session.agentStatus = 'stable';
        this.emit('session:updated', session);
      }
      this.creatingSessions.delete(name);
      this.releasePort(port);
      this.removeWorktree(dir, workDir);
      return;
    }

    // 6. Health check
    try {
      await this.healthCheck(port, startupTimeoutMs);
    } catch (err) {
      log.error('AgentAPI health check failed', { error: String(err) });
      // Update session to error status instead of deleting — so frontend can see the error
      const session = this.sessions.get(name);
      if (session) {
        session.status = 'error';
        session.agentStatus = 'stable';
        this.emit('session:updated', session);
      }
      this.creatingSessions.delete(name);
      this.killProcess(pid);
      this.releasePort(port);
      this.removeWorktree(dir, workDir);
      return;
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

    // 8. Initialize FeedbackController (SSE connection) + store session
    // Wrap in try/catch to ensure creatingSessions cleanup and resource release on failure
    try {
      this.attachRuntime(session, port);
      this.sessions.set(name, session);
      this.creatingSessions.delete(name);
      // Clear creation timeout — session has successfully reached 'active'
      const timer = this.creationTimeouts.get(name);
      if (timer) {
        clearTimeout(timer);
        this.creationTimeouts.delete(name);
      }
      this.requestStateSave('createSession');
    } catch (err) {
      const error = err as Error;
      log.error('Failed to attach runtime or store session', { name, error: error.message });
      // Clean up creatingSessions guard
      this.creatingSessions.delete(name);
      // Clean up allocated resources
      this.killProcess(pid);
      this.releasePort(port);
      this.removeWorktree(dir, workDir);
      // Remove session from map if it was partially added
      this.sessions.delete(name);
      throw error;
    }

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

    log.info('Creating git worktree', {
      repoDir,
      expandedDir,
      repoBasename,
      parentDir,
      workDir,
      branch,
    });

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
      // Check if branch already exists
      let branchExists = false;
      try {
        safeGitExec(expandedDir, ['rev-parse', '--verify', branch], 5000);
        branchExists = true;
      } catch {
        branchExists = false;
      }

      if (branchExists) {
        // Use existing branch (without -b flag)
        log.info('Using existing branch for worktree', { branch, workDir });
        safeGitExec(expandedDir, ['worktree', 'add', workDir, branch], 60000);
      } else {
        // Create new branch
        log.info('Creating new branch for worktree', { branch, workDir });
        safeGitExec(expandedDir, ['worktree', 'add', workDir, '-b', branch], 60000);
      }
    } catch (err) {
      log.error('Failed to create worktree', { error: String(err) });
      throw new Error(`Failed to create worktree: ${String(err)}`);
    }

    log.info('Worktree created successfully', { workDir, branch });
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
   * Spawn AgentAPI process using node-pty via ProcessManager
   */
  private async spawnAgentAPI(port: number, agent: AgentType, model: string, workDir: string): Promise<number> {
    // --- Pre-flight checks ---
    if (!this.agentRegistry.isAgentApiInstalled()) {
      throw new Error(
        'agentapi CLI is not installed. ' +
        'Install it with: go install github.com/coder/agentapi@latest'
      );
    }
    if (!this.agentRegistry.isInstalled(agent)) {
      throw new Error(
        `${agent} CLI is not installed or not on PATH. ` +
        'Install it first, then try again.'
      );
    }
    if (!fs.existsSync(workDir)) {
      throw new Error(`Working directory does not exist: ${workDir}`);
    }

    const tmuxSessionName = `agentapi-${port}`;
    const { args, env: agentEnv } = this.agentRegistry.buildSpawnArgs(
      agent, port, model || undefined,
    );

    const agentCmd = `agentapi ${args.join(' ')}`;
    log.info(`Spawning AgentAPI in session ${tmuxSessionName}: ${agentCmd}`);
    if (Object.keys(agentEnv).length > 0) {
      log.debug('Agent env vars:', agentEnv);
    }

    // --- Clean up potential orphan ---
    this.cleanupOrphanedSession(tmuxSessionName);

    // --- Spawn using TmuxCompatibility (which uses ProcessManager internally) ---
    try {
      log.info('Creating tmux-compat session', {
        sessionName: tmuxSessionName,
        command: 'agentapi',
        args,
        cwd: workDir,
      });

      const session = this.tmuxCompat.createSession(
        tmuxSessionName,
        'agentapi',
        args,
        {
          cwd: workDir,
          env: {
            ...getEnrichedEnv(agentEnv),
            PATH: getEnrichedPath(),
            TERM: 'xterm-256color',
          },
          cols: 120,
          rows: 36,
        },
      );

      log.info('Tmux-compat session created', {
        sessionName: tmuxSessionName,
        pid: session.pid,
        port,
      });

      // Set port for the session
      session.port = port;

      // Track process for liveness checks
      // Note: We create a minimal ChildProcess-like object for compatibility
      const processInfo = {
        pid: session.pid,
        kill: (signal?: NodeJS.Signals) => this.processManager.kill(session.pid, signal),
      };
      this.startupProcesses.set(port, processInfo as unknown as import('child_process').ChildProcess);

      // Check if process is alive
      const isAlive = this.processManager.isAlive(session.pid);
      log.info('Process liveness check', {
        pid: session.pid,
        isAlive,
      });

      // --- Verify session exists (retry loop) ---
      const sessionExists = await this.verifySessionExists(tmuxSessionName);
      if (!sessionExists) {
        throw new Error(
          `Session ${tmuxSessionName} was not created after retries. ` +
          `Process may have failed to start.`
        );
      }

      log.info('AgentAPI spawned via TmuxCompatibility', {
        port,
        session: tmuxSessionName,
        pid: session.pid,
      });

      return session.pid;
    } catch (err) {
      const error = err as Error;
      log.error('Failed to spawn AgentAPI', { error: error.message, stack: error.stack });
      throw new Error(`Failed to spawn AgentAPI: ${error.message}`);
    }
  }

  /**
   * Verify session exists with retry loop
   * Replaces the hardcoded setTimeout(500) with exponential backoff
   */
  private async verifySessionExists(
    sessionName: string,
    maxAttempts: number = 5,
    initialDelayMs: number = 200,
  ): Promise<boolean> {
    let delay = initialDelayMs;

    log.info('Verifying session exists', {
      sessionName,
      maxAttempts,
      initialDelayMs,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check if session exists in tmuxCompat
      const exists = this.tmuxCompat.sessionExists(sessionName);
      log.info('Session existence check', {
        sessionName,
        attempt,
        exists,
        allSessions: this.tmuxCompat.listSessions(),
      });

      if (exists) {
        log.info(`Session ${sessionName} found on attempt ${attempt}`);
        return true;
      }

      if (attempt < maxAttempts) {
        log.info(
          `Session ${sessionName} not ready, retrying in ${delay}ms ` +
          `(attempt ${attempt}/${maxAttempts})`
        );
        await sleep(delay);
        // Exponential backoff: 200ms → 400ms → 800ms → 1600ms → 3200ms
        delay = Math.min(delay * 2, 5000);
      }
    }

    return false;
  }

  /**
   * Clean up orphaned session
   */
  private cleanupOrphanedSession(sessionName: string): void {
    try {
      this.tmuxCompat.killSession(sessionName);
      log.debug(`Cleaned up orphaned session: ${sessionName}`);
    } catch {
      // Session doesn't exist, fine
    }
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
    const session = this.findSessionByPort(port);
    const sessionName = session?.name ?? 'unknown';

    this.emit('session:health:start', {
      name: sessionName,
      port,
      timeoutMs,
    });

    try {
      await agentClient(port).waitUntilReady(
        timeoutMs,
        500,
        () => this.isStartupProcessAlive(port),
        // Progress callback
        (elapsed, lastError) => {
          this.emit('session:health:tick', {
            name: sessionName,
            port,
            elapsed,
            lastError,
            timeoutMs,
          });
        },
      );
    } finally {
      this.startupProcesses.delete(port);
    }

    this.emit('session:health:done', { name: sessionName, port });
  }

  /**
   * Find session by port
   */
  private findSessionByPort(port: number): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.port === port) {
        return session;
      }
    }
    return undefined;
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

      if (!comm) return false; // Process doesn't exist

      // Allowlist: only kill if it's agentapi, tmux, or known agent binaries
      const allowed = ['agentapi', 'tmux', 'node', 'claude', 'opencode', 'aider', 'goose', 'codex', 'gemini', 'amp', 'copilot', 'cursor', 'auggie', 'amazonq'];
      const isOwned = allowed.some(name => comm.toLowerCase().includes(name));

      if (isOwned) {
        return true;
      }

      // Fallback: if the process exists but isn't in the allowlist,
      // check if it's a child of our tmux session (best-effort)
      try {
        const ppid = execFileSync('ps', ['-p', String(pid), '-o', 'ppid='], {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore'],
          timeout: 1000,
        }).trim();

        if (ppid) {
          const parentComm = execFileSync('ps', ['-p', ppid, '-o', 'comm='], {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore'],
            timeout: 1000,
          }).trim();

          if (parentComm.toLowerCase().includes('tmux') || parentComm.toLowerCase().includes('agentapi')) {
            log.debug('PID is child of tmux/agentapi — allowing kill', { pid, comm, parentComm });
            return true;
          }
        }
      } catch {
        // Parent check failed — fall through
      }

      log.warn('PID ownership verification failed — not killing', { pid, comm });
      return false;
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
   * Kill tmux session by name (now uses tmuxCompat)
   */
  private killTmuxSession(port: number): void {
    const sessionName = `agentapi-${port}`;
    try {
      this.tmuxCompat.killSession(sessionName);
      log.debug(`Killed session: ${sessionName}`);
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
      log.warn('SSE connection error — attempting crash recovery', { session: session.name, error: err.message });
      this.attemptCrashRecovery(session).catch(recoveryErr => {
        log.error('Crash recovery failed', { session: session.name, error: String(recoveryErr) });
      });
    });

    fc.connect(port);
    session.feedbackController = fc;
  }

  /**
   * Attempt to recover from agent crash with exponential backoff.
   * Max 3 attempts with delays: 2s, 4s, 8s.
   */
  private async attemptCrashRecovery(session: Session): Promise<void> {
    const maxAttempts = 3;
    const baseDelayMs = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      log.info(`Crash recovery attempt ${attempt}/${maxAttempts} for ${session.name} (delay: ${delayMs}ms)`);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delayMs));

      try {
        // Kill any zombie processes
        if (session.pid > 0) {
          this.killProcess(session.pid);
        }

        // Attempt restart
        await this.restartSession(session.name);

        log.info(`Crash recovery succeeded for ${session.name} on attempt ${attempt}`);
        this.emit('session:crash_recovered', { sessionName: session.name, attempt });
        return;
      } catch (err) {
        log.warn(`Crash recovery attempt ${attempt} failed for ${session.name}`, { error: String(err) });

        if (attempt === maxAttempts) {
          // All attempts exhausted
          session.status = 'error';
          this.requestStateSave('crash-recovery-exhausted');
          this.emit('session:crash_failed', { sessionName: session.name, attempts: maxAttempts });
          log.error(`Crash recovery exhausted for ${session.name} after ${maxAttempts} attempts`);
        }
      }
    }
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

  /**
   * Get the ProcessManager instance
   */
  getProcessManager(): ProcessManager {
    return this.processManager;
  }

  /**
   * Get the TmuxCompatibility instance
   */
  getTmuxCompat(): TmuxCompatibility {
    return this.tmuxCompat;
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    log.info('Destroying SessionManager');
    this.stopAllSessions().catch((err) => {
      log.error('Failed to stop all sessions during destroy', { error: String(err) });
    });
    this.processManager.cleanup();
    this.tmuxCompat.cleanup();
  }
}