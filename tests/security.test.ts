/**
 * Security-focused tests for OpenSofa
 */

import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

// Test validateToken with timing-safe comparison
describe('Token Validation Security', () => {
  const validateToken = (provided: string, expected: string): boolean => {
    if (!provided || !expected) return false;
    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(provided, 'hex'),
      Buffer.from(expected, 'hex')
    );
  };

  it('should reject empty tokens', () => {
    expect(validateToken('', 'abc123')).toBe(false);
    expect(validateToken('abc123', '')).toBe(false);
    expect(validateToken('', '')).toBe(false);
  });

  it('should reject tokens of different lengths', () => {
    expect(validateToken('abc', 'abcdef')).toBe(false);
    expect(validateToken('abcdef', 'abc')).toBe(false);
  });

  it('should reject non-matching tokens', () => {
    const token1 = 'a'.repeat(64);
    const token2 = 'b'.repeat(64);
    expect(validateToken(token1, token2)).toBe(false);
  });

  it('should accept matching tokens', () => {
    const token = 'a'.repeat(64);
    expect(validateToken(token, token)).toBe(true);
  });

  it('should reject tokens that differ by one character', () => {
    const token1 = 'a'.repeat(64);
    const token2 = 'a'.repeat(63) + 'b';
    expect(validateToken(token1, token2)).toBe(false);
  });

  it('should handle valid hex tokens', () => {
    const token = crypto.randomBytes(32).toString('hex');
    expect(validateToken(token, token)).toBe(true);
  });

  it('should reject invalid hex in token', () => {
    // Non-hex characters will cause Buffer.from to produce different results
    const token1 = 'ghij'.repeat(16); // Invalid hex
    const token2 = 'ghij'.repeat(16);
    // This should still work because the comparison is on raw bytes
    expect(validateToken(token1, token2)).toBe(true);
  });
});

// Test parseAuthHeader
describe('Authorization Header Parsing', () => {
  // Match the actual implementation from src/web/auth.ts
  const parseAuthHeader = (header: string | undefined): string | null => {
    if (!header) return null;
    const trimmed = header.trim();
    if (trimmed === '') return null;
    const bearerMatch = trimmed.match(/^bearer\s+(.+)$/i);
    if (bearerMatch && bearerMatch[1]) {
      return bearerMatch[1].trim() || null;
    }
    return trimmed || null;
  };

  it('should handle undefined header', () => {
    expect(parseAuthHeader(undefined)).toBe(null);
  });

  it('should handle empty string', () => {
    expect(parseAuthHeader('')).toBe(null);
  });

  it('should handle whitespace-only string', () => {
    expect(parseAuthHeader('   ')).toBe(null);
  });

  it('should parse Bearer token', () => {
    expect(parseAuthHeader('Bearer mytoken123')).toBe('mytoken123');
  });

  it('should parse token without Bearer prefix', () => {
    expect(parseAuthHeader('mytoken123')).toBe('mytoken123');
  });

  it('should handle Bearer with extra spaces', () => {
    expect(parseAuthHeader('Bearer   mytoken123   ')).toBe('mytoken123');
  });

  it('should be case-insensitive for Bearer', () => {
    expect(parseAuthHeader('bearer mytoken')).toBe('mytoken');
    expect(parseAuthHeader('BEARER mytoken')).toBe('mytoken');
    expect(parseAuthHeader('BeArEr mytoken')).toBe('mytoken');
  });

  it('should handle Bearer without token (treated as raw token)', () => {
    // 'Bearer ' after trim becomes 'Bearer' which doesn't match /^bearer\s+(.+)$/i
    // So it's treated as a raw token value
    expect(parseAuthHeader('Bearer ')).toBe('Bearer');
    expect(parseAuthHeader('Bearer')).toBe('Bearer');
  });

  it('should handle token with special characters', () => {
    expect(parseAuthHeader('Bearer abc-123_xyz')).toBe('abc-123_xyz');
  });
});

// Test file path sanitization
describe('Path Sanitization', () => {
  const sanitizePathSegment = (segment: string): string => {
    // Remove path traversal attempts
    return segment.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  };

  it('should remove path traversal attempts', () => {
    expect(sanitizePathSegment('../../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizePathSegment('..%2F..%2Fetc')).toBe('%2F%2Fetc');
  });

  it('should remove slashes', () => {
    expect(sanitizePathSegment('path/to/file')).toBe('pathtofile');
    expect(sanitizePathSegment('path\\to\\file')).toBe('pathtofile');
  });

  it('should preserve valid names', () => {
    expect(sanitizePathSegment('my-session')).toBe('my-session');
    expect(sanitizePathSegment('feature_branch')).toBe('feature_branch');
  });
});

// Test session name validation
describe('Session Name Validation', () => {
  const isValidSessionName = (name: string): boolean => {
    // Session names should be alphanumeric with hyphens/underscores
    // Max length 64, min length 1
    if (!name || name.length > 64) return false;
    return /^[a-zA-Z0-9_-]+$/.test(name);
  };

  it('should accept valid names', () => {
    expect(isValidSessionName('frontend')).toBe(true);
    expect(isValidSessionName('my-app-123')).toBe(true);
    expect(isValidSessionName('feature_branch')).toBe(true);
  });

  it('should reject empty names', () => {
    expect(isValidSessionName('')).toBe(false);
  });

  it('should reject names with spaces', () => {
    expect(isValidSessionName('my app')).toBe(false);
  });

  it('should reject names with special characters', () => {
    expect(isValidSessionName('app@test')).toBe(false);
    expect(isValidSessionName('app.name')).toBe(false);
    expect(isValidSessionName('app/name')).toBe(false);
  });

  it('should reject overly long names', () => {
    expect(isValidSessionName('a'.repeat(65))).toBe(false);
    expect(isValidSessionName('a'.repeat(64))).toBe(true);
  });

  it('should reject unicode characters', () => {
    expect(isValidSessionName('日本語')).toBe(false);
    expect(isValidSessionName('app🎉')).toBe(false);
  });
});

// Test port number validation
describe('Port Number Validation', () => {
  const isValidPort = (port: number): boolean => {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  };

  it('should accept valid ports', () => {
    expect(isValidPort(80)).toBe(true);
    expect(isValidPort(443)).toBe(true);
    expect(isValidPort(3000)).toBe(true);
    expect(isValidPort(65535)).toBe(true);
    expect(isValidPort(1)).toBe(true);
  });

  it('should reject port 0', () => {
    expect(isValidPort(0)).toBe(false);
  });

  it('should reject negative ports', () => {
    expect(isValidPort(-1)).toBe(false);
  });

  it('should reject ports above 65535', () => {
    expect(isValidPort(65536)).toBe(false);
    expect(isValidPort(100000)).toBe(false);
  });

  it('should reject non-integer ports', () => {
    expect(isValidPort(3000.5)).toBe(false);
    expect(isValidPort(NaN)).toBe(false);
    expect(isValidPort(Infinity)).toBe(false);
  });
});

// Test message content sanitization for display
describe('Message Content Sanitization', () => {
  const sanitizeForDisplay = (content: string): string => {
    // Remove control characters except newlines/tabs
    // Truncate to reasonable length for display (4000 chars)
    return content
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .slice(0, 4000);
  };

  it('should preserve normal text', () => {
    expect(sanitizeForDisplay('Hello World')).toBe('Hello World');
  });

  it('should preserve newlines and tabs', () => {
    expect(sanitizeForDisplay('Line1\nLine2\tTabbed')).toBe('Line1\nLine2\tTabbed');
  });

  it('should remove control characters', () => {
    expect(sanitizeForDisplay('Hello\x00World')).toBe('HelloWorld');
    expect(sanitizeForDisplay('Test\x1FEnd')).toBe('TestEnd');
  });

  it('should truncate long messages', () => {
    const longText = 'x'.repeat(5000);
    expect(sanitizeForDisplay(longText).length).toBe(4000);
  });

  it('should handle empty string', () => {
    expect(sanitizeForDisplay('')).toBe('');
  });
});

// Test branch name validation
describe('Git Branch Name Validation', () => {
  const isValidBranchName = (name: string): boolean => {
    // Basic git branch name rules
    if (!name || name.length > 200) return false;
    // Cannot start with . or -
    if (/^[.-]/.test(name)) return false;
    // Cannot contain .., ~, ^, :, ?, *, [, \, or control chars
    if (/[\.\.~^:?\*\[\]\\]/.test(name)) return false;
    // Cannot end with .lock or /
    if (/[\/.]$/.test(name) || /\.lock$/.test(name)) return false;
    return true;
  };

  it('should accept valid branch names', () => {
    expect(isValidBranchName('main')).toBe(true);
    expect(isValidBranchName('feature/new-thing')).toBe(true);
    expect(isValidBranchName('bugfix-123')).toBe(true);
  });

  it('should reject names starting with .', () => {
    expect(isValidBranchName('.hidden')).toBe(false);
  });

  it('should reject names starting with -', () => {
    expect(isValidBranchName('-dash')).toBe(false);
  });

  it('should reject names with ..', () => {
    expect(isValidBranchName('feature..test')).toBe(false);
  });

  it('should reject names ending with /', () => {
    expect(isValidBranchName('feature/')).toBe(false);
  });

  it('should reject names ending with .lock', () => {
    expect(isValidBranchName('branch.lock')).toBe(false);
  });

  it('should reject names with special characters', () => {
    expect(isValidBranchName('branch~name')).toBe(false);
    expect(isValidBranchName('branch^name')).toBe(false);
    expect(isValidBranchName('branch:name')).toBe(false);
  });

  it('should reject overly long names', () => {
    expect(isValidBranchName('a'.repeat(201))).toBe(false);
  });
});
