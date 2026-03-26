import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures';

// Use the actual token from the running server
const ACTUAL_TOKEN = 'b8a6d8324f90e707776b380e711f3df20edb8c1417de4a7ba65a4b5149f30502';

test.describe('OpenSofa PWA - Debug Session Creation HTML', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('should debug session creation HTML', async ({ page }) => {
    // Navigate to the page
    console.log('Navigating to OpenSofa PWA...');
    await page.goto(`${BASE_URL}/?token=${ACTUAL_TOKEN}`);
    await page.waitForLoadState('networkidle');
    
    // Wait for React to render
    await page.waitForTimeout(2000);
    
    // Click on NEW_SESSION button
    console.log('Clicking NEW_SESSION button...');
    const newSessionButton = page.locator('button:has-text("NEW_SESSION")');
    await newSessionButton.click();
    await page.waitForTimeout(1000);
    
    // Get the modal HTML
    const modal = page.locator('.fixed.inset-0, [role="dialog"], .modal');
    const modalHTML = await modal.innerHTML().catch(() => 'Modal not found');
    
    console.log('\n=== Modal HTML ===');
    console.log(modalHTML.substring(0, 2000));
    
    // Check for "Choose Template" text
    const chooseTemplateText = page.locator('text=Choose Template');
    const hasChooseTemplateText = await chooseTemplateText.isVisible().catch(() => false);
    console.log(`\nChoose Template text visible: ${hasChooseTemplateText}`);
    
    // Check for "Select Coding Agent" text
    const selectAgentText = page.locator('text=Select Coding Agent');
    const hasSelectAgentText = await selectAgentText.isVisible().catch(() => false);
    console.log(`Select Coding Agent text visible: ${hasSelectAgentText}`);
    
    // Check for "Custom" text
    const customText = page.locator('text=Custom');
    const hasCustomText = await customText.isVisible().catch(() => false);
    console.log(`Custom text visible: ${hasCustomText}`);
    
    // Check for "Start from scratch" text
    const startFromScratchText = page.locator('text=Start from scratch');
    const hasStartFromScratchText = await startFromScratchText.isVisible().catch(() => false);
    console.log(`Start from scratch text visible: ${hasStartFromScratchText}`);
  });
});
