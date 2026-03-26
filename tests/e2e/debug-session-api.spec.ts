import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures';

// Use the actual token from the running server
const ACTUAL_TOKEN = 'b8a6d8324f90e707776b380e711f3df20edb8c1417de4a7ba65a4b5149f30502';

test.describe('OpenSofa PWA - Debug Session Creation API', () => {
  test('should test session creation via API', async ({ page }) => {
    // Set longer timeout for this test
    test.setTimeout(120000);

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
    
    // Click on NEW_SESSION button
    console.log('Clicking NEW_SESSION button...');
    const newSessionButton = page.locator('button:has-text("NEW_SESSION")');
    await newSessionButton.click();
    await page.waitForTimeout(1000);
    
    // Click on OpenCode agent
    console.log('Clicking OpenCode agent...');
    const opencodeButton = page.locator('button:has-text("OpenCode")');
    await opencodeButton.click();
    await page.waitForTimeout(1000);
    
    // Wait for models to load
    console.log('Waiting for models to load...');
    await page.waitForFunction(() => {
      const select = document.querySelector('select');
      if (!select) return false;
      const options = Array.from(select.options);
      return options.length > 1 && !options.some(opt => opt.text.includes('Loading'));
    }, { timeout: 15000 }).catch(() => {
      console.log('Timeout waiting for models to load');
    });
    
    await page.waitForTimeout(1000);
    
    // Select GLM 4.7 model
    console.log('Selecting GLM 4.7 model...');
    const modelSelect = page.locator('select');
    if (await modelSelect.isVisible()) {
      const options = await modelSelect.locator('option').allTextContents();
      const glmOption = options.find(opt => opt.includes('glm-4.7'));
      if (glmOption) {
        await modelSelect.selectOption({ label: glmOption });
        console.log(`Selected: ${glmOption}`);
      }
    }
    
    await page.waitForTimeout(500);
    
    // Navigate to development directory
    console.log('Navigating to development directory...');
    const directoryEntries = page.locator('button').filter({ hasText: /development/ });
    if (await directoryEntries.count() > 0) {
      await directoryEntries.first().click();
      await page.waitForTimeout(1000);
    }
    
    // Click "Continue with" button
    console.log('Clicking Continue with button...');
    const continueButton = page.locator('button:has-text("Continue with")');
    if (await continueButton.isVisible()) {
      await continueButton.click();
      await page.waitForTimeout(500);
    }
    
    // Enter message
    console.log('Entering message...');
    const messageTextarea = page.locator('textarea');
    if (await messageTextarea.isVisible()) {
      await messageTextarea.fill('Test session creation');
      await page.waitForTimeout(500);
    }
    
    // Click Start Session
    console.log('Clicking Start Session button...');
    const startButton = page.locator('button:has-text("Start Session")');
    if (await startButton.isVisible()) {
      // Listen for network requests
      page.on('request', request => {
        if (request.url().includes('/api/sessions')) {
          console.log(`API Request: ${request.method()} ${request.url()}`);
          if (request.postData()) {
            console.log(`Request body: ${request.postData()}`);
          }
        }
      });
      
      page.on('response', response => {
        if (response.url().includes('/api/sessions')) {
          console.log(`API Response: ${response.status()} ${response.url()}`);
          response.text().then(body => {
            console.log(`Response body: ${body}`);
          }).catch(() => {});
        }
      });
      
      await startButton.click();
      
      // Wait for API call
      await page.waitForTimeout(5000);
      
      // Check for any error messages on the page
      const errorMessages = page.locator('text=error, text=Error, text=failed, text=Failed');
      const errorCount = await errorMessages.count();
      if (errorCount > 0) {
        console.log(`Found ${errorCount} error messages:`);
        for (let i = 0; i < errorCount; i++) {
          const text = await errorMessages.nth(i).textContent();
          console.log(`  Error: ${text}`);
        }
      }
      
      // Check for toast messages
      const toastMessages = page.locator('.toast, [class*="toast"], [class*="notification"]');
      const toastCount = await toastMessages.count();
      if (toastCount > 0) {
        console.log(`Found ${toastCount} toast messages:`);
        for (let i = 0; i < toastCount; i++) {
          const text = await toastMessages.nth(i).textContent();
          console.log(`  Toast: ${text}`);
        }
      }
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/debug-api-final.png', fullPage: true });
    
    // Log console messages
    console.log('\n=== Console Messages ===');
    for (const msg of consoleMessages.slice(-20)) {
      console.log(msg);
    }
    
    // Log page errors
    console.log('\n=== Page Errors ===');
    for (const error of pageErrors) {
      console.log(error);
    }
    
    console.log('Test completed!');
  });
});
