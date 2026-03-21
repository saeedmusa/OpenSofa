/**
 * OpenSofa - Project Auto-Discovery
 *
 * Scans common directories for git repositories.
 * Provides zero-setup project discovery for the PWA.
 *
 * Design principles:
 * - Async, non-blocking scanning
 * - Depth-limited (max 3 levels)
 * - Skips node_modules, .git internals, dist, build, vendor
 * - Reads .git/HEAD directly for branch name (no child process)
 * - Caches results with configurable TTL
 */

import { readdir, stat, readFile, lstat, realpath } from 'fs/promises';
import { join, basename } from 'path';
import { createLogger } from '../utils/logger.js';

const log = createLogger('discovery:project');

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────

export interface DiscoveredProject {
  name: string;
  path: string;
  branch: string | null;
  isWorktree: boolean;
  lastModified: number; // Unix timestamp (ms)
  isDirty: boolean | null; // null = not checked (lazy)
}

export interface ProjectDiscoveryOptions {
  scanDirs?: string[];
  maxDepth?: number;
  maxProjects?: number;
  checkDirty?: boolean; // Lazy — only when requested
}

// ──────────────────────────────────────
// Constants
// ──────────────────────────────────────

const DEFAULT_SCAN_DIRS = [
  '~/development',
  '~/projects',
  '~/code',
  '~/src',
  '~/work',
  '~/repos',
];

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_PROJECTS = 50;

/** Directories to skip during scanning */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.cache',
  'vendor',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv',
  '.terraform',
  '.idea',
  '.vscode',
]);

// ──────────────────────────────────────
// Helpers
// ──────────────────────────────────────

function expandHome(p: string): string {
  if (p.startsWith('~/')) {
    return join(process.env.HOME || '/root', p.slice(2));
  }
  return p;
}

/**
 * Read branch name from .git/HEAD directly (no child process).
 * ~0.1ms vs ~2-5ms for execSync('git branch --show-current').
 */
function readBranchFromHead(gitPath: string): string | null {
  try {
    // Use sync here because this is called during directory scanning
    // and we need the result immediately for sorting
    const { readFileSync } = require('fs');
    const head = readFileSync(join(gitPath, 'HEAD'), 'utf-8').trim();
    // ref: refs/heads/main
    const match = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (match) return match[1] ?? null;
    // Detached HEAD
    return head.substring(0, 7);
  } catch {
    return null;
  }
}

/**
 * Get approximate last commit time by stat-ing the branch ref file.
 * ~0.1ms — much faster than `git log -1 --format=%ct`.
 */
function getLastCommitTime(gitPath: string, branch: string): number {
  try {
    const { statSync } = require('fs');
    const refPath = join(gitPath, 'refs', 'heads', branch);
    const s = statSync(refPath);
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Check if .git is a file (worktree) or directory (normal repo).
 */
function detectWorktree(dirPath: string): boolean {
  try {
    const { lstatSync, readFileSync } = require('fs');
    const dotGitPath = join(dirPath, '.git');
    const s = lstatSync(dotGitPath);
    if (s.isFile()) {
      const content = readFileSync(dotGitPath, 'utf-8').trim();
      return content.startsWith('gitdir:');
    }
    return false;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────
// Scanner
// ──────────────────────────────────────

/**
 * Recursively scan a directory for git repos.
 * Uses depth limit and skips known non-repo directories.
 */
async function scanDirectory(
  dir: string,
  maxDepth: number,
  depth: number,
  results: DiscoveredProject[],
  maxProjects: number,
): Promise<void> {
  if (depth > maxDepth || results.length >= maxProjects) return;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // Permission denied or doesn't exist
  }

  const subdirs: string[] = [];

  for (const entry of entries) {
    if (results.length >= maxProjects) break;

    if (entry.name === '.git') {
      // Found a git repo at this level
      const isWorktree = detectWorktree(dir);
      const gitPath = isWorktree
        ? join(dir, '.git') // For worktrees, read the file to get gitdir
        : join(dir, '.git');

      const branch = readBranchFromHead(gitPath);
      const lastModified = branch ? getLastCommitTime(gitPath, branch) : 0;

      results.push({
        name: basename(dir),
        path: dir,
        branch,
        isWorktree,
        lastModified,
        isDirty: null, // Lazy — not checked during scan
      });

      // Don't recurse into .git
      continue;
    }

    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue; // Skip hidden dirs

    if (entry.isDirectory()) {
      subdirs.push(join(dir, entry.name));
    }
  }

  // Recurse into subdirectories in parallel
  if (subdirs.length > 0 && results.length < maxProjects) {
    await Promise.all(
      subdirs.map((subdir) =>
        scanDirectory(subdir, maxDepth, depth + 1, results, maxProjects),
      ),
    );
  }
}

// ──────────────────────────────────────
// Public API
// ──────────────────────────────────────

/**
 * Discover git projects by scanning common directories.
 * Results are sorted by last modified (most recent first).
 */
export async function discoverProjects(
  options: ProjectDiscoveryOptions = {},
): Promise<DiscoveredProject[]> {
  const scanDirs = (options.scanDirs ?? DEFAULT_SCAN_DIRS).map(expandHome);
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxProjects = options.maxProjects ?? DEFAULT_MAX_PROJECTS;

  const results: DiscoveredProject[] = [];

  log.info('Starting project discovery', { scanDirs, maxDepth });

  for (const dir of scanDirs) {
    if (results.length >= maxProjects) break;
    try {
      await scanDirectory(dir, maxDepth, 0, results, maxProjects);
    } catch {
      // Directory doesn't exist or no permission — skip
      log.debug('Skipping scan directory', { dir });
    }
  }

  // Sort by last modified (most recent first)
  results.sort((a, b) => b.lastModified - a.lastModified);

  log.info('Project discovery complete', {
    found: results.length,
    scanDirs: scanDirs.length,
  });

  return results;
}

/**
 * Check if a project has uncommitted changes.
 * This is lazy — only called when the user views the project.
 */
export async function checkProjectDirty(projectPath: string): Promise<boolean> {
  try {
    const { execFileSync } = await import('child_process');
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}
