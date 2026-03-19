export declare class RepoWorktreeManager {
    private activeWorktreeRemovals;
    validateRepoDirectory(dir: string): {
        ok: true;
        expandedDir: string;
    } | {
        ok: false;
        error: string;
    };
    createWorktree(repoDir: string, sessionName: string): {
        workDir: string;
        branch: string;
    };
    removeWorktree(repoDir: string, workDir: string): void;
}
//# sourceMappingURL=repo-worktree-manager.d.ts.map