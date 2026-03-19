/**
 * Tests for Prerequisites Check
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execSync } from 'child_process';
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
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('--version') || cmd.includes('-V')) {
          return 'version 1.0.0';
        }
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Prerequisites Check');
      expect(result).toContain('Core Requirements');
      expect(result).toContain('Agents');
    });

    it('should check Node.js version', async () => {
      (execSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Node.js');
    });

    it('should warn on old Node.js version', async () => {
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', { value: 'v16.0.0', writable: true });

      (execSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('❌');
      expect(result).toContain('requires 18+');
      
      Object.defineProperty(process, 'version', { value: originalVersion, writable: true });
    });

    it('should pass on Node.js 18+', async () => {
      (execSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('✅ Node.js');
    });

    it('should check git', async () => {
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('git')) return 'git version 2.0.0';
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('git');
    });

    it('should mark git as missing when not installed', async () => {
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('git')) throw new Error('Not found');
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('❌ git');
    });

    it('should check tmux', async () => {
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('tmux')) return 'tmux 3.0';
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('tmux');
    });

    it('should mark tmux as missing when not installed', async () => {
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('tmux')) throw new Error('Not found');
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('❌ tmux');
    });

    it('should check AgentAPI', async () => {
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('agentapi')) return 'agentapi version 0.11.0';
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('AgentAPI');
    });

    it('should mark AgentAPI as missing when not installed', async () => {
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('agentapi')) throw new Error('Not found');
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('❌ AgentAPI');
    });

    it('should list all agents with status', async () => {
      (execSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Claude Code');
      expect(result).toContain('Aider');
    });

    it('should show ✅ for installed agents', async () => {
      (execSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('✅');
    });

    it('should show ⬚ for missing agents', async () => {
      mockRegistry.discoverInstalled = () => ['claude']; // Only claude installed
      
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('claude')) return '';
        throw new Error('Not found');
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('⬚');
    });

    it('should check config directory', async () => {
      (execSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Config');
    });

    it('should show warning when config missing', async () => {
      (execSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(false);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('⚠️');
    });

    it('should include summary', async () => {
      (execSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('Summary');
      expect(result).toContain('✅');
    });

    it('should warn when no agents installed (but core tools present)', async () => {
      mockRegistry.discoverInstalled = () => [];
      
      (execSync as any).mockImplementation((cmd: string) => {
        // Core tools are present
        if (cmd.includes('git')) return 'git version 2.0.0';
        if (cmd.includes('tmux')) return 'tmux 3.0';
        if (cmd.includes('agentapi')) return 'agentapi version 0.11.0';
        return '';
      });
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('at least one');
    });

    it('should show success message when all pass', async () => {
      (execSync as any).mockReturnValue('');
      (existsSync as any).mockReturnValue(true);

      const result = await runPrerequisitesCheck(mockRegistry);
      
      expect(result).toContain('All prerequisites satisfied');
    });

    it('should handle timeout on slow commands', async () => {
      (execSync as any).mockImplementation(() => {
        throw new Error('ETIMEDOUT');
      });
      (existsSync as any).mockReturnValue(true);

      // Should not throw
      const result = await runPrerequisitesCheck(mockRegistry);
      expect(result).toBeDefined();
    });
  });
});
