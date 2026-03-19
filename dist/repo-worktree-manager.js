import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { expandPath } from './utils/expand-path.js';
export class RepoWorktreeManager {
    activeWorktreeRemovals = new Set();
    validateRepoDirectory(dir) {
        const expandedDir = expandPath(dir);
        if (!fs.existsSync(expandedDir)) {
            return { ok: false, error: `Directory not found: ${dir}` };
        }
        try {
            execFileSync('git', ['-C', expandedDir, 'rev-parse', '--git-dir'], {
                stdio: 'pipe',
                timeout: 5000,
            });
        }
        catch {
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
                // This is a worktree - get the main repo path
                const gitDirOutput = execFileSync('git', ['-C', expandedDir, 'rev-parse', '--git-common-dir'], {
                    encoding: 'utf-8',
                    stdio: 'pipe',
                    timeout: 5000,
                }).trim();
                if (gitDirOutput && !gitDirOutput.includes('worktrees')) {
                    const mainRepo = path.dirname(gitDirOutput);
                    if (fs.existsSync(mainRepo)) {
                        return { ok: true, expandedDir: mainRepo };
                    }
                }
                else if (gitDirOutput.includes('worktrees')) {
                    const mainRepo = path.normalize(path.join(expandedDir, gitDirOutput.replace('/.git/worktrees/' + path.basename(expandedDir), '')));
                    if (fs.existsSync(mainRepo) && mainRepo !== expandedDir) {
                        return { ok: true, expandedDir: mainRepo };
                    }
                }
            }
        }
        catch {
            // Non-fatal, continue with original directory.
        }
        return { ok: true, expandedDir };
    }
    createWorktree(repoDir, sessionName) {
        const expandedDir = expandPath(repoDir);
        const repoBasename = path.basename(expandedDir);
        const parentDir = path.dirname(expandedDir);
        const workDir = path.join(parentDir, `${repoBasename}-${sessionName}`);
        const branch = `feat/${sessionName}`;
        try {
            execFileSync('git', ['-C', expandedDir, 'worktree', 'prune'], {
                stdio: 'pipe',
                timeout: 10000,
            });
        }
        catch {
            // Not fatal - prune may fail if no worktrees exist
        }
        if (fs.existsSync(workDir)) {
            try {
                execFileSync('git', ['-C', expandedDir, 'worktree', 'remove', workDir, '--force'], {
                    stdio: 'pipe',
                    timeout: 10000,
                });
            }
            catch {
                try {
                    fs.rmSync(workDir, { recursive: true, force: true });
                    execFileSync('git', ['-C', expandedDir, 'worktree', 'prune'], {
                        stdio: 'pipe',
                        timeout: 10000,
                    });
                }
                catch {
                    throw new Error(`Worktree directory already exists and could not be cleaned up: ${workDir}\n` +
                        `Remove it manually: rm -rf "${workDir}" && git -C "${expandedDir}" worktree prune`);
                }
            }
        }
        try {
            execFileSync('git', ['-C', expandedDir, 'worktree', 'add', workDir, '-b', branch], {
                stdio: 'pipe',
                timeout: 30000,
            });
        }
        catch {
            try {
                execFileSync('git', ['-C', expandedDir, 'worktree', 'add', workDir, branch], {
                    stdio: 'pipe',
                    timeout: 30000,
                });
            }
            catch (err) {
                throw new Error(`Failed to create worktree: ${String(err)}`);
            }
        }
        return { workDir, branch };
    }
    removeWorktree(repoDir, workDir) {
        const normalizedWorkDir = path.resolve(workDir);
        if (this.activeWorktreeRemovals.has(normalizedWorkDir)) {
            return;
        }
        this.activeWorktreeRemovals.add(normalizedWorkDir);
        try {
            const expandedRepoDir = expandPath(repoDir);
            execFileSync('git', ['-C', expandedRepoDir, 'worktree', 'remove', normalizedWorkDir, '--force'], {
                stdio: 'pipe',
                timeout: 10000,
            });
        }
        catch {
            // Not fatal — worktree may not exist or may have been manually removed
        }
        finally {
            try {
                if (fs.existsSync(normalizedWorkDir)) {
                    fs.rmSync(normalizedWorkDir, { recursive: true, force: true });
                }
            }
            catch {
                // Best-effort cleanup
            }
            try {
                execFileSync('git', ['-C', expandPath(repoDir), 'worktree', 'prune'], {
                    stdio: 'pipe',
                    timeout: 10000,
                });
            }
            catch {
                // Best-effort metadata cleanup
            }
            this.activeWorktreeRemovals.delete(normalizedWorkDir);
        }
    }
}
//# sourceMappingURL=repo-worktree-manager.js.map