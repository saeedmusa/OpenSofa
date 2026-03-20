/**
 * OpenSofa - Model Discovery Types
 * 
 * Interfaces for the unified model discovery system.
 */

import type { AgentType } from '../types.js';

// ──────────────────────────────────────
// Model Discovery Interfaces
// ──────────────────────────────────────

export interface DiscoveredModel {
  id: string;           // Full model ID (e.g., "anthropic/claude-sonnet-4-20250514")
  name: string;         // Display name (e.g., "claude-sonnet-4-20250514")
  provider: string;     // Provider name (e.g., "Z.AI", "OpenRouter", "HuggingFace")
  agent: AgentType;     // Which agent this model is for
  supportsVision: boolean;  // Whether model supports image input (vision)
  supportsImages: boolean;  // Whether model supports image generation/output
}

export interface ModelProvider {
  name: string;         // Display name (e.g., "Z.AI Coding Plan")
  id: string;           // Normalized ID (e.g., "zai", "openrouter")
  agent: AgentType;     // Which agent this provider is for
  models: DiscoveredModel[];
  configured: boolean;  // Whether API key is set up
}

export interface ModelDiscoveryResult {
  success: boolean;
  providers: ModelProvider[];
  errors?: string[];    // Any errors encountered
}

export interface ModelAdapter {
  readonly agent: AgentType;
  readonly name: string;
  
  /**
   * Check if this adapter is available (agent installed, etc.)
   */
  isAvailable(): boolean;
  
  /**
   * Discover all available models from this agent's providers
   */
  discoverModels(): Promise<ModelProvider[]>;
  
  /**
   * Get the default model for this agent (if any)
   */
  getDefaultModel(): string | undefined;
}
