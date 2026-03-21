/**
 * OpenSofa - Session Template Manager
 * 
 * Reads session templates from ~/.opensofa/templates.yaml.
 * Templates allow pre-configured session setups for common workflows.
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import { createLogger } from './utils/logger.js';

const log = createLogger('template-manager');

const HOME = process.env.HOME || '/root';
const CONFIG_DIR = join(HOME, '.opensofa');
const TEMPLATES_PATH = join(CONFIG_DIR, 'templates.yaml');

export interface SessionTemplate {
  name: string;
  agent: string;
  model?: string;
  description?: string;
  mcpServers?: string[];
}

export interface TemplatesConfig {
  templates: Record<string, SessionTemplate>;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load templates from ~/.opensofa/templates.yaml.
 * Returns empty config if file doesn't exist.
 */
export async function loadTemplates(): Promise<TemplatesConfig> {
  if (!(await fileExists(TEMPLATES_PATH))) {
    log.debug('No templates file found', { path: TEMPLATES_PATH });
    return { templates: {} };
  }

  try {
    const content = await readFile(TEMPLATES_PATH, 'utf-8');
    const config = yaml.load(content) as TemplatesConfig | null;
    return { templates: config?.templates ?? {} };
  } catch (err) {
    log.error('Failed to parse templates', { error: String(err) });
    return { templates: {} };
  }
}

/**
 * Save templates to ~/.opensofa/templates.yaml.
 */
export async function saveTemplates(config: TemplatesConfig): Promise<void> {
  try {
    const { mkdir } = await import('fs/promises');
    await mkdir(CONFIG_DIR, { recursive: true });
    const content = yaml.dump(config, { lineWidth: 120 });
    await writeFile(TEMPLATES_PATH, content, 'utf-8');
    log.info('Templates saved', { path: TEMPLATES_PATH, count: Object.keys(config.templates).length });
  } catch (err) {
    log.error('Failed to save templates', { error: String(err) });
    throw err;
  }
}

/**
 * Get a template by ID.
 */
export async function getTemplate(id: string): Promise<SessionTemplate | null> {
  const config = await loadTemplates();
  return config.templates[id] ?? null;
}

/**
 * Add or update a template.
 */
export async function upsertTemplate(id: string, template: SessionTemplate): Promise<void> {
  const config = await loadTemplates();
  config.templates[id] = template;
  await saveTemplates(config);
}

/**
 * Delete a template.
 */
export async function deleteTemplate(id: string): Promise<boolean> {
  const config = await loadTemplates();
  if (!(id in config.templates)) return false;
  delete config.templates[id];
  await saveTemplates(config);
  return true;
}
