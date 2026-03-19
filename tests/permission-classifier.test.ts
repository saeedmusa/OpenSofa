/**
 * Tests for Permission Classifier
 */

import { describe, it, expect } from 'vitest';
import { PermissionClassifier } from '../src/permission-classifier.js';

describe('PermissionClassifier', () => {
  const classifier = new PermissionClassifier();

  describe('isApprovalRequest', () => {
    it('should detect "Do you want to proceed?" pattern', () => {
      expect(classifier.isApprovalRequest('Do you want to proceed?')).toBe(true);
      expect(classifier.isApprovalRequest('Do you want to proceed with this change?')).toBe(true);
    });

    it('should detect "Would you like to" pattern', () => {
      expect(classifier.isApprovalRequest('Would you like to continue?')).toBe(true);
      expect(classifier.isApprovalRequest('Would you like to apply these changes?')).toBe(true);
    });

    it('should detect Claude Code specific patterns', () => {
      expect(classifier.isApprovalRequest('Shall I proceed with this change?')).toBe(true);
      expect(classifier.isApprovalRequest('May I edit this file?')).toBe(true);
      expect(classifier.isApprovalRequest("I'd like to run: npm install")).toBe(true);
      expect(classifier.isApprovalRequest('Allow this action?')).toBe(true);
    });

    it('should detect Aider patterns', () => {
      expect(classifier.isApprovalRequest('Run npm test? (Y)es')).toBe(true);
      expect(classifier.isApprovalRequest('Allow edit to src/main.ts')).toBe(true);
      expect(classifier.isApprovalRequest('Add src/utils.ts to the chat?')).toBe(true);
    });

    it('should detect "(yes/no)" pattern', () => {
      expect(classifier.isApprovalRequest('Do you want to continue (yes/no)?')).toBe(true);
      expect(classifier.isApprovalRequest('(yes/no)')).toBe(true);
    });

    it('should detect "(y/n)" pattern', () => {
      expect(classifier.isApprovalRequest('Continue (y/n)?')).toBe(true);
      expect(classifier.isApprovalRequest('(y/n)')).toBe(true);
    });

    it('should detect [Y/n] patterns', () => {
      expect(classifier.isApprovalRequest('Continue? [Y/n]')).toBe(true);
      expect(classifier.isApprovalRequest('[Y/n]')).toBe(true);
    });

    it('should NOT detect approval in normal conversation', () => {
      expect(classifier.isApprovalRequest('I will now create the file')).toBe(false);
      expect(classifier.isApprovalRequest('This will allow faster builds')).toBe(false);
      expect(classifier.isApprovalRequest('Here is the implementation')).toBe(false);
      expect(classifier.isApprovalRequest('Can I use React for this?')).toBe(false);
      expect(classifier.isApprovalRequest('Can I refactor this function?')).toBe(false);
    });

    it('should detect "Can I" only with action verbs', () => {
      expect(classifier.isApprovalRequest('Can I run this command?')).toBe(true);
      expect(classifier.isApprovalRequest('Can I delete this file?')).toBe(true);
      expect(classifier.isApprovalRequest('Can I install express?')).toBe(true);
      // Normal questions should NOT match
      expect(classifier.isApprovalRequest('Can I use TypeScript?')).toBe(false);
      expect(classifier.isApprovalRequest('Can I help you with something?')).toBe(false);
    });

    it('should NOT detect bare words that are too generic', () => {
      // These should NOT trigger approval detection
      expect(classifier.isApprovalRequest('I approve of this design')).toBe(false);
      expect(classifier.isApprovalRequest('This allows better performance')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(classifier.isApprovalRequest('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(classifier.isApprovalRequest('DO YOU WANT TO PROCEED?')).toBe(true);
      expect(classifier.isApprovalRequest('would you like to continue?')).toBe(true);
    });
  });

  describe('extractCommand', () => {
    it('should extract command from "I\'d like to run:" pattern', () => {
      const cmd = classifier.extractCommand("I'd like to run: npm install express");
      expect(cmd).toBe('npm install express');
    });

    it('should extract command from backtick pattern', () => {
      const cmd = classifier.extractCommand('Run `npm test`?');
      expect(cmd).toBe('npm test');
    });

    it('should extract command from shell prompt', () => {
      const cmd = classifier.extractCommand('$ git push origin main');
      expect(cmd).toBe('git push origin main');
    });

    it('should return null when no command found', () => {
      const cmd = classifier.extractCommand('Do you want to proceed?');
      expect(cmd).toBeNull();
    });
  });

  describe('classify', () => {
    it('should return both detection and command', () => {
      const result = classifier.classify("I'd like to run: npm install");
      expect(result.isApproval).toBe(true);
      expect(result.command).toBe('npm install');
    });

    it('should return false and null for non-approval', () => {
      const result = classifier.classify('Here is the code');
      expect(result.isApproval).toBe(false);
      expect(result.command).toBeNull();
    });
  });
});