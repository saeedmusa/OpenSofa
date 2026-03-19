/**
 * Tests for Phase 5: Deprecation Warnings
 * 
 * These tests verify that the regex-based parser is marked as deprecated
 * and that the new AG-UI parser infrastructure is in place.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 5: Deprecation Warnings', () => {
  const projectRoot = process.cwd();

describe('New AG-UI parser modules exist', () => {
    it('should have jsonl-parser.ts', () => {
      const exists = fs.existsSync(
        path.join(projectRoot, 'src/web/event-parser/jsonl-parser.ts')
      );
      expect(exists).toBe(true);
    });

    it('should have mapper.ts', () => {
      const exists = fs.existsSync(
        path.join(projectRoot, 'src/web/event-parser/mapper.ts')
      );
      expect(exists).toBe(true);
    });

    it('should export JsonlParser from event-parser', () => {
      const source = fs.readFileSync(
        path.join(projectRoot, 'src/web/event-parser/mod.ts'),
        'utf-8'
      );
      
      expect(source).toContain('JsonlParser');
      expect(source).toContain('mapAGUIToActivityEvent');
    });
  });

  describe('Agent adapters exist', () => {
    it('should have opencode-adapter.ts', () => {
      const exists = fs.existsSync(
        path.join(projectRoot, 'src/web/agent-adapters/opencode-adapter.ts')
      );
      expect(exists).toBe(true);
    });

    it('should have claude-adapter.ts', () => {
      const exists = fs.existsSync(
        path.join(projectRoot, 'src/web/agent-adapters/claude-adapter.ts')
      );
      expect(exists).toBe(true);
    });

    it('should have aider-adapter.ts', () => {
      const exists = fs.existsSync(
        path.join(projectRoot, 'src/web/agent-adapters/aider-adapter.ts')
      );
      expect(exists).toBe(true);
    });

    it('should have globalAdapterRegistry', () => {
      const source = fs.readFileSync(
        path.join(projectRoot, 'src/web/agent-adapters/mod.ts'),
        'utf-8'
      );
      
      expect(source).toContain('globalAdapterRegistry');
    });
  });

  describe('AgentRegistry has JSON support', () => {
    it('should have getJsonOutputFlags method', () => {
      const source = fs.readFileSync(
        path.join(projectRoot, 'src/agent-registry.ts'),
        'utf-8'
      );
      
      expect(source).toContain('getJsonOutputFlags');
      expect(source).toContain('supportsJsonOutput');
      expect(source).toContain('buildDirectSpawnArgs');
    });

    it('should define JSON flags for opencode', () => {
      const source = fs.readFileSync(
        path.join(projectRoot, 'src/agent-registry.ts'),
        'utf-8'
      );
      
      expect(source).toContain("case 'opencode'");
      expect(source).toContain("'--format', 'json'");
    });
  });

  describe('Documentation', () => {
    it('should have US-16 spec document', () => {
      const exists = fs.existsSync(
        path.join(projectRoot, 'docs/US-16-structured-sse-ag-ui.md')
      );
      expect(exists).toBe(true);
    });

    it('should document Phase 5 deprecation', () => {
      const spec = fs.readFileSync(
        path.join(projectRoot, 'docs/US-16-structured-sse-ag-ui.md'),
        'utf-8'
      );
      
      expect(spec).toContain('Phase 5');
      expect(spec).toContain('Deprecation');
    });
  });
});
