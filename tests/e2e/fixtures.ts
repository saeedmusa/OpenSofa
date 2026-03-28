/**
 * Shared test fixtures and constants for E2E tests
 */

import { type Page } from '@playwright/test';

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3285';
export const TEST_TOKEN = 'e2e0000000000000000000000000000000000000000000000000000000000000';

/**
 * Pre-inject auth token into localStorage, then navigate.
 * This avoids the race condition of URL token extraction.
 */
export async function authenticate(page: Page): Promise<void> {
  await page.addInitScript((token) => {
    localStorage.setItem('opensofa_token', token);
  }, TEST_TOKEN);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

/**
 * Collect console errors from the page
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

/**
 * Collect network errors (HTTP >= 400)
 */
export function collectNetworkErrors(page: Page): { url: string; status: number }[] {
  const errors: { url: string; status: number }[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push({ url: response.url(), status: response.status() });
    }
  });
  return errors;
}

/**
 * Wait for sessions to appear in the list
 */
export async function waitForSessions(page: Page): Promise<number> {
  // Wait for either session cards or empty state to render
  await page.waitForSelector('[data-testid="desktop-home"], [data-testid="mobile-home"], [data-testid="app-root"]', {
    timeout: 10000,
  });
  const cards = page.locator('.session-card');
  return cards.count();
}

/**
 * Navigate to a session detail view
 */
export async function navigateToSession(page: Page, sessionName: string): Promise<void> {
  await page.goto(`/session/${encodeURIComponent(sessionName)}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="session-view-desktop"], [data-testid="session-view-mobile"]', {
    timeout: 10000,
  });
}

/**
 * Check if an element is visible
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
