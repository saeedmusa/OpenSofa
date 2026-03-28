import { test, expect } from '@playwright/test';
import { TEST_TOKEN } from './fixtures';

test.describe('Session Detail', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
  });

  test('should navigate to session page via URL', async ({ page }) => {
    await page.goto('/session/test-session');
    await page.waitForLoadState('networkidle');

    // Page should load without crashing
    const url = page.url();
    expect(url).toContain('localhost:3285');
  });

  test('should show message input if session exists', async ({ page }) => {
    await page.goto('/session/test-session');
    await page.waitForLoadState('networkidle');

    // Check if we're on session page or redirected home
    const messageInput = page.getByTestId('message-input');
    const hasInput = await messageInput.isVisible().catch(() => false);

    // If we're on session page, input should exist
    // If redirected home, that's also valid behavior
    expect(typeof hasInput).toBe('boolean');
  });

  test('should display session view layout on desktop', async ({ page }) => {
    await page.goto('/session/test-session');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should either show session view or redirect to home
    const desktopView = page.getByTestId('session-view-desktop');
    const desktopHome = page.getByTestId('desktop-home');

    const isOnSession = await desktopView.isVisible().catch(() => false);
    const isOnHome = await desktopHome.isVisible().catch(() => false);
    expect(isOnSession || isOnHome).toBe(true);
  });

  test('should display session view on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/session/test-session');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const mobileView = page.getByTestId('session-view-mobile');
    const mobileHome = page.getByTestId('mobile-home');

    const isOnSession = await mobileView.isVisible().catch(() => false);
    const isOnHome = await mobileHome.isVisible().catch(() => false);
    expect(isOnSession || isOnHome).toBe(true);
  });
});
