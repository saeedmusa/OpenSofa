/**
 * Extended Tests for Command Parser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CommandParser, isCommand } from '../src/command-parser.js';

describe('CommandParser Extended', () => {
  let parser: CommandParser;

  beforeEach(() => {
    parser = new CommandParser('claude');
  });

  describe('parseControlCommand()', () => {
    describe('/new command variations', () => {
      it('should parse /new with name and dir', () => {
        const cmd = parser.parseControlCommand('/new frontend ~/project');
        expect(cmd).toEqual({
          cmd: 'new',
          name: 'frontend',
          dir: '~/project',
          agent: 'claude',
          model: '',
        });
      });

      it('should parse /new with name, dir, and agent', () => {
        const cmd = parser.parseControlCommand('/new api ~/myapi aider');
        expect(cmd).toEqual({
          cmd: 'new',
          name: 'api',
          dir: '~/myapi',
          agent: 'aider',
          model: '',
        });
      });

      it('should parse /new with name, dir, agent, and model', () => {
        const cmd = parser.parseControlCommand('/new api ~/myapi claude sonnet');
        expect(cmd).toEqual({
          cmd: 'new',
          name: 'api',
          dir: '~/myapi',
          agent: 'claude',
          model: 'sonnet',
        });
      });

      it('should parse /new wizard (bare)', () => {
        const cmd = parser.parseControlCommand('/new');
        expect(cmd).toEqual({ cmd: 'new_wizard' });
      });

      it('should handle extra whitespace in /new', () => {
        const cmd = parser.parseControlCommand('/new  test  ~/project  aider');
        expect(cmd).not.toBeNull();
      });
    });

    describe('/stop command variations', () => {
      it('should parse /stop with name', () => {
        const cmd = parser.parseControlCommand('/stop frontend');
        expect(cmd).toEqual({ cmd: 'stop', name: 'frontend' });
      });

      it('should parse /stop all', () => {
        const cmd = parser.parseControlCommand('/stop all');
        expect(cmd).toEqual({ cmd: 'stop_all' });
      });

      it('should parse /stop ALL (case insensitive)', () => {
        const cmd = parser.parseControlCommand('/stop ALL');
        expect(cmd).toEqual({ cmd: 'stop_all' });
      });
    });

    describe('/status command', () => {
      it('should parse /status without name', () => {
        const cmd = parser.parseControlCommand('/status');
        expect(cmd).toEqual({ cmd: 'status', name: undefined });
      });

      it('should parse /status with name', () => {
        const cmd = parser.parseControlCommand('/status frontend');
        expect(cmd).toEqual({ cmd: 'status', name: 'frontend' });
      });
    });

    describe('/restart command', () => {
      it('should parse /restart with name', () => {
        const cmd = parser.parseControlCommand('/restart frontend');
        expect(cmd).toEqual({ cmd: 'restart', name: 'frontend' });
      });
    });

    describe('/set command', () => {
      it('should parse /set autoyes', () => {
        const cmd = parser.parseControlCommand('/set frontend autoyes');
        expect(cmd).toEqual({
          cmd: 'set',
          name: 'frontend',
          key: 'autoyes',
          value: '',
        });
      });

      it('should parse /set autoyes on', () => {
        const cmd = parser.parseControlCommand('/set frontend autoyes on');
        expect(cmd).toEqual({
          cmd: 'set',
          name: 'frontend',
          key: 'autoyes',
          value: 'on',
        });
      });

      it('should parse /set agent', () => {
        const cmd = parser.parseControlCommand('/set frontend agent aider');
        expect(cmd).toEqual({
          cmd: 'set',
          name: 'frontend',
          key: 'agent',
          value: 'aider',
        });
      });

      it('should parse /set agent with model', () => {
        const cmd = parser.parseControlCommand('/set frontend agent claude sonnet');
        expect(cmd).toEqual({
          cmd: 'set',
          name: 'frontend',
          key: 'agent',
          value: 'claude sonnet',
        });
      });

      it('should parse /set dir', () => {
        const cmd = parser.parseControlCommand('/set frontend dir ~/newdir');
        expect(cmd).toEqual({
          cmd: 'set',
          name: 'frontend',
          key: 'dir',
          value: '~/newdir',
        });
      });
    });

    describe('other commands', () => {
      it('should parse /list', () => {
        const cmd = parser.parseControlCommand('/list');
        expect(cmd).toEqual({ cmd: 'list' });
      });

      it('should parse /agents', () => {
        const cmd = parser.parseControlCommand('/agents');
        expect(cmd).toEqual({ cmd: 'agents' });
      });

      it('should parse /web', () => {
        const cmd = parser.parseControlCommand('/web');
        expect(cmd).toEqual({ cmd: 'web' });
      });

      it('should parse /check', () => {
        const cmd = parser.parseControlCommand('/check');
        expect(cmd).toEqual({ cmd: 'check' });
      });

      it('should parse /help', () => {
        const cmd = parser.parseControlCommand('/help');
        expect(cmd).toEqual({ cmd: 'help' });
      });

      it('should parse /cancel', () => {
        const cmd = parser.parseControlCommand('/cancel');
        expect(cmd).toEqual({ cmd: 'cancel' });
      });
    });

    describe('edge cases', () => {
      it('should return null for non-command text', () => {
        const cmd = parser.parseControlCommand('hello world');
        expect(cmd).toBeNull();
      });

      it('should return null for unknown command', () => {
        const cmd = parser.parseControlCommand('/unknown');
        expect(cmd).toBeNull();
      });

      it('should handle case insensitivity', () => {
        const cmd = parser.parseControlCommand('/NEW test ~/project CLAUDE');
        expect(cmd).not.toBeNull();
        expect((cmd as any).cmd).toBe('new');
      });

      it('should handle leading/trailing whitespace', () => {
        const cmd = parser.parseControlCommand('  /list  ');
        expect(cmd).toEqual({ cmd: 'list' });
      });

      it('should return null for empty string', () => {
        const cmd = parser.parseControlCommand('');
        expect(cmd).toBeNull();
      });
    });
  });

  describe('parseSessionCommand()', () => {
    it('should parse /stop', () => {
      const cmd = parser.parseSessionCommand('/stop');
      expect(cmd).toEqual({ cmd: 'stop' });
    });

    it('should parse /approve', () => {
      const cmd = parser.parseSessionCommand('/approve');
      expect(cmd).toEqual({ cmd: 'approve' });
    });

    it('should parse /reject', () => {
      const cmd = parser.parseSessionCommand('/reject');
      expect(cmd).toEqual({ cmd: 'reject' });
    });

    it('should parse /rollback', () => {
      const cmd = parser.parseSessionCommand('/rollback');
      expect(cmd).toEqual({ cmd: 'rollback' });
    });

    it('should parse /screenshot', () => {
      const cmd = parser.parseSessionCommand('/screenshot');
      expect(cmd).toEqual({ cmd: 'screenshot' });
    });

    it('should parse /full', () => {
      const cmd = parser.parseSessionCommand('/full');
      expect(cmd).toEqual({ cmd: 'full' });
    });

    it('should parse /help', () => {
      const cmd = parser.parseSessionCommand('/help');
      expect(cmd).toEqual({ cmd: 'help' });
    });

    it('should return null for non-command', () => {
      const cmd = parser.parseSessionCommand('regular message');
      expect(cmd).toBeNull();
    });

    it('should return null for control commands in session context', () => {
      const cmd = parser.parseSessionCommand('/new');
      expect(cmd).toBeNull();
    });

    it('should handle case insensitivity', () => {
      const cmd = parser.parseSessionCommand('/APPROVE');
      expect(cmd).toEqual({ cmd: 'approve' });
    });
  });

  describe('isCommand()', () => {
    it('should return true for commands', () => {
      expect(isCommand('/new')).toBe(true);
      expect(isCommand('/help')).toBe(true);
      expect(isCommand('/stop')).toBe(true);
    });

    it('should return false for non-commands', () => {
      expect(isCommand('hello')).toBe(false);
      expect(isCommand('')).toBe(false);
      expect(isCommand('not a command')).toBe(false);
    });

    it('should trim whitespace and still detect commands', () => {
      // The implementation trims input, so ' /new' becomes '/new'
      expect(isCommand(' /new')).toBe(true);
      expect(isCommand('  /help')).toBe(true);
    });
  });

  describe('getHelpText()', () => {
    it('should return help text', () => {
      const help = parser.getHelpText();
      expect(help).toContain('OpenSofa Commands');
      expect(help).toContain('/new');
      expect(help).toContain('/help');
    });

    it('should include quick start section', () => {
      const help = parser.getHelpText();
      expect(help).toContain('Quick Start');
    });

    it('should include all control commands', () => {
      const help = parser.getHelpText();
      expect(help).toContain('/agents');
      expect(help).toContain('/check');
      expect(help).toContain('/web');
      expect(help).toContain('/list');
      expect(help).toContain('/status');
      expect(help).toContain('/stop');
      expect(help).toContain('/restart');
      expect(help).toContain('/set');
    });

    it('should include session commands', () => {
      const help = parser.getHelpText();
      expect(help).toContain('/approve');
      expect(help).toContain('/reject');
      expect(help).toContain('/screenshot');
      expect(help).toContain('/rollback');
      expect(help).toContain('/full');
    });
  });

  describe('getSessionHelpText()', () => {
    it('should return session help text', () => {
      const help = parser.getSessionHelpText();
      expect(help).toContain('Session Commands');
    });

    it('should include all session commands', () => {
      const help = parser.getSessionHelpText();
      expect(help).toContain('/stop');
      expect(help).toContain('/approve');
      expect(help).toContain('/reject');
      expect(help).toContain('/screenshot');
      expect(help).toContain('/full');
    });
  });
});
