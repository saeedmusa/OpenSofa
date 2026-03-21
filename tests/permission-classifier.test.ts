/**
 * Tests for Agent State Machine (replaces PermissionClassifier)
 */

import { describe, it, expect } from 'vitest';
import { AgentStateMachine } from '../src/agent-state-machine.js';

describe('AgentStateMachine', () => {
  const sm = new AgentStateMachine();

  describe('isApprovalRequest', () => {
    it('should detect [Y/n] patterns', () => {
      expect(sm.isApprovalRequest('Continue? [Y/n]')).toBe(true);
      expect(sm.isApprovalRequest('[Y/n]')).toBe(true);
    });

    it('should detect [y/N] patterns', () => {
      expect(sm.isApprovalRequest('Continue? [y/N]')).toBe(true);
    });

    it('should detect (yes/no) pattern', () => {
      expect(sm.isApprovalRequest('Do you want to continue (yes/no)?')).toBe(true);
    });

    it('should detect (Y)es pattern', () => {
      expect(sm.isApprovalRequest('Run npm test? (Y)es')).toBe(true);
    });

    it('should detect (y/n) pattern', () => {
      expect(sm.isApprovalRequest('Continue (y/n)?')).toBe(true);
    });

    it('should detect "Do you want to proceed"', () => {
      expect(sm.isApprovalRequest('Do you want to proceed?')).toBe(true);
      expect(sm.isApprovalRequest('Do you want to proceed with this change?')).toBe(true);
    });

    it('should detect "Allow this action"', () => {
      expect(sm.isApprovalRequest('Allow this action?')).toBe(true);
    });

    it('should detect "Press Enter to continue"', () => {
      expect(sm.isApprovalRequest('Press Enter to continue')).toBe(true);
    });

    it('should NOT detect approval in normal conversation', () => {
      expect(sm.isApprovalRequest('I will now create the file')).toBe(false);
      expect(sm.isApprovalRequest('This will allow faster builds')).toBe(false);
      expect(sm.isApprovalRequest('Here is the implementation')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(sm.isApprovalRequest('')).toBe(false);
    });
  });

  describe('extractCommand', () => {
    it('should extract command from backtick pattern', () => {
      const cmd = sm.extractCommand('Run `npm test`?');
      expect(cmd).toBe('npm test');
    });

    it('should extract command from shell prompt', () => {
      const cmd = sm.extractCommand('$ git push origin main');
      expect(cmd).toBe('git push origin main');
    });

    it('should return null when no command found', () => {
      const cmd = sm.extractCommand('Do you want to proceed?');
      expect(cmd).toBeNull();
    });
  });

  describe('classify', () => {
    it('should return both detection and command', () => {
      const result = sm.classify('Run `npm install`?');
      expect(result.isApproval).toBe(true);
      expect(result.command).toBe('npm install');
    });

    it('should return false and null for non-approval', () => {
      const result = sm.classify('Here is the code');
      expect(result.isApproval).toBe(false);
      expect(result.command).toBeNull();
    });
  });
});
