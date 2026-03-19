/**
 * Tests for Command Parser
 */

import { describe, it, expect } from 'vitest';
import { CommandParser, isCommand } from '../src/command-parser.js';

describe('CommandParser', () => {
  const parser = new CommandParser('claude');

  describe('parseControlCommand', () => {
    it('should parse /new command with all arguments', () => {
      const result = parser.parseControlCommand('/new frontend ~/myapp claude');
      expect(result).toEqual({
        cmd: 'new',
        name: 'frontend',
        dir: '~/myapp',
        agent: 'claude',
        model: '',
      });
    });

    it('should parse /new command with agent and model', () => {
      const result = parser.parseControlCommand('/new frontend ~/myapp claude sonnet');
      expect(result).toEqual({
        cmd: 'new',
        name: 'frontend',
        dir: '~/myapp',
        agent: 'claude',
        model: 'sonnet',
      });
    });

    it('should parse /new command with default agent', () => {
      const result = parser.parseControlCommand('/new backend ~/myapp');
      expect(result).toEqual({
        cmd: 'new',
        name: 'backend',
        dir: '~/myapp',
        agent: 'claude', // default
        model: '',
      });
    });

    it('should parse /agents command', () => {
      const result = parser.parseControlCommand('/agents');
      expect(result).toEqual({ cmd: 'agents' });
    });

    it('should parse /web command', () => {
      const result = parser.parseControlCommand('/web');
      expect(result).toEqual({ cmd: 'web' });
    });

    it('should parse /stop command', () => {
      const result = parser.parseControlCommand('/stop frontend');
      expect(result).toEqual({
        cmd: 'stop',
        name: 'frontend',
      });
    });

    it('should parse /stop all command', () => {
      const result = parser.parseControlCommand('/stop all');
      expect(result).toEqual({
        cmd: 'stop_all',
      });
    });

    it('should parse /list command', () => {
      const result = parser.parseControlCommand('/list');
      expect(result).toEqual({ cmd: 'list' });
    });

    it('should parse /status command', () => {
      const result = parser.parseControlCommand('/status');
      expect(result).toEqual({ cmd: 'status' });
    });

    it('should parse /status with name', () => {
      const result = parser.parseControlCommand('/status frontend');
      expect(result).toEqual({
        cmd: 'status',
        name: 'frontend',
      });
    });

    it('should parse /restart with name', () => {
      const result = parser.parseControlCommand('/restart frontend');
      expect(result).toEqual({
        cmd: 'restart',
        name: 'frontend',
      });
    });

    it('should parse /help command', () => {
      const result = parser.parseControlCommand('/help');
      expect(result).toEqual({ cmd: 'help' });
    });

    it('should parse /set command with value', () => {
      const result = parser.parseControlCommand('/set frontend autoyes on');
      expect(result).toEqual({
        cmd: 'set',
        name: 'frontend',
        key: 'autoyes',
        value: 'on',
      });
    });

    it('should parse /set command without value (toggle)', () => {
      const result = parser.parseControlCommand('/set frontend autoyes');
      expect(result).toEqual({
        cmd: 'set',
        name: 'frontend',
        key: 'autoyes',
        value: '',
      });
    });

    it('should return null for invalid commands', () => {
      expect(parser.parseControlCommand('/invalid')).toBeNull();
      expect(parser.parseControlCommand('not a command')).toBeNull();
    });

    it('should be case-insensitive', () => {
      const result = parser.parseControlCommand('/NEW test ~/repo');
      expect(result).toEqual({
        cmd: 'new',
        name: 'test',
        dir: '~/repo',
        agent: 'claude',
        model: '',
      });
    });
  });

  describe('parseSessionCommand', () => {
    it('should parse /stop command', () => {
      const result = parser.parseSessionCommand('/stop');
      expect(result).toEqual({ cmd: 'stop' });
    });

    it('should parse /approve command', () => {
      const result = parser.parseSessionCommand('/approve');
      expect(result).toEqual({ cmd: 'approve' });
    });

    it('should parse /reject command', () => {
      const result = parser.parseSessionCommand('/reject');
      expect(result).toEqual({ cmd: 'reject' });
    });

    it('should parse /rollback command', () => {
      const result = parser.parseSessionCommand('/rollback');
      expect(result).toEqual({ cmd: 'rollback' });
    });

    it('should parse /screenshot command', () => {
      const result = parser.parseSessionCommand('/screenshot');
      expect(result).toEqual({ cmd: 'screenshot' });
    });

    it('should parse /full command', () => {
      const result = parser.parseSessionCommand('/full');
      expect(result).toEqual({ cmd: 'full' });
    });

    it('should parse /help command', () => {
      const result = parser.parseSessionCommand('/help');
      expect(result).toEqual({ cmd: 'help' });
    });

    it('should return null for invalid commands', () => {
      expect(parser.parseSessionCommand('/invalid')).toBeNull();
      expect(parser.parseSessionCommand('not a command')).toBeNull();
    });
  });

  describe('getHelpText', () => {
    it('should return non-empty help text', () => {
      const help = parser.getHelpText();
      expect(help).toContain('/new');
      expect(help).toContain('/stop');
      expect(help).toContain('/list');
      expect(help).toContain('/help');
      expect(help).toContain('/web');
    });
  });

  describe('getSessionHelpText', () => {
    it('should return non-empty session help text', () => {
      const help = parser.getSessionHelpText();
      expect(help).toContain('/stop');
      expect(help).toContain('/approve');
      expect(help).toContain('/reject');
    });
  });
});

describe('isCommand', () => {
  it('should return true for commands starting with /', () => {
    expect(isCommand('/help')).toBe(true);
    expect(isCommand('/new test ~/repo')).toBe(true);
    expect(isCommand('/STATUS')).toBe(true);
  });

  it('should return false for non-commands', () => {
    expect(isCommand('help')).toBe(false);
    expect(isCommand('regular message')).toBe(false);
    expect(isCommand('')).toBe(false);
  });
});