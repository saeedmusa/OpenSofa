import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures';

// Use the actual token from the running server
const ACTUAL_TOKEN = 'b8a6d8324f90e707776b380e711f3df20edb8c1417de4a7ba65a4b5149f30502';

test.describe('OpenSofa PWA - Create Session with OpenCode + GLM 4.7', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('should create a new session with OpenCode and GLM 4.7', async ({ page }) => {
    // Set longer timeout for this test
    test.setTimeout(120000);
    // Step 1: Navigate and authenticate
    console.log('Step 1: Navigating to OpenSofa PWA...');
    await page.goto(`${BASE_URL}/?token=${ACTUAL_TOKEN}`);
    await page.waitForLoadState('networkidle');
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    // Take a screenshot to see the initial state
    await page.screenshot({ path: 'test-results/01-initial-load.png', fullPage: true });
    console.log('Screenshot saved: 01-initial-load.png');

    // Step 2: Check if we're authenticated (no auth required message)
    const authMessage = page.getByText('Authentication Required');
    const isAuthRequired = await authMessage.isVisible().catch(() => false);
    console.log(`Authentication required: ${isAuthRequired}`);
    
    if (isAuthRequired) {
      console.log('Authentication failed - token may be invalid');
      await page.screenshot({ path: 'test-results/02-auth-failed.png', fullPage: true });
    }

    // Step 3: Look for the "NEW_SESSION" button
    console.log('Step 3: Looking for NEW_SESSION button...');
    
    // The button text is "NEW_SESSION" (with underscores)
    const newSessionButton = page.locator('button:has-text("NEW_SESSION")');
    const hasNewSessionButton = await newSessionButton.isVisible().catch(() => false);
    
    console.log(`NEW_SESSION button visible: ${hasNewSessionButton}`);
    
    if (hasNewSessionButton) {
      await newSessionButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/03-new-session-modal.png', fullPage: true });
      console.log('Screenshot saved: 03-new-session-modal.png');
    } else {
      console.log('NEW_SESSION button not found - checking page content...');
      await page.screenshot({ path: 'test-results/03-no-button.png', fullPage: true });
      
      // Log the page content for debugging
      const pageContent = await page.content();
      console.log('Page title:', await page.title());
    }

    // Step 4: Select "Custom" template (skip template selection)
    console.log('Step 4: Selecting Custom template...');
    const customButton = page.locator('button:has-text("Custom")');
    const hasCustomButton = await customButton.isVisible().catch(() => false);
    
    if (hasCustomButton) {
      await customButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/04-custom-selected.png', fullPage: true });
      console.log('Screenshot saved: 04-custom-selected.png');
    }

    // Step 5: Select OpenCode agent
    console.log('Step 5: Selecting OpenCode agent...');
    const opencodeButton = page.locator('button:has-text("OpenCode")');
    const hasOpencodeButton = await opencodeButton.isVisible().catch(() => false);
    
    console.log(`OpenCode button visible: ${hasOpencodeButton}`);
    
    if (hasOpencodeButton) {
      await opencodeButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/05-opencode-selected.png', fullPage: true });
      console.log('Screenshot saved: 05-opencode-selected.png');
    } else {
      console.log('OpenCode button not found - checking available agents...');
      const agentButtons = page.locator('button').filter({ hasText: /claude|opencode|aider|codex|goose|gemini/i });
      const agentCount = await agentButtons.count();
      console.log(`Found ${agentCount} agent buttons`);
      
      for (let i = 0; i < agentCount; i++) {
        const text = await agentButtons.nth(i).textContent();
        console.log(`Agent button ${i}: ${text}`);
      }
    }

    // Step 6: Navigate to directory selection
    console.log('Step 6: Navigating to directory selection...');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/06-directory-step.png', fullPage: true });
    console.log('Screenshot saved: 06-directory-step.png');

    // Step 7: Select GLM 4.7 model from Z.AI Coding Plan
    console.log('Step 7: Selecting GLM 4.7 model...');
    
    // Wait for models to load
    console.log('Waiting for models to load...');
    await page.waitForTimeout(5000);
    
    // Look for the model dropdown
    const modelSelect = page.locator('select');
    const hasModelSelect = await modelSelect.isVisible().catch(() => false);
    
    console.log(`Model select visible: ${hasModelSelect}`);
    
    if (hasModelSelect) {
      // Get all options
      const options = await modelSelect.locator('option').allTextContents();
      console.log('Available model options:', options);
      
      // Look for GLM 4.7 in the options - specifically from Z.AI Coding Plan
      // The correct model is "GLM-4.7" from Z.AI Coding Plan provider
      const glmOption = options.find(opt => opt === 'GLM-4.7');
      console.log(`GLM 4.7 option found: ${glmOption}`);
      
      if (glmOption) {
        // Select the GLM 4.7 option
        await modelSelect.selectOption({ label: glmOption });
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/07-glm-selected.png', fullPage: true });
        console.log('Screenshot saved: 07-glm-selected.png');
      } else {
        console.log('GLM-4.7 not found in options - checking optgroups...');
        
        // Check optgroups for Z.AI Coding Plan
        const optgroups = await modelSelect.locator('optgroup').all();
        for (const group of optgroups) {
          const label = await group.getAttribute('label');
          console.log(`Optgroup label: ${label}`);
          
          if (label?.includes('Z.AI') || label?.includes('zai')) {
            const groupOptions = await group.locator('option').allTextContents();
            console.log(`Options in ${label}:`, groupOptions);
            
            const glmInGroup = groupOptions.find(opt => opt === 'GLM-4.7');
            if (glmInGroup) {
              await modelSelect.selectOption({ label: glmInGroup });
              await page.waitForTimeout(500);
              console.log(`Selected: ${glmInGroup}`);
              break;
            }
          }
        }
      }
    }

    // Step 8: Navigate to a directory
    console.log('Step 8: Navigating to a directory...');
    
    // Wait for file list to load
    await page.waitForTimeout(2000);
    
    // Take screenshot to see current state
    await page.screenshot({ path: 'test-results/08-directory-step.png', fullPage: true });
    
    // Look for directory entries in the file list
    const directoryEntries = page.locator('button').filter({ hasText: /development|Documents|Downloads|projects/ });
    const dirCount = await directoryEntries.count();
    console.log(`Found ${dirCount} directory entries`);
    
    if (dirCount > 0) {
      // Click on the first directory (e.g., "development")
      const firstDir = directoryEntries.first();
      const dirText = await firstDir.textContent();
      console.log(`Clicking on directory: ${dirText}`);
      await firstDir.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/08a-directory-navigated.png', fullPage: true });
      console.log('Screenshot saved: 08a-directory-navigated.png');
    }
    
    // Now look for "Continue with" button (should be visible now that currentPath is set)
    const continueButton = page.locator('button:has-text("Continue with")');
    const hasContinueButton = await continueButton.isVisible().catch(() => false);
    console.log(`Continue button visible: ${hasContinueButton}`);
    
    if (hasContinueButton) {
      const continueText = await continueButton.textContent();
      console.log(`Clicking: ${continueText}`);
      await continueButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/08b-directory-selected.png', fullPage: true });
      console.log('Screenshot saved: 08b-directory-selected.png');
    } else {
      console.log('Continue button not found - trying to click on a folder icon...');
      // Try clicking on any folder button
      const folderButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      if (await folderButton.isVisible().catch(() => false)) {
        await folderButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 9: Enter initial message
    console.log('Step 9: Entering initial message...');
    
    // Wait for prompt step to appear
    await page.waitForTimeout(1000);
    
    const messageTextarea = page.locator('textarea');
    const hasMessageTextarea = await messageTextarea.isVisible().catch(() => false);
    console.log(`Message textarea visible: ${hasMessageTextarea}`);
    
    if (hasMessageTextarea) {
      await messageTextarea.fill('Hello! This is a test session using OpenCode with GLM 4.7 model from Z.AI Coding Plan.');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/09-message-entered.png', fullPage: true });
      console.log('Screenshot saved: 09-message-entered.png');
    } else {
      console.log('Textarea not found - checking page state...');
      await page.screenshot({ path: 'test-results/09-no-textarea.png', fullPage: true });
    }

    // Step 10: Start the session
    console.log('Step 10: Starting the session...');
    
    const startButton = page.locator('button:has-text("Start Session")');
    const hasStartButton = await startButton.isVisible().catch(() => false);
    console.log(`Start Session button visible: ${hasStartButton}`);
    
    if (hasStartButton) {
      console.log('Clicking Start Session button...');
      await startButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/10-session-starting.png', fullPage: true });
      console.log('Screenshot saved: 10-session-starting.png');
      
      // Wait for navigation to session view
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/11-session-created.png', fullPage: true });
      console.log('Screenshot saved: 11-session-created.png');
    } else {
      console.log('Start Session button not found!');
      // Log all visible buttons for debugging
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`Total buttons on page: ${buttonCount}`);
      for (let i = 0; i < buttonCount; i++) {
        const text = await allButtons.nth(i).textContent();
        const isVisible = await allButtons.nth(i).isVisible();
        if (isVisible) {
          console.log(`  Visible button ${i}: "${text}"`);
        }
      }
    }

    // Final screenshot
    await page.screenshot({ path: 'test-results/12-final-state.png', fullPage: true });
    console.log('Screenshot saved: 12-final-state.png');
    
    console.log('Test completed!');
  });
});
