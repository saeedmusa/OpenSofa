import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures';

// Use the actual token from the running server
const ACTUAL_TOKEN = 'b8a6d8324f90e707776b380e711f3df20edb8c1417de4a7ba65a4b5149f30502';

test.describe('OpenSofa PWA - Debug Session Creation', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('should debug session creation flow', async ({ page }) => {
    // Collect console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Collect page errors
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Navigate to the page
    console.log('Navigating to OpenSofa PWA...');
    await page.goto(`${BASE_URL}/?token=${ACTUAL_TOKEN}`);
    await page.waitForLoadState('networkidle');
    
    // Wait for React to render
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-session-01-initial.png', fullPage: true });
    
    // Click on NEW_SESSION button
    console.log('Clicking NEW_SESSION button...');
    const newSessionButton = page.locator('button:has-text("NEW_SESSION")');
    await newSessionButton.click();
    await page.waitForTimeout(1000);
    
    // Take screenshot after clicking
    await page.screenshot({ path: 'test-results/debug-session-02-after-click.png', fullPage: true });
    
    // Check if modal is visible
    const modal = page.locator('.fixed.inset-0, [role="dialog"], .modal');
    const isModalVisible = await modal.isVisible().catch(() => false);
    console.log(`Modal visible: ${isModalVisible}`);
    
    // Check for any new buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Number of buttons after click: ${buttonCount}`);
    
    for (let i = 0; i < buttonCount; i++) {
      const text = await buttons.nth(i).textContent();
      console.log(`Button ${i}: "${text}"`);
    }
    
    // Check for any text containing "Custom" or "OpenCode"
    const customText = page.locator('text=Custom');
    const hasCustomText = await customText.isVisible().catch(() => false);
    console.log(`Custom text visible: ${hasCustomText}`);
    
    const opencodeText = page.locator('text=OpenCode');
    const hasOpencodeText = await opencodeText.isVisible().catch(() => false);
    console.log(`OpenCode text visible: ${hasOpencodeText}`);
    
    // Log console messages
    console.log('\n=== Console Messages ===');
    for (const msg of consoleMessages) {
      console.log(msg);
    }
    
    // Log page errors
    console.log('\n=== Page Errors ===');
    for (const error of pageErrors) {
      console.log(error);
    }
  });
});
