/**
 * OpenSofa Web - Session Changes Routes
 *
 * REST endpoints for git diff information within a session's worktree.
 */

import { Hono } from 'hono';
import { execFileSync } from 'child_process';
import { createLogger } from '../../utils/logger.js';
import { success, error } from '../types.js';
import type { Session } from '../../types.js';

const log = createLogger('web:routes:session-changes');

export interface SessionChangesDeps {
  getSession: (name: string) => Session | null;
}

export const createSessionChangesRoutes = (deps: SessionChangesDeps): Hono => {
  const app = new Hono();

  // GET /api/sessions/:name/changes — list files changed in session
  app.get('/:name/changes', (c) => {
    const name = c.req.param('name');
    const session = deps.getSession(name);

    if (!session) {
      return c.json(error('Session not found', 'NOT_FOUND'), 404);
    }

    const workDir = session.workDir;
    if (!workDir) {
      return c.json(success({ changes: [] }));
    }

    try {
      // Get changed files with status (A=added, M=modified, D=deleted)
      const nameStatus = execFileSync('git', ['diff', '--name-status', 'HEAD'], {
        cwd: workDir,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: 'pipe',
      }).trim();

      if (!nameStatus) {
        return c.json(success({ changes: [] }));
      }

      const changes = nameStatus.split('\n').map(line => {
        const [status, ...pathParts] = line.split('\t');
        const filePath = pathParts.join('\t');
        const changeType = status === 'A' ? 'created'
          : status === 'D' ? 'deleted'
          : 'modified';
        return { filePath, changeType, status };
      });

      // Get diff stat for line counts
      let diffStat: Record<string, { added: number; removed: number }> = {};
      try {
        const statOutput = execFileSync('git', ['diff', '--stat', 'HEAD'], {
          cwd: workDir,
          encoding: 'utf-8',
          timeout: 5000,
          stdio: 'pipe',
        }).trim();

        // Parse lines like: " src/file.ts | 10 +++++-----"
        for (const line of statOutput.split('\n')) {
          const match = line.match(/^(.+?)\s*\|\s*\d+\s+([+\-]+)/);
          if (match && match[1] && match[2]) {
            const path = match[1].trim();
            const chars = match[2];
            const added = (chars.match(/\+/g) || []).length;
            const removed = (chars.match(/-/g) || []).length;
            diffStat[path] = { added, removed };
          }
        }
      } catch { /* stat is optional */ }

      const result = changes.map(change => ({
        ...change,
        added: diffStat[change.filePath]?.added ?? 0,
        removed: diffStat[change.filePath]?.removed ?? 0,
      }));

      return c.json(success({ changes: result }));
    } catch (err) {
      log.warn('Failed to get session changes', { session: name, error: String(err) });
      return c.json(success({ changes: [] }));
    }
  });

  return app;
};
