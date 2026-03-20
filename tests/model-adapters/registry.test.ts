/**
 * Tests for Adapter Registry
 * Task 07: Testing for Model Discovery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentType } from '../../src/types.js';
import type { ModelProvider, ModelAdapter } from '../../src/model-adapters/types.js';

// Mock the logger to avoid console output during tests
vi.mock('../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Create mock adapter for testing
function createMockAdapter(agent: AgentType, name: string, available = true): ModelAdapter {
  return {
    agent,
    name,
    isAvailable: vi.fn().mockReturnValue(available),
    discoverModels: vi.fn().mockResolvedValue([
      {
        name: `${name} Provider`,
        id: `${agent}-provider`,
        agent,
        models: [
          { id: `${agent}/model-1`, name: 'model-1', provider: name, agent },
        ],
        configured: true,
      },
    ]),
    getDefaultModel: vi.fn().mockReturnValue(undefined),
  };
}

// Import registry after mocks are set up
import { AdapterRegistry } from '../../src/model-adapters/registry.js';

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    // Reset the singleton instance for each test
    registry = new AdapterRegistry();
    vi.clearAllMocks();
  });

  describe('registerAdapter()', () => {
    it('should register an adapter', () => {
      // Arrange
      const adapter = createMockAdapter('opencode', 'OpenCode');

      // Act
      registry.registerAdapter(adapter);

      // Assert
      expect(registry.getAdapter('opencode')).toBe(adapter);
    });

    it('should replace existing adapter for same agent type', () => {
      // Arrange
      const adapter1 = createMockAdapter('opencode', 'OpenCode');
      const adapter2 = createMockAdapter('opencode', 'OpenCode Modified');

      // Act
      registry.registerAdapter(adapter1);
      registry.registerAdapter(adapter2);

      // Assert
      expect(registry.getAdapter('opencode')).toBe(adapter2);
    });

    it('should allow multiple adapters for different agent types', () => {
      // Arrange
      const opencodeAdapter = createMockAdapter('opencode', 'OpenCode');
      const claudeAdapter = createMockAdapter('claude', 'Claude Code');

      // Act
      registry.registerAdapter(opencodeAdapter);
      registry.registerAdapter(claudeAdapter);

      // Assert
      expect(registry.getAdapter('opencode')).toBe(opencodeAdapter);
      expect(registry.getAdapter('claude')).toBe(claudeAdapter);
    });
  });

  describe('getAdapter()', () => {
    it('should return registered adapter', () => {
      // Arrange
      const adapter = createMockAdapter('claude', 'Claude Code');
      registry.registerAdapter(adapter);

      // Act
      const result = registry.getAdapter('claude');

      // Assert
      expect(result).toBe(adapter);
    });

    it('should return undefined for unregistered agent', () => {
      // Act
      const result = registry.getAdapter('aider' as AgentType);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getAllAdapters()', () => {
    it('should return all registered adapters', () => {
      // Arrange
      registry.registerAdapter(createMockAdapter('opencode', 'OpenCode'));
      registry.registerAdapter(createMockAdapter('claude', 'Claude Code'));

      // Act
      const adapters = registry.getAllAdapters();

      // Assert
      expect(adapters.length).toBe(2);
    });

    it('should return empty array when no adapters registered', () => {
      // Act
      const adapters = registry.getAllAdapters();

      // Assert
      expect(adapters).toEqual([]);
    });
  });

  describe('discoverAll()', () => {
    it('should discover models from all available adapters', async () => {
      // Arrange
      const opencodeAdapter = createMockAdapter('opencode', 'OpenCode', true);
      const claudeAdapter = createMockAdapter('claude', 'Claude Code', true);
      registry.registerAdapter(opencodeAdapter);
      registry.registerAdapter(claudeAdapter);

      // Act
      const result = await registry.discoverAll();

      // Assert
      expect(result.success).toBe(true);
      expect(result.providers.length).toBe(2);
      expect(result.errors).toBeUndefined();
    });

    it('should skip unavailable adapters', async () => {
      // Arrange
      const availableAdapter = createMockAdapter('opencode', 'OpenCode', true);
      const unavailableAdapter = createMockAdapter('claude', 'Claude Code', false);
      registry.registerAdapter(availableAdapter);
      registry.registerAdapter(unavailableAdapter);

      // Act
      const result = await registry.discoverAll();

      // Assert
      expect(result.providers.length).toBe(1);
      expect(result.providers[0].agent).toBe('opencode');
    });

    it('should discover from specific agents only', async () => {
      // Arrange
      const opencodeAdapter = createMockAdapter('opencode', 'OpenCode', true);
      const claudeAdapter = createMockAdapter('claude', 'Claude Code', true);
      registry.registerAdapter(opencodeAdapter);
      registry.registerAdapter(claudeAdapter);

      // Act
      const result = await registry.discoverAll(['claude']);

      // Assert
      expect(result.providers.length).toBe(1);
      expect(result.providers[0].agent).toBe('claude');
    });

    it('should handle errors from individual adapters gracefully', async () => {
      // Arrange
      const errorAdapter = {
        agent: 'opencode' as AgentType,
        name: 'OpenCode',
        isAvailable: vi.fn().mockReturnValue(true),
        discoverModels: vi.fn().mockRejectedValue(new Error('Discovery failed')),
        getDefaultModel: vi.fn().mockReturnValue(undefined),
      };
      registry.registerAdapter(errorAdapter);

      // Act
      const result = await registry.discoverAll();

      // Assert
      expect(result.success).toBe(false);
      expect(result.providers).toEqual([]);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(1);
      expect(result.errors![0]).toContain('Discovery failed');
    });

    it('should continue when one adapter fails and others succeed', async () => {
      // Arrange
      const errorAdapter = {
        agent: 'opencode' as AgentType,
        name: 'OpenCode',
        isAvailable: vi.fn().mockReturnValue(true),
        discoverModels: vi.fn().mockRejectedValue(new Error('OpenCode failed')),
        getDefaultModel: vi.fn().mockReturnValue(undefined),
      };
      const workingAdapter = createMockAdapter('claude', 'Claude Code', true);
      registry.registerAdapter(errorAdapter);
      registry.registerAdapter(workingAdapter);

      // Act
      const result = await registry.discoverAll();

      // Assert
      expect(result.success).toBe(false);
      expect(result.providers.length).toBe(1);
      expect(result.providers[0].agent).toBe('claude');
    });

    it('should return empty result when no adapters registered', async () => {
      // Act
      const result = await registry.discoverAll();

      // Assert
      expect(result.success).toBe(true);
      expect(result.providers).toEqual([]);
    });
  });

  describe('discoverForAgent()', () => {
    it('should discover models for specific agent', async () => {
      // Arrange
      const adapter = createMockAdapter('claude', 'Claude Code', true);
      registry.registerAdapter(adapter);

      // Act
      const providers = await registry.discoverForAgent('claude');

      // Assert
      expect(providers.length).toBe(1);
      expect(providers[0].agent).toBe('claude');
    });

    it('should return empty array when adapter not found', async () => {
      // Act
      const providers = await registry.discoverForAgent('aider' as AgentType);

      // Assert
      expect(providers).toEqual([]);
    });

    it('should return empty array when adapter is not available', async () => {
      // Arrange
      const adapter = createMockAdapter('claude', 'Claude Code', false);
      registry.registerAdapter(adapter);

      // Act
      const providers = await registry.discoverForAgent('claude');

      // Assert
      expect(providers).toEqual([]);
    });

    it('should return empty array when adapter discoverModels throws', async () => {
      // Arrange
      const errorAdapter = {
        agent: 'claude' as AgentType,
        name: 'Claude Code',
        isAvailable: vi.fn().mockReturnValue(true),
        discoverModels: vi.fn().mockRejectedValue(new Error('Discovery failed')),
        getDefaultModel: vi.fn().mockReturnValue(undefined),
      };
      registry.registerAdapter(errorAdapter);

      // Act
      const providers = await registry.discoverForAgent('claude');

      // Assert
      expect(providers).toEqual([]);
    });
  });

  describe('hasAdapters()', () => {
    it('should return true when adapters are registered', () => {
      // Arrange
      registry.registerAdapter(createMockAdapter('opencode', 'OpenCode'));

      // Assert
      expect(registry.hasAdapters()).toBe(true);
    });

    it('should return false when no adapters registered', () => {
      // Assert
      expect(registry.hasAdapters()).toBe(false);
    });
  });

  describe('getRegisteredAgents()', () => {
    it('should return list of registered agent types', () => {
      // Arrange
      registry.registerAdapter(createMockAdapter('opencode', 'OpenCode'));
      registry.registerAdapter(createMockAdapter('claude', 'Claude Code'));

      // Act
      const agents = registry.getRegisteredAgents();

      // Assert
      expect(agents).toContain('opencode');
      expect(agents).toContain('claude');
    });

    it('should return empty array when no adapters registered', () => {
      // Act
      const agents = registry.getRegisteredAgents();

      // Assert
      expect(agents).toEqual([]);
    });
  });

  describe('getInstance()', () => {
    it('should return singleton instance', () => {
      // Act
      const instance1 = AdapterRegistry.getInstance();
      const instance2 = AdapterRegistry.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });
});
