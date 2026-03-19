/**
 * Tests for Config Manager
 * Note: This is the "web-only" version - no allowedPhoneNumber required
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigManager } from '../src/config.js';

describe('ConfigManager', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opensofa-config-test-'));
    configPath = path.join(tempDir, 'config.yaml');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should create default config if file does not exist', () => {
      // When config file doesn't exist, it creates default config
      const config = ConfigManager.load(configPath);
      expect(config).toBeDefined();
      expect(fs.existsSync(configPath)).toBe(true);
      expect(config.get('defaultAgent')).toBe('claude');
    });

    it('should load valid config', () => {
      const yaml = `
defaultAgent: "claude"
maxSessions: 3
`;
      fs.writeFileSync(configPath, yaml);
      
      const config = ConfigManager.load(configPath);
      expect(config.get('defaultAgent')).toBe('claude');
      expect(config.get('maxSessions')).toBe(3);
    });

    it('should use defaults for missing optional fields', () => {
      const yaml = `
defaultAgent: "aider"
`;
      fs.writeFileSync(configPath, yaml);
      
      const config = ConfigManager.load(configPath);
      expect(config.get('defaultAgent')).toBe('aider');
      expect(config.get('maxSessions')).toBe(5);  // default
      expect(config.get('portRangeStart')).toBe(3284);  // default
      expect(config.get('debounceMs')).toBe(3000);  // default
      expect(config.get('autoApprove')).toBe(false);  // default
    });

    it('should throw for invalid defaultAgent', () => {
      const yaml = `
defaultAgent: "invalid-agent"
`;
      fs.writeFileSync(configPath, yaml);
      
      expect(() => ConfigManager.load(configPath)).toThrow('Invalid \'defaultAgent\'');
    });

    it('should throw for maxSessions out of range', () => {
      const yaml = `
maxSessions: 15
`;
      fs.writeFileSync(configPath, yaml);
      
      expect(() => ConfigManager.load(configPath)).toThrow('maxSessions');
    });

    it('should throw for invalid port', () => {
      const yaml = `
portRangeStart: 80
`;
      fs.writeFileSync(configPath, yaml);
      
      expect(() => ConfigManager.load(configPath)).toThrow('portRangeStart');
    });

    it('should validate screenshotFontSize bounds', () => {
      const yaml = `
screenshotFontSize: 5
`;
      fs.writeFileSync(configPath, yaml);
      
      expect(() => ConfigManager.load(configPath)).toThrow('screenshotFontSize');
    });

    it('should validate screenshotCols bounds', () => {
      const yaml = `
screenshotCols: 300
`;
      fs.writeFileSync(configPath, yaml);
      
      expect(() => ConfigManager.load(configPath)).toThrow('screenshotCols');
    });
  });

  describe('get', () => {
    it('should return config value by key', () => {
      const yaml = `
maxSessions: 3
`;
      fs.writeFileSync(configPath, yaml);
      
      const config = ConfigManager.load(configPath);
      expect(config.get('maxSessions')).toBe(3);
      expect(config.get('defaultAgent')).toBe('claude');  // default
    });
  });

  describe('getAll', () => {
    it('should return copy of all config', () => {
      const yaml = `
defaultAgent: "aider"
`;
      fs.writeFileSync(configPath, yaml);
      
      const config = ConfigManager.load(configPath);
      const all = config.getAll();
      expect(all.defaultAgent).toBe('aider');
      
      // Verify it's a copy (mutating the copy doesn't affect original)
      (all as any).defaultAgent = 'changed';
      expect(config.get('defaultAgent')).toBe('aider');
    });
  });

  describe('getConfigPath', () => {
    it('should return the config file path', () => {
      const yaml = `
defaultAgent: "claude"
`;
      fs.writeFileSync(configPath, yaml);
      
      const config = ConfigManager.load(configPath);
      expect(config.getConfigPath()).toBe(configPath);
    });
  });
});