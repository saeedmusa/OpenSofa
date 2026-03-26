import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures';

// Use the actual token from the running server
const ACTUAL_TOKEN = 'b8a6d8324f90e707776b380e711f3df20edb8c1417de4a7ba65a4b5149f30502';

test.describe('OpenSofa PWA - Debug', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('should debug page content', async ({ page }) => {
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
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-page.png', fullPage: true });
    
    // Log page title
    console.log('Page title:', await page.title());
    
    // Log page URL
    console.log('Page URL:', page.url());
    
    // Check for root element
    const root = page.locator('#root');
    const rootExists = await root.count();
    console.log('Root element exists:', rootExists > 0);
    
    // Get root element content
    if (rootExists > 0) {
      const rootContent = await root.innerHTML();
      console.log('Root content length:', rootContent.length);
      console.log('Root content preview:', rootContent.substring(0, 500));
    }
    
    // Check for any buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log('Number of buttons:', buttonCount);
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const text = await buttons.nth(i).textContent();
      console.log(`Button ${i}: "${text}"`);
    }
    
    // Check for any links
    const links = page.locator('a');
    const linkCount = await links.count();
    console.log('Number of links:', linkCount);
    
    // Check for any headings
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    console.log('Number of headings:', headingCount);
    
    for (let i = 0; i < headingCount; i++) {
      const text = await headings.nth(i).textContent();
      console.log(`Heading ${i}: "${text}"`);
    }
    
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
    
    // Check if there's any text content
    const bodyText = await page.locator('body').textContent();
    console.log('\n=== Body Text Preview ===');
    console.log(bodyText?.substring(0, 1000));
  });
});
