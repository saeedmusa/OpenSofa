/**
 * OpenSofa Web - Files API Routes
 *
 * REST endpoints for browsing and viewing files in session worktrees.
 */
import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger.js';
import { success, error } from '../types.js';
const log = createLogger('web:routes:files');
// ──────────────────────────────────────
// Pure Functions (File Operations)
// ──────────────────────────────────────
const LANGUAGE_MAP = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.css': 'css',
    '.scss': 'scss',
    '.html': 'html',
    '.xml': 'xml',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
};
/**
 * Detect language from file extension
 */
export const detectLanguage = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return LANGUAGE_MAP[ext] ?? 'plaintext';
};
/**
 * Check if path is within allowed directory (prevent traversal)
 */
export const isPathWithinDir = (targetPath, allowedDir) => {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedAllowed = path.resolve(allowedDir);
    return resolvedTarget.startsWith(resolvedAllowed + path.sep) || resolvedTarget === resolvedAllowed;
};
/**
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};
export const createFilesRoutes = (deps) => {
    const app = new Hono();
    const { getSession } = deps;
    // GET /api/sessions/:name/files - List files in directory
    app.get('/:name/files', async (c) => {
        const name = c.req.param('name');
        const session = getSession(name);
        if (!session) {
            return c.json(error('Session not found', 'NOT_FOUND'), 404);
        }
        const queryPath = c.req.query('path') ?? '';
        const targetDir = path.normalize(path.join(session.workDir, queryPath));
        // Security: prevent path traversal
        if (!isPathWithinDir(targetDir, session.workDir)) {
            return c.json(error('Access denied: path outside worktree', 'FORBIDDEN'), 403);
        }
        if (!fs.existsSync(targetDir)) {
            return c.json(error('Directory not found', 'NOT_FOUND'), 404);
        }
        if (!fs.statSync(targetDir).isDirectory()) {
            return c.json(error('Not a directory', 'NOT_DIRECTORY'), 400);
        }
        try {
            const rawEntries = await fs.promises.readdir(targetDir, { withFileTypes: true });
            const entries = rawEntries
                .filter(dirent => !dirent.name.startsWith('.'))
                .sort((a, b) => {
                // Directories first, then alphabetically
                if (a.isDirectory() && !b.isDirectory())
                    return -1;
                if (!a.isDirectory() && b.isDirectory())
                    return 1;
                return a.name.localeCompare(b.name);
            })
                .slice(0, 100) // Limit to 100 entries
                .map(dirent => {
                const fullPath = path.join(targetDir, dirent.name);
                const stats = dirent.isFile() ? fs.statSync(fullPath) : null;
                return {
                    name: dirent.name,
                    type: dirent.isDirectory() ? 'directory' : 'file',
                    size: stats?.size,
                    modified: stats?.mtimeMs,
                };
            });
            const response = {
                path: queryPath,
                entries,
            };
            return c.json(success(response));
        }
        catch (err) {
            log.error('Failed to list directory', { path: targetDir, error: String(err) });
            return c.json(error('Failed to list directory', 'READ_ERROR'), 500);
        }
    });
    // GET /api/sessions/:name/files/*path - Get file contents
    app.get('/:name/files/*', async (c) => {
        const name = c.req.param('name');
        const session = getSession(name);
        if (!session) {
            return c.json(error('Session not found', 'NOT_FOUND'), 404);
        }
        // Extract the file path from the wildcard
        const filePath = c.req.path.replace(`/api/sessions/${name}/files/`, '');
        const targetPath = path.normalize(path.join(session.workDir, filePath));
        // Security: prevent path traversal
        if (!isPathWithinDir(targetPath, session.workDir)) {
            return c.json(error('Access denied: file outside worktree', 'FORBIDDEN'), 403);
        }
        if (!fs.existsSync(targetPath)) {
            return c.json(error('File not found', 'NOT_FOUND'), 404);
        }
        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
            return c.json(error('Path is a directory, not a file', 'IS_DIRECTORY'), 400);
        }
        // Limit file size to 1MB
        if (stats.size > 1024 * 1024) {
            return c.json(error('File too large (max 1MB)', 'FILE_TOO_LARGE'), 400);
        }
        try {
            const content = await fs.promises.readFile(targetPath, 'utf-8');
            const language = detectLanguage(targetPath);
            const response = {
                path: filePath,
                content,
                language,
                size: stats.size,
            };
            return c.json(success(response));
        }
        catch (err) {
            log.error('Failed to read file', { path: targetPath, error: String(err) });
            return c.json(error('Failed to read file', 'READ_ERROR'), 500);
        }
    });
    return app;
};
//# sourceMappingURL=files.js.map