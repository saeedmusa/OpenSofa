import { test, expect } from '@playwright/test';
import { TEST_TOKEN } from './fixtures';

test.describe('Mobile Layout', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show mobile home view', async ({ page }) => {
    const mobileHome = page.getByTestId('mobile-home');
    await expect(mobileHome).toBeVisible({ timeout: 10000 });
  });

  test('should not show desktop sidebar', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toBeVisible();
  });
});

test.describe('Tablet Layout', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('should render page content', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Some content should be visible
    const appRoot = page.getByTestId('app-root');
    const hasContent = await appRoot.isVisible().catch(() => false);
    if (!hasContent) {
      const mobileHome = page.getByTestId('mobile-home');
      const desktopHome = page.getByTestId('desktop-home');
      const hasMobile = await mobileHome.isVisible().catch(() => false);
      const hasDesktop = await desktopHome.isVisible().catch(() => false);
      expect(hasMobile || hasDesktop).toBe(true);
    }
  });
});

test.describe('Desktop Layout', () => {
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

  test('should show terminate all button in sidebar', async ({ page }) => {
    const terminateBtn = page.getByTestId('terminate-all-btn');
    await expect(terminateBtn).toBeVisible({ timeout: 10000 });
  });

  test('should open new session modal', async ({ page }) => {
    const newSessionBtn = page.getByTestId('new-session-btn');
    await newSessionBtn.click();

    const modal = page.getByTestId('new-session-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});
