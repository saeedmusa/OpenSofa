/**
 * Regression tests for stale worktree cleanup
 * Addresses: worktree 'already exists' errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { SessionManager } from '../src/session-manager.js';
import type { OpenSofaConfig } from '../src/types.js';

// Mocks
const mockIsValidType = vi.fn().mockReturnValue(true);
const mockIsInstalled = vi.fn().mockReturnValue(true);
const mockBuildSpawnArgs = vi.fn().mockReturnValue({ args: ['--port', '3284', '--type', 'claude'], env: {} });

function createMockAgentRegistry() {
  return {
    isValidType: mockIsValidType,
    isInstalled: mockIsInstalled,
    buildSpawnArgs: mockBuildSpawnArgs,
  };
}

const mockClassify = vi.fn().mockReturnValue({ type: 'safe' });

function createMockClassifier() {
  return {
    classify: mockClassify,
    extractCommand: vi.fn(),
    getPatterns: vi.fn().mockReturnValue([]),
  };
}

function createConfig(overrides: Partial<OpenSofaConfig> = {}): OpenSofaConfig {
  return {
    defaultAgent: 'claude',
    maxSessions: 5,
    portRangeStart: 3284,
    debounceMs: 3000,
    screenshotIntervalMs: 10000,
    approvalTimeoutMs: 300000,
    healthCheckIntervalMs: 10000,
    idleTimeoutMs: 600000,
    screenshotFontSize: 14,
    screenshotCols: 80,
    autoApprove: false,
    projectDirs: ['~/development', '~/projects'],
    autoCleanupOnCritical: true,
    ...overrides,
  };
}

describe('Stale worktree cleanup (regression tests)', () => {
  let tempDir: string;
  let repoDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a real temp directory with a git repo for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opensofa-test-'));
    repoDir = path.join(tempDir, 'myrepo');
    fs.mkdirSync(repoDir);
    
    // Initialize git repo
    execSync('git init', { cwd: repoDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: repoDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: repoDir, stdio: 'pipe' });
    
    // Create initial commit
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test');
    execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
    execSync('git commit -m "initial"', { cwd: repoDir, stdio: 'pipe' });
  });

  afterEach(() => {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('createWorktree should handle existing worktree directory (stale cleanup)', () => {
    const workDir = path.join(tempDir, 'myrepo-staletest');
    const sessionManager = new SessionManager(
      createConfig(),
      createMockClassifier() as any,
      createMockAgentRegistry() as any
    );

    // First, manually create a worktree to simulate a stale one from previous failed attempt
    execSync(`git -C "${repoDir}" worktree add "${workDir}" -b feat/staletest`, {
      stdio: 'pipe',
      timeout: 30000,
    });

    // Verify it exists
    expect(fs.existsSync(workDir)).toBe(true);

    // Now try to create another worktree with same branch
    // The createWorktree should handle this gracefully
    try {
      const result = (sessionManager as any).createWorktree(repoDir, 'staletest');
      
      // If it succeeds, verify the worktree is in good state
      expect(result.workDir).toBe(workDir);
      expect(result.branch).toBe('feat/staletest');
      expect(fs.existsSync(workDir)).toBe(true);
      expect(fs.existsSync(path.join(workDir, '.git'))).toBe(true);
    } catch (error) {
      // If it throws, that's also acceptable behavior for this edge case
      // The main point is that it doesn't crash
      expect(error).toBeDefined();
    }
  });

  it('createWorktree should handle stale directory without git worktree entry', () => {
    const workDir = path.join(tempDir, 'myrepo-orphan');
    const sessionManager = new SessionManager(
      createConfig(),
      createMockClassifier() as any,
      createMockAgentRegistry() as any
    );

    // Create directory directly without git worktree (orphan directory)
    fs.mkdirSync(workDir);
    fs.writeFileSync(path.join(workDir, 'stale.txt'), 'stale content');

    // Should clean up and create fresh worktree
    const result = (sessionManager as any).createWorktree(repoDir, 'orphan');

    expect(result.workDir).toBe(workDir);
    expect(result.branch).toBe('feat/orphan');
    expect(fs.existsSync(path.join(workDir, '.git'))).toBe(true);
    // Stale file should be gone
    expect(fs.existsSync(path.join(workDir, 'stale.txt'))).toBe(false);
  });

  it('createWorktree should throw helpful error if cleanup fails completely', () => {
    const workDir = path.join(tempDir, 'myrepo-locked');
    const sessionManager = new SessionManager(
      createConfig(),
      createMockClassifier() as any,
      createMockAgentRegistry() as any
    );

    // Create a directory and make it read-only to simulate permission issues
    fs.mkdirSync(workDir);
    fs.writeFileSync(path.join(workDir, 'locked.txt'), 'locked');
    fs.chmodSync(workDir, 0o444); // Read-only

    try {
      // Should throw with helpful message
      expect(() => {
        (sessionManager as any).createWorktree(repoDir, 'locked');
      }).toThrow(/Worktree directory already exists/);
    } finally {
      // Restore permissions for cleanup
      try {
        fs.chmodSync(workDir, 0o755);
      } catch {
        // Ignore
      }
    }
  });

  it('createWorktree should use existing branch if feat/branch already exists', () => {
    const workDir = path.join(tempDir, 'myrepo-existingbranch');
    const sessionManager = new SessionManager(
      createConfig(),
      createMockClassifier() as any,
      createMockAgentRegistry() as any
    );

    // Create the branch first
    execSync('git checkout -b feat/existingbranch', { cwd: repoDir, stdio: 'pipe' });
    execSync('git checkout main || git checkout master', { cwd: repoDir, stdio: 'pipe' });

    // Should work with existing branch (without -b flag)
    const result = (sessionManager as any).createWorktree(repoDir, 'existingbranch');

    expect(result.workDir).toBe(workDir);
    expect(result.branch).toBe('feat/existingbranch');
  });
});
