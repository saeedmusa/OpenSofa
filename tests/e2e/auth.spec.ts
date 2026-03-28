import { test, expect } from '@playwright/test';
import { TEST_TOKEN } from './fixtures';

test.describe('Authentication', () => {
  test('should show auth required screen when no token', async ({ page }) => {
    // Navigate without any token in URL or localStorage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show the auth screen
    const authScreen = page.getByTestId('auth-screen');
    await expect(authScreen).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Authentication Required')).toBeVisible();
  });

  test('should authenticate via URL token parameter', async ({ page }) => {
    // Navigate with token in URL
    await page.goto(`/?token=${TEST_TOKEN}`);
    await page.waitForLoadState('networkidle');

    // Auth screen should disappear
    await expect(page.getByText('Authentication Required')).not.toBeVisible({ timeout: 10000 });

    // App content should be visible
    const appRoot = page.getByTestId('app-root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });

  test('should persist token in localStorage after URL extraction', async ({ page }) => {
    await page.goto(`/?token=${TEST_TOKEN}`);

    // Wait for token to be saved to localStorage
    await page.waitForFunction(
      (expectedToken) => localStorage.getItem('opensofa_token') === expectedToken,
      TEST_TOKEN,
      { timeout: 15000 }
    );

    const storedToken = await page.evaluate(() => localStorage.getItem('opensofa_token'));
    expect(storedToken).toBe(TEST_TOKEN);
  });

  test('should clean token from URL after saving', async ({ page }) => {
    await page.goto(`/?token=${TEST_TOKEN}`);
    await page.waitForLoadState('networkidle');

    // Wait for token to be extracted and saved
    await page.waitForFunction(
      (t) => localStorage.getItem('opensofa_token') === t,
      TEST_TOKEN,
      { timeout: 15000 }
    );

    // URL should no longer contain the token param
    await page.waitForFunction(() => !window.location.search.includes('token'), { timeout: 5000 });
  });

  test('should auto-authenticate when token is in localStorage', async ({ page }) => {
    // Pre-inject token
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should NOT show auth screen
    await expect(page.getByText('Authentication Required')).not.toBeVisible({ timeout: 10000 });
  });
});
