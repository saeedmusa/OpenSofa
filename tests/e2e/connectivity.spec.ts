import { test, expect } from '@playwright/test';
import { TEST_TOKEN, collectConsoleErrors, collectNetworkErrors } from './fixtures';

test.describe('Connectivity', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('should connect WebSocket and show connected status', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);

    const consoleErrors = collectConsoleErrors(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for connection status indicator
    const status = page.getByTestId('connection-status');
    await expect(status).toBeVisible({ timeout: 15000 });

    // Should show connected label
    await expect(status).toContainText(/connected/i, { timeout: 15000 });
  });

  test('should have no HTTP 5xx errors on page load', async ({ page }) => {
    const networkErrors = collectNetworkErrors(page);

    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const serverErrors = networkErrors.filter((e) => e.status >= 500);
    expect(serverErrors).toEqual([]);
  });

  test('should reject unauthenticated API requests', async ({ request }) => {
    const response = await request.get('/api/sessions');
    expect(response.status()).toBe(401);
  });

  test('should accept authenticated API requests', async ({ request }) => {
    const response = await request.get('/api/sessions', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect(response.status()).toBe(200);
  });

  test('should reconnect after page reload', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const status = page.getByTestId('connection-status');
    await expect(status).toBeVisible({ timeout: 15000 });

    // Reload and verify reconnect
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(status).toBeVisible({ timeout: 15000 });
    await expect(status).toContainText(/connected/i, { timeout: 15000 });
  });
});
