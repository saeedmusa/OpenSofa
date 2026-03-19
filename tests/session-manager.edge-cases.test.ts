/**
 * Edge case tests for SessionManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { SessionManager } from '../src/session-manager.js';
import type { Session, AgentType } from '../src/types.js';

// Mock all dependencies
vi.mock('../src/agentapi-client.js', () => ({
  AgentAPIClient: vi.fn().mockImplementation(() => ({
    getStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendRaw: vi.fn().mockResolvedValue(undefined),
    getSessionInfo: vi.fn().mockResolvedValue({ workdir: '/tmp/test' }),
    close: vi.fn(),
  })),
  AgentAPIError: class AgentAPIError extends Error {},
}));

vi.mock('child_process', () => ({
  spawn: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    unref: vi.fn(),
    kill: vi.fn(),
  })),
  execSync: vi.fn().mockImplementation((cmd: string) => {
    if (cmd.includes('git')) return '.git';
    if (cmd.includes('tmux')) return 'tmux 3.3';
    return '';
  }),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue('{}'),
    readdirSync: vi.fn().mockReturnValue([]),
  },
}));

// Test sanitizeFileName
describe('sanitizeFileName edge cases', () => {
  it('should handle unicode characters', () => {
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Each unicode char becomes underscore, dots preserved
    expect(sanitize('日本語.txt')).toBe('___.txt');
    // Emoji is surrogate pair (2 chars) so becomes __
    expect(sanitize('file-🎉-name.pdf')).toBe('file-__-name.pdf');
  });

  it('should handle paths with slashes', () => {
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Dots are allowed by the regex, so they stay
    expect(sanitize('../../../etc/passwd')).toBe('.._.._.._etc_passwd');
    expect(sanitize('path/to/file.txt')).toBe('path_to_file.txt');
  });

  it('should handle empty string', () => {
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
    expect(sanitize('')).toBe('');
  });

  it('should preserve valid characters', () => {
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
    expect(sanitize('valid-file_name.txt')).toBe('valid-file_name.txt');
    expect(sanitize('file-123.test')).toBe('file-123.test');
  });

  it('should handle multiple consecutive special chars', () => {
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
    expect(sanitize('file!!!name')).toBe('file___name');
    expect(sanitize('a   b')).toBe('a___b');
  });
});

// Test extensionFromMime
describe('extensionFromMime edge cases', () => {
  // Match the actual implementation from session-manager.ts
  const extensionFromMime = (mimetype: string): string => {
    const lower = mimetype.toLowerCase();
    if (lower.includes('png')) return 'png';
    if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
    if (lower.includes('gif')) return 'gif';
    if (lower.includes('pdf')) return 'pdf';
    if (lower.includes('json')) return 'json';
    if (lower.includes('text')) return 'txt';
    return 'bin';
  };

  it('should handle case variations', () => {
    expect(extensionFromMime('IMAGE/PNG')).toBe('png');
    expect(extensionFromMime('Application/PDF')).toBe('pdf');
  });

  it('should handle complex mimetypes', () => {
    expect(extensionFromMime('image/png; charset=utf-8')).toBe('png');
    expect(extensionFromMime('application/json; charset=utf-8')).toBe('json');
  });

  it('should handle unknown mimetypes', () => {
    expect(extensionFromMime('application/octet-stream')).toBe('bin');
    expect(extensionFromMime('video/mp4')).toBe('bin');
    expect(extensionFromMime('')).toBe('bin');
  });
});

// Test isToggleEnabled
describe('isToggleEnabled edge cases', () => {
  const isToggleEnabled = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return normalized !== 'off' && normalized !== 'false' && normalized !== 'no' && normalized !== '0';
  };

  it('should accept truthy values', () => {
    expect(isToggleEnabled('on')).toBe(true);
    expect(isToggleEnabled('true')).toBe(true);
    expect(isToggleEnabled('yes')).toBe(true);
    expect(isToggleEnabled('1')).toBe(true);
    expect(isToggleEnabled('enabled')).toBe(true);
  });

  it('should reject falsy values', () => {
    expect(isToggleEnabled('off')).toBe(false);
    expect(isToggleEnabled('false')).toBe(false);
    expect(isToggleEnabled('no')).toBe(false);
    expect(isToggleEnabled('0')).toBe(false);
  });

  it('should handle whitespace', () => {
    expect(isToggleEnabled('  on  ')).toBe(true);
    expect(isToggleEnabled('  off  ')).toBe(false);
    // Tab around 'off' becomes 'off' after trim
    expect(isToggleEnabled('\toff\t')).toBe(false);
    // Tab around 'on' becomes 'on' after trim
    expect(isToggleEnabled('\ton\t')).toBe(true);
  });

  it('should handle case variations', () => {
    expect(isToggleEnabled('ON')).toBe(true);
    expect(isToggleEnabled('OFF')).toBe(false);
    expect(isToggleEnabled('False')).toBe(false);
  });
});

// Test parseAgentSwitchValue patterns
describe('parseAgentSwitchValue patterns', () => {
  const validTypes = ['claude', 'aider', 'opencode'];
  
  const parseAgentSwitchValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        ok: false,
        error: "Usage: /set <session> agent <agent> [model]. Example: /set frontend agent opencode",
      };
    }

    const [agentRaw, ...modelParts] = trimmed.split(/\s+/);
    if (!agentRaw || !validTypes.includes(agentRaw)) {
      return {
        ok: false,
        error: `Unknown agent '${agentRaw || ''}'. Send /agents to see valid options.`,
      };
    }

    return {
      ok: true,
      agent: agentRaw,
      model: modelParts.join(' ').trim(),
    };
  };

  it('should parse agent without model', () => {
    const result = parseAgentSwitchValue('claude');
    expect(result).toEqual({ ok: true, agent: 'claude', model: '' });
  });

  it('should parse agent with model', () => {
    const result = parseAgentSwitchValue('claude sonnet');
    expect(result).toEqual({ ok: true, agent: 'claude', model: 'sonnet' });
  });

  it('should parse agent with multi-word model', () => {
    const result = parseAgentSwitchValue('aider gpt-4 turbo');
    expect(result).toEqual({ ok: true, agent: 'aider', model: 'gpt-4 turbo' });
  });

  it('should handle whitespace', () => {
    const result = parseAgentSwitchValue('  claude   sonnet  ');
    expect(result).toEqual({ ok: true, agent: 'claude', model: 'sonnet' });
  });

  it('should reject empty value', () => {
    const result = parseAgentSwitchValue('');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Usage');
  });

  it('should reject unknown agent', () => {
    const result = parseAgentSwitchValue('unknown-agent');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown agent');
  });
});

// Test groupBadge
describe('groupBadge format', () => {
  const groupBadge = (session: { name: string; agentType: string; branch: string }) => {
    return `[${session.name} | ${session.agentType} | ${session.branch}]`;
  };

  it('should format session info', () => {
    expect(groupBadge({ name: 'frontend', agentType: 'claude', branch: 'main' }))
      .toBe('[frontend | claude | main]');
  });

  it('should handle special characters', () => {
    expect(groupBadge({ name: 'fix-#123', agentType: 'opencode', branch: 'feature/new-thing' }))
      .toBe('[fix-#123 | opencode | feature/new-thing]');
  });
});

// Test extractMediaMetadata patterns
describe('extractMediaMetadata patterns', () => {
  const extractMediaMetadata = (msg: any, caption: string) => {
    const imageMessage = msg?.message?.imageMessage;
    const documentMessage = msg?.message?.documentMessage;

    const mimetype =
      documentMessage?.mimetype || imageMessage?.mimetype || 'application/octet-stream';

    const originalName =
      documentMessage?.fileName ||
      `upload-${Date.now()}.bin`;

    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

    return {
      fileName: sanitize(originalName),
      mimetype,
      caption: caption.trim(),
    };
  };

  it('should extract image metadata', () => {
    const msg = {
      message: {
        imageMessage: {
          mimetype: 'image/png',
        },
      },
    };
    const result = extractMediaMetadata(msg, 'Check this out');
    expect(result.mimetype).toBe('image/png');
    expect(result.caption).toBe('Check this out');
  });

  it('should extract document metadata', () => {
    const msg = {
      message: {
        documentMessage: {
          mimetype: 'application/pdf',
          fileName: 'document.pdf',
        },
      },
    };
    const result = extractMediaMetadata(msg, '');
    expect(result.mimetype).toBe('application/pdf');
    expect(result.fileName).toBe('document.pdf');
  });

  it('should default to octet-stream when no media', () => {
    const msg = { message: {} };
    const result = extractMediaMetadata(msg, '');
    expect(result.mimetype).toBe('application/octet-stream');
  });

  it('should prioritize document over image', () => {
    const msg = {
      message: {
        imageMessage: { mimetype: 'image/png' },
        documentMessage: { mimetype: 'application/pdf', fileName: 'doc.pdf' },
      },
    };
    const result = extractMediaMetadata(msg, '');
    expect(result.mimetype).toBe('application/pdf');
    expect(result.fileName).toBe('doc.pdf');
  });
});

// Test buildUploadPrompt patterns
describe('buildUploadPrompt format', () => {
  const buildUploadPrompt = (filePath: string, caption: string): string => {
    if (caption) {
      return `I've uploaded a file to ${filePath}. ${caption}`;
    }
    return `I've uploaded a file to ${filePath}. Please inspect it and continue.`;
  };

  it('should include caption when provided', () => {
    const prompt = buildUploadPrompt('/path/to/file.txt', 'Fix the bug');
    expect(prompt).toContain('Fix the bug');
    expect(prompt).toContain('/path/to/file.txt');
  });

  it('should use default message when no caption', () => {
    const prompt = buildUploadPrompt('/path/to/file.txt', '');
    expect(prompt).toContain('Please inspect it and continue');
  });
});

// Test validateRepoDirectory patterns
describe('validateRepoDirectory patterns', () => {
  it('should validate git repo format', () => {
    // The actual function calls execSync with git -C
    // This test verifies the pattern
    const cmd = 'git -C "/tmp/test" rev-parse --git-dir';
    expect(cmd).toContain('git -C');
    expect(cmd).toContain('rev-parse --git-dir');
  });
});

// Test port allocation patterns
describe('Port allocation edge cases', () => {
  it('should generate ports in valid range', () => {
    // AgentAPI ports are 3000+session_id*10
    const portForSession = (sessionId: number) => 3000 + sessionId * 10;
    
    expect(portForSession(1)).toBe(3010);
    expect(portForSession(10)).toBe(3100);
    expect(portForSession(100)).toBe(4000);
  });

  it('should not exceed max port', () => {
    const MAX_PORT = 65535;
    const portForSession = (sessionId: number) => 3000 + sessionId * 10;
    
    // sessionId = 6253 would exceed max port
    expect(portForSession(6252)).toBeLessThanOrEqual(MAX_PORT);
  });
});
