/**
 * OpenSofa - API Key Discovery
 * 
 * Scans environment variables for known API keys.
 * Only reports key NAMES + configured status — NEVER exposes key values.
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('key-discovery');

export interface APIKeyStatus {
  name: string;
  displayName: string;
  configured: boolean;
  agent: string;
}

/** Known API key environment variables */
const KNOWN_KEYS: Array<{ env: string; display: string; agent: string }> = [
  { env: 'ANTHROPIC_API_KEY', display: 'Anthropic API Key', agent: 'Claude Code' },
  { env: 'ANTHROPIC_AUTH_TOKEN', display: 'Anthropic Auth Token', agent: 'Claude Code' },
  { env: 'OPENAI_API_KEY', display: 'OpenAI API Key', agent: 'Codex / GPT' },
  { env: 'GEMINI_API_KEY', display: 'Gemini API Key', agent: 'Gemini' },
  { env: 'GOOGLE_API_KEY', display: 'Google API Key', agent: 'Gemini' },
  { env: 'OPENROUTER_API_KEY', display: 'OpenRouter API Key', agent: 'OpenRouter' },
];

/**
 * Discover configured API keys from environment variables.
 * Returns key names and configured status — NEVER returns key values.
 */
export function discoverAPIKeys(): APIKeyStatus[] {
  const statuses: APIKeyStatus[] = [];

  for (const key of KNOWN_KEYS) {
    const value = process.env[key.env];
    const configured = Boolean(value && value.length > 0);

    statuses.push({
      name: key.env,
      displayName: key.display,
      configured,
      agent: key.agent,
    });

    if (configured) {
      log.debug(`API key configured: ${key.env}`);
    }
  }

  return statuses;
}
