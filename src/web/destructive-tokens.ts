/**
 * OpenSofa - Destructive Command Detection (Token-Based)
 *
 * Uses String.includes() token matching instead of regex.
 * No regular expressions — deterministic, readable, and maintainable.
 *
 * Replaces the old regex-based destructive-patterns.ts.
 */

/**
 * Map of dangerous command tokens to human-readable risk labels.
 * Checked using String.includes() — no regex.
 * Order matters: more specific tokens should come first.
 */
const DESTRUCTIVE_TOKENS: [string, string][] = [
  ['rm -rf', 'File Deletion'],
  ['rm -f', 'File Deletion'],
  ['rm --force', 'File Deletion'],
  ['rm -r', 'File Deletion'],
  ['DROP TABLE', 'Database Drop'],
  ['DROP DATABASE', 'Database Drop'],
  ['DROP INDEX', 'Database Drop'],
  ['DROP SCHEMA', 'Database Drop'],
  ['DELETE FROM', 'Data Deletion'],
  ['TRUNCATE TABLE', 'Table Truncation'],
  ['chmod 777', 'Unsafe Permissions'],
  ['mkfs', 'Filesystem Format'],
  ['dd if=', 'Raw Disk Write'],
  ['git push --force', 'Force Push'],
  ['git push -f', 'Force Push'],
  ['git reset --hard', 'Hard Reset'],
  ['sudo rm', 'Privileged Deletion'],
];

/**
 * Check if a command string matches any destructive token.
 * Uses String.includes() — no regex.
 */
export function isDestructiveCommand(command: string): boolean {
  if (!command) return false;

  const lower = command.toLowerCase();

  for (const [token] of DESTRUCTIVE_TOKENS) {
    if (command.includes(token) || lower.includes(token.toLowerCase())) {
      return true;
    }
  }

  // Check for pipe-to-shell pattern: curl/wget | sh/bash
  if (command.includes('|')) {
    const hasShell = command.includes('sh') || command.includes('bash');
    const hasDownloader = command.includes('curl') || command.includes('wget');
    if (hasShell && hasDownloader) {
      const pipeIndex = command.indexOf('|');
      const beforePipe = command.slice(0, pipeIndex).trim();
      if (beforePipe.startsWith('curl') || beforePipe.startsWith('wget')) {
        return true;
      }
    }
  }

  // Check for fork bomb pattern
  if (command.includes(':(){') && command.includes('|:') && command.includes('&')) {
    return true;
  }

  // Check for device file writes
  if (command.includes('> /dev/')) {
    return true;
  }

  return false;
}

/**
 * Get a human-readable risk label for a destructive command.
 * Returns null if the command is not destructive.
 */
export function getDestructiveLabel(command: string): string | null {
  if (!command) return null;

  const lower = command.toLowerCase();

  for (const [token, label] of DESTRUCTIVE_TOKENS) {
    if (command.includes(token) || lower.includes(token.toLowerCase())) {
      return label;
    }
  }

  // Pipe-to-shell
  if (command.includes('|')) {
    const hasShell = command.includes('sh') || command.includes('bash');
    const hasDownloader = command.includes('curl') || command.includes('wget');
    if (hasShell && hasDownloader) {
      const pipeIndex = command.indexOf('|');
      const beforePipe = command.slice(0, pipeIndex).trim();
      if (beforePipe.startsWith('curl') || beforePipe.startsWith('wget')) {
        return 'Remote Execution';
      }
    }
  }

  // Fork bomb
  if (command.includes(':(){') && command.includes('|:') && command.includes('&')) {
    return 'Fork Bomb';
  }

  // Device file writes
  if (command.includes('> /dev/')) {
    return 'Device Write';
  }

  return null;
}

/**
 * Check if an ACP ToolCall is destructive based on its Kind.
 * This is the structured path — no text matching needed.
 */
export function isDestructiveToolCall(kind: string, title: string): { dangerous: boolean; label: string | null } {
  if (kind === 'delete') {
    return { dangerous: true, label: 'File Deletion' };
  }

  if (kind === 'execute') {
    const label = getDestructiveLabel(title);
    return { dangerous: label !== null, label };
  }

  return { dangerous: false, label: null };
}
