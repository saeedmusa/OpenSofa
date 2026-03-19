/**
 * Tests for File Routes
 * 
 * Tests for path validation and file operations in files.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectLanguage, isPathWithinDir, formatFileSize } from '../../src/web/routes/files.js';

describe('files routes utilities', () => {
  describe('detectLanguage', () => {
    it('should detect TypeScript', () => {
      expect(detectLanguage('file.ts')).toBe('typescript');
      expect(detectLanguage('file.tsx')).toBe('typescript');
    });

    it('should detect JavaScript', () => {
      expect(detectLanguage('file.js')).toBe('javascript');
      expect(detectLanguage('file.jsx')).toBe('javascript');
    });

    it('should detect JSON', () => {
      expect(detectLanguage('file.json')).toBe('json');
    });

    it('should detect YAML', () => {
      expect(detectLanguage('file.yaml')).toBe('yaml');
      expect(detectLanguage('file.yml')).toBe('yaml');
    });

    it('should detect Markdown', () => {
      expect(detectLanguage('file.md')).toBe('markdown');
    });

    it('should detect Python', () => {
      expect(detectLanguage('file.py')).toBe('python');
    });

    it('should detect Go', () => {
      expect(detectLanguage('file.go')).toBe('go');
    });

    it('should detect Rust', () => {
      expect(detectLanguage('file.rs')).toBe('rust');
    });

    it('should detect C/C++', () => {
      expect(detectLanguage('file.c')).toBe('c');
      expect(detectLanguage('file.cpp')).toBe('cpp');
      expect(detectLanguage('file.h')).toBe('c');
      expect(detectLanguage('file.hpp')).toBe('cpp');
    });

    it('should detect CSS/SCSS', () => {
      expect(detectLanguage('file.css')).toBe('css');
      expect(detectLanguage('file.scss')).toBe('scss');
    });

    it('should detect HTML/XML', () => {
      expect(detectLanguage('file.html')).toBe('html');
      expect(detectLanguage('file.xml')).toBe('xml');
    });

    it('should detect SQL', () => {
      expect(detectLanguage('file.sql')).toBe('sql');
    });

    it('should detect Shell', () => {
      expect(detectLanguage('file.sh')).toBe('bash');
      expect(detectLanguage('file.bash')).toBe('bash');
      expect(detectLanguage('file.zsh')).toBe('bash');
    });

    it('should return plaintext for unknown extensions', () => {
      expect(detectLanguage('file.txt')).toBe('plaintext');
      expect(detectLanguage('file.unknown')).toBe('plaintext');
      expect(detectLanguage('file')).toBe('plaintext');
    });

    it('should handle uppercase extensions', () => {
      expect(detectLanguage('file.TS')).toBe('typescript');
      expect(detectLanguage('file.JS')).toBe('javascript');
    });
  });

  describe('isPathWithinDir', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opensofa-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return true for paths within directory', () => {
      const subdir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subdir);
      
      expect(isPathWithinDir(subdir, tempDir)).toBe(true);
      expect(isPathWithinDir(path.join(tempDir, 'file.txt'), tempDir)).toBe(true);
    });

    it('should return true for exact match', () => {
      expect(isPathWithinDir(tempDir, tempDir)).toBe(true);
    });

    it('should return false for paths outside directory', () => {
      const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opensofa-other-'));
      
      try {
        expect(isPathWithinDir(otherDir, tempDir)).toBe(false);
        expect(isPathWithinDir('/etc/passwd', tempDir)).toBe(false);
      } finally {
        fs.rmSync(otherDir, { recursive: true, force: true });
      }
    });

    it('should handle path traversal attempts', () => {
      const maliciousPath = path.join(tempDir, '..', '..', 'etc', 'passwd');
      expect(isPathWithinDir(maliciousPath, tempDir)).toBe(false);
    });

    it('should normalize paths', () => {
      const subdir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subdir);
      
      expect(isPathWithinDir(path.join(subdir, 'file.txt'), tempDir)).toBe(true);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0B');
      expect(formatFileSize(100)).toBe('100B');
      expect(formatFileSize(1023)).toBe('1023B');
    });

    it('should format KB', () => {
      expect(formatFileSize(1024)).toBe('1.0KB');
      expect(formatFileSize(1536)).toBe('1.5KB');
      expect(formatFileSize(10240)).toBe('10.0KB');
    });

    it('should format MB', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0MB');
      expect(formatFileSize(1024 * 1024 * 5)).toBe('5.0MB');
      expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5MB');
    });

    it('should handle large files', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1024.0MB');
    });
  });
});
