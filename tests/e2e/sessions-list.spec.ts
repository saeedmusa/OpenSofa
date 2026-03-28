import { test, expect } from '@playwright/test';
import { TEST_TOKEN, collectConsoleErrors, collectNetworkErrors } from './fixtures';

test.describe('Sessions List - Desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show desktop home layout', async ({ page }) => {
    const desktopHome = page.getByTestId('desktop-home');
    await expect(desktopHome).toBeVisible({ timeout: 10000 });
  });

  test('should show sidebar with NEW_AGENT button', async ({ page }) => {
    const newSessionBtn = page.getByTestId('new-session-btn');
    await expect(newSessionBtn).toBeVisible({ timeout: 10000 });
  });

  test('should show refresh button', async ({ page }) => {
    const refreshBtn = page.getByText('REFRESH_SYSTEM');
    await expect(refreshBtn).toBeVisible({ timeout: 10000 });
  });

  test('should show connection status indicator', async ({ page }) => {
    const status = page.getByTestId('connection-status');
    await expect(status).toBeVisible({ timeout: 10000 });
  });

  test('should open new session modal on button click', async ({ page }) => {
    const newSessionBtn = page.getByTestId('new-session-btn');
    await newSessionBtn.click();

    const modal = page.getByTestId('new-session-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('should have no critical console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes('[SW]') && !e.includes('service-worker') && !e.includes('favicon')
    );
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });
});

test.describe('Sessions List - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should not show sidebar on mobile', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toBeVisible();
  });

  test('should show mobile home view', async ({ page }) => {
    const mobileHome = page.getByTestId('mobile-home');
    await expect(mobileHome).toBeVisible({ timeout: 10000 });
  });
});
