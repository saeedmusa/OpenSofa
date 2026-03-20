import path from 'path';

/**
 * Check if a target path is within an allowed directory.
 * Prevents path traversal attacks by resolving both paths and comparing.
 */
export const isPathWithinDir = (targetPath: string, allowedDir: string): boolean => {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedAllowed = path.resolve(allowedDir);
  return resolvedTarget.startsWith(resolvedAllowed + path.sep) || resolvedTarget === resolvedAllowed;
};
