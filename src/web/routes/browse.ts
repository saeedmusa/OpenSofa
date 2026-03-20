/**
 * OpenSofa Web - Browse API Routes
 *
 * REST endpoints for browsing the filesystem (used by NewSessionModal
 * to select a project directory before session creation).
 */

import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createLogger } from '../../utils/logger.js';
import { isPathWithinDir } from '../../utils/path-utils.js';
import { success, error } from '../types.js';

const log = createLogger('web:routes:browse');

const MAX_ENTRIES = 100;

const isGitRepo = async (dirPath: string): Promise<boolean> => {
  try {
    await fs.promises.access(path.join(dirPath, '.git'));
    return true;
  } catch {
    return false;
  }
};

export interface BrowseRoutesDeps {
}

export const createBrowseRoutes = (deps: BrowseRoutesDeps): Hono => {
  const app = new Hono();
  const homeDir = os.homedir();

  app.get('/', async (c) => {
    const queryPath = c.req.query('path') ?? '';
    
    let targetPath: string;
    if (queryPath.startsWith('~')) {
      targetPath = path.join(homeDir, queryPath.slice(1));
    } else if (path.isAbsolute(queryPath)) {
      targetPath = queryPath;
    } else {
      targetPath = path.join(homeDir, queryPath);
    }
    
    targetPath = path.normalize(targetPath);

    // Security: prevent path traversal outside home directory
    if (!isPathWithinDir(targetPath, homeDir)) {
      return c.json(error('Access denied: path outside home directory', 'FORBIDDEN'), 403);
    }

    // Validate it's a directory
    if (!fs.existsSync(targetPath)) {
      return c.json(error('Directory not found', 'NOT_FOUND'), 404);
    }

    if (!fs.statSync(targetPath).isDirectory()) {
      return c.json(error('Not a directory', 'NOT_DIRECTORY'), 400);
    }

    try {
      const rawEntries = await fs.promises.readdir(targetPath, { withFileTypes: true });
      
      // Check which entries are git repos (in parallel)
      const entries = await Promise.all(
        rawEntries
          .filter(dirent => !dirent.name.startsWith('.'))
          .sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          })
          .slice(0, MAX_ENTRIES)
          .map(async (dirent) => {
            const fullPath = path.join(targetPath, dirent.name);
            const isDir = dirent.isDirectory();
            const isGit = isDir ? await isGitRepo(fullPath) : false;
            
            return {
              name: dirent.name,
              type: isDir ? 'directory' as const : 'file' as const,
              isGitRepo: isGit,
            };
          })
      );

      return c.json(success({ entries }));
    } catch (err) {
      log.error('Failed to list directory', { path: targetPath, error: String(err) });
      return c.json(error('Failed to list directory', 'READ_ERROR'), 500);
    }
  });

  // POST /api/browse - Create a new directory
  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { path: queryPath, create } = body as { path?: string; create?: boolean };

    if (!create) {
      return c.json(error('Invalid request', 'INVALID_REQUEST'), 400);
    }

    let targetPath: string;
    if (queryPath?.startsWith('~')) {
      targetPath = path.join(homeDir, queryPath.slice(1));
    } else if (queryPath?.startsWith('/')) {
      targetPath = queryPath;
    } else {
      targetPath = path.join(homeDir, queryPath || '');
    }

    targetPath = path.normalize(targetPath);

    // Security: prevent path traversal outside home directory
    if (!isPathWithinDir(targetPath, homeDir)) {
      return c.json(error('Access denied: path outside home directory', 'FORBIDDEN'), 403);
    }

    // Check if parent exists
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
      return c.json(error('Parent directory does not exist', 'NOT_FOUND'), 404);
    }

    try {
      await fs.promises.mkdir(targetPath, { recursive: false });
      return c.json(success({ ok: true, path: queryPath }));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        return c.json(error('Directory already exists', 'EXISTS'), 409);
      }
      log.error('Failed to create directory', { path: targetPath, error: String(err) });
      return c.json(error('Failed to create directory', 'CREATE_ERROR'), 500);
    }
  });

  return app;
};
