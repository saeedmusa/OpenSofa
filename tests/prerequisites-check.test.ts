/**
 * Tests for Prerequisites Check
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { runPrerequisitesCheck } from '../src/prerequisites-check.js';
import type { AgentRegistry } from '../src/agent-registry.js';

vi.mock('child_process');
vi.mock('fs');

describe('Prerequisites Check', () => {
  let mockRegistry: AgentRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRegistry = {
      discoverInstalled: () => ['claude', 'aider'],
      getAllDefinitions: () => [
        { type: 'claude', displayName: 'Claude Code', binary: 'claude' },
        { type: 'aider', displayName: 'Aider', binary: 'aider' },
        { type: 'opencode', displayName: 'OpenCode', binary: 'opencode' },
      ],
    } as any;
  });

  describe('runPrerequisitesCheck()', () => {
    it('should return formatted check results', async () => {
      (execFileSync as any).mockImplementation(() => {
        return 'version 1.0.0';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Prerequisites Check');
      expect(result).toContain('Core Requirements');
      expect(result).toContain('Agents');
    });

    it('should check Node.js version', async () => {
      (execFileSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Node.js');
    });

    it('should warn on old Node.js version', async () => {
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', { value: 'v16.0.0', writable: true });

      (execFileSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('❌');
      expect(result).toContain('requires 18+');
      
      Object.defineProperty(process, 'version', { value: originalVersion, writable: true });
    });

    it('should pass on Node.js 18+', async () => {
      (execFileSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('✅ Node.js');
    });

    it('should check git', async () => {
      (execFileSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'git') return 'git version 2.0.0';
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('git');
    });

    it('should mark git as missing when not installed', async () => {
      (execFileSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'git') throw new Error('Not found');
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('❌ git');
    });

    it('should check tmux', async () => {
      (execFileSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'tmux') return 'tmux 3.0';
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('tmux');
    });

    it('should mark tmux as missing when not installed', async () => {
      (execFileSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'tmux') throw new Error('Not found');
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('❌ tmux');
    });

    it('should check AgentAPI', async () => {
      (execFileSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'agentapi') return 'agentapi version 0.11.0';
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('AgentAPI');
    });

    it('should mark AgentAPI as missing when not installed', async () => {
      (execFileSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'agentapi') throw new Error('Not found');
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('❌ AgentAPI');
    });

    it('should list all agents with status', async () => {
      (execFileSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Claude Code');
      expect(result).toContain('Aider');
    });

    it('should show ✅ for installed agents', async () => {
      (execFileSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('✅');
    });

    it('should show ⬚ for missing agents', async () => {
      mockRegistry.discoverInstalled = () => ['claude']; // Only claude installed
      
      (execFileSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'claude') return '';
        throw new Error('Not found');
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('⬚');
    });

    it('should check config directory', async () => {
      (execFileSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Config');
    });

    it('should show warning when config missing', async () => {
      (execFileSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(false);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('⚠️');
    });

    it('should include summary', async () => {
      (execFileSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Summary');
      expect(result).toContain('✅');
    });

    it('should warn when no agents installed (but core tools present)', async () => {
      mockRegistry.discoverInstalled = () => [];
      
      (execFileSync as any).mockImplementation((cmd: string) => {
        // Core tools are present
        if (cmd === 'git') return 'git version 2.0.0';
        if (cmd === 'tmux') return 'tmux 3.0';
        if (cmd === 'agentapi') return 'agentapi version 0.11.0';
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('at least one');
    });

    it('should show success message when all pass', async () => {
      (execFileSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('All prerequisites satisfied');
    });

    it('should handle timeout on slow commands', async () => {
      (execFileSync as any).mockImplementation(() => {
        throw new Error('ETIMEDOUT');
      });
      (existsSync as any).mockReturnValue(true);

      // Should not throw
      const result = await runPrerequisitesCheck(mockRegistry);
      expect(result).toBeDefined();
    });
  });
});
