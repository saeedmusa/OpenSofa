import { test, expect } from '@playwright/test';
import { TEST_TOKEN, collectConsoleErrors, collectNetworkErrors } from './fixtures';

test.describe('Session Lifecycle', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
  });

  test('should list sessions from API', async ({ page, request }) => {
    const response = await request.get('/api/sessions', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data?.sessions || body.data || [])).toBe(true);
  });

  test('should list available agents including opencode', async ({ request }) => {
    const response = await request.get('/api/agents', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const agents = body.data?.agents || body.data || [];
    expect(agents.length).toBeGreaterThan(0);
    const hasOpencode = agents.some((a: any) => a.type === 'opencode');
    expect(hasOpencode).toBe(true);
  });

  test('should navigate from session list to session detail', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for desktop layout
    await expect(page.getByTestId('desktop-home')).toBeVisible({ timeout: 10000 });

    // Check if there are session cards to click
    const sessionCards = page.locator('.session-card');
    const count = await sessionCards.count();

    if (count > 0) {
      await sessionCards.first().click();
      await expect(page).toHaveURL(/\/session\//, { timeout: 10000 });

      // Session view should render
      await expect(
        page.getByTestId('session-view-desktop').or(page.getByTestId('session-view-mobile'))
      ).toBeVisible({ timeout: 10000 });

      // Message input should be present
      await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show health endpoint', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  test('should show system status', async ({ request }) => {
    const response = await request.get('/api/status', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect(response.status()).toBe(200);
  });
});
