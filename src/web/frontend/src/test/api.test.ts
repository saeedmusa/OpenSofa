import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '../utils/api';

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Token Management', () => {
    it('should save token to localStorage', () => {
      api.saveToken('test-token-123');
      expect(localStorage.getItem('opensofa_token')).toBe('test-token-123');
    });

    it('should retrieve token from localStorage', () => {
      localStorage.setItem('opensofa_token', 'stored-token');
      expect(api.getToken()).toBe('stored-token');
    });

    it('should return null when no token', () => {
      expect(api.getToken()).toBeNull();
    });
  });
});
