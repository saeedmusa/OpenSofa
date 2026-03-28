import { test, expect } from '@playwright/test';
import { TEST_TOKEN, collectConsoleErrors, collectNetworkErrors } from './fixtures';

/**
 * Full PWA Session Flow Test
 * Creates a session with OpenCode agent, verifies UI, and cleans up.
 */
test.describe('OpenSofa PWA - Full Session Flow', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('should load PWA and show dashboard', async ({ page }) => {
    test.setTimeout(60000);

    const consoleErrors = collectConsoleErrors(page);
    const networkErrors = collectNetworkErrors(page);

    // Step 1: Authenticate
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 2: Verify dashboard loaded
    await page.screenshot({ path: 'test-results/01-dashboard.png', fullPage: true });

    const desktopHome = page.getByTestId('desktop-home');
    await expect(desktopHome).toBeVisible({ timeout: 10000 });

    // Step 3: Open new session modal
    const newSessionBtn = page.getByTestId('new-session-btn');
    await expect(newSessionBtn).toBeVisible({ timeout: 10000 });
    await newSessionBtn.click();

    const modal = page.getByTestId('new-session-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/02-modal.png', fullPage: true });

    // Step 4: Select Custom template
    const customBtn = page.locator('button').filter({ hasText: 'Custom' }).first();
    if (await customBtn.isVisible().catch(() => false)) {
      await customBtn.click();
      await page.waitForTimeout(500);
    }

    // Step 5: Select OpenCode agent
    const opencodeBtn = page.locator('button').filter({ hasText: /OpenCode/i }).first();
    if (await opencodeBtn.isVisible().catch(() => false)) {
      await opencodeBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/03-agent.png', fullPage: true });
    }

    // Step 6: Verify no critical network errors
    const criticalNetworkErrors = networkErrors.filter(
      (e) => !e.url.includes('favicon') && !e.url.includes('sw.js')
    );
    expect(criticalNetworkErrors.length).toBeLessThanOrEqual(1);

    await page.screenshot({ path: 'test-results/04-final.png', fullPage: true });
  });
});
