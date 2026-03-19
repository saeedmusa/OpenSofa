/**
 * Shared test fixtures and constants for E2E tests
 */

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3285';
export const TEST_TOKEN = 'e2e0000000000000000000000000000000000000000000000000000000000000';

/**
 * Helper to authenticate a page
 */
export async function authenticate(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`/?token=${TEST_TOKEN}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Helper to wait for sessions to load
 */
export async function waitForSessions(page: import('@playwright/test').Page): Promise<number> {
  await page.waitForSelector('.session-card', { timeout: 10000 });
  return await page.locator('.session-card').count();
}

/**
 * Helper to click on a session card
 */
export async function clickSessionCard(page: import('@playwright/test').Page, sessionName: string): Promise<void> {
  const card = page.locator('.session-card').filter({ hasText: sessionName });
  await card.click();
}

/**
 * Helper to navigate to session detail
 */
export async function navigateToSession(page: import('@playwright/test').Page, sessionName: string): Promise<void> {
  await page.goto(`/session/${encodeURIComponent(sessionName)}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Helper to check if element is visible
 */
export async function isVisible(page: import('@playwright/test').Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
