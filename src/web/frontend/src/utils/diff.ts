import type { DiffHunk } from '../types';

export function parseDiff(diffText: string): { hunks: DiffHunk[]; additions: number; deletions: number } {
  const lines = diffText.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let additions = 0;
  let deletions = 0;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
        currentHunk = {
          oldStart: oldLine,
          newStart: newLine,
          oldLines: 0,
          newLines: 0,
          lines: [],
        };
      }
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'added',
        newLineNumber: newLine++,
        content: line.slice(1),
      });
      additions++;
      currentHunk.newLines++;
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'removed',
        oldLineNumber: oldLine++,
        content: line.slice(1),
      });
      deletions++;
      currentHunk.oldLines++;
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({
        type: 'context',
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: line.slice(1),
      });
      currentHunk.oldLines++;
      currentHunk.newLines++;
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return { hunks, additions, deletions };
}
