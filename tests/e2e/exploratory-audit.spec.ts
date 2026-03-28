/**
 * Exploratory End-to-End Product Test
 * Full product walkthrough with OpenCode + GLM 4.7
 *
 * Modal steps: template → agent → directory → prompt
 */

import { test, expect } from '@playwright/test';
import { TEST_TOKEN } from './fixtures';

const ISSUES: string[] = [];
function logIssue(issue: string) {
  ISSUES.push(issue);
  console.log(`\n🔴 [ISSUE] ${issue}`);
}
function logStep(step: string) {
  console.log(`\n🟢 [STEP] ${step}`);
}

test.describe('Exploratory Product Audit', () => {
  test.setTimeout(180_000);
  test.use({ viewport: { width: 1280, height: 720 } });

  test('full product walkthrough with OpenCode + GLM 4.7', async ({ page }) => {
    const consoleErrors: string[] = [];
    const networkErrors: { url: string; status: number }[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        networkErrors.push({ url: res.url(), status: res.status() });
        console.log(`  [HTTP ${res.status}] ${res.url().substring(0, 100)}`);
      }
    });

    // ═══════════════════════════════════════════
    // PHASE 1: LOAD & AUTH
    // ═══════════════════════════════════════════
    logStep('Phase 1: Load app');
    await page.addInitScript((token) => {
      localStorage.setItem('opensofa_token', token);
    }, TEST_TOKEN);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/audit/01-home.png', fullPage: true });

    const desktopHome = page.getByTestId('desktop-home');
    await expect(desktopHome).toBeVisible({ timeout: 10_000 });
    logStep('Desktop home loaded.');

    // Check connection
    const connStatus = page.getByTestId('connection-status');
    await expect(connStatus).toBeVisible({ timeout: 15_000 });
    const statusText = await connStatus.textContent().catch(() => '');
    logStep(`Connection: ${statusText}`);

    // ═══════════════════════════════════════════
    // PHASE 2: OPEN MODAL → CLICK CUSTOM
    // ═══════════════════════════════════════════
    logStep('Phase 2: Open modal and click Custom');
    await page.getByTestId('new-session-btn').click();
    await page.waitForTimeout(500);

    const modal = page.getByTestId('new-session-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/audit/02-modal-templates.png', fullPage: true });

    // Click "Custom" to go to agent selection
    // The button contains "Custom" + "Start from scratch"
    const customBtn = page.locator('button').filter({ hasText: /Custom.*Start from scratch/ }).first();
    await expect(customBtn).toBeVisible({ timeout: 5000 });
    await customBtn.click();
    await page.waitForTimeout(1000);
    logStep('Clicked Custom. Now on agent selection step.');
    await page.screenshot({ path: 'test-results/audit/03-agent-step.png', fullPage: true });

    // ═══════════════════════════════════════════
    // PHASE 3: SELECT AGENT (OpenCode)
    // ═══════════════════════════════════════════
    logStep('Phase 3: Select OpenCode agent');

    // Wait for agents to load
    await page.waitForTimeout(2000);

    // Find OpenCode button in agent grid
    const opencodeBtn = page.locator('button').filter({ hasText: /OpenCode/i }).first();
    const hasOC = await opencodeBtn.isVisible().catch(() => false);

    if (!hasOC) {
      // List all visible buttons for debugging
      const allBtns = page.locator('[data-testid="new-session-modal"] button');
      const count = await allBtns.count();
      const visible: string[] = [];
      for (let i = 0; i < count; i++) {
        if (await allBtns.nth(i).isVisible().catch(() => false)) {
          const txt = (await allBtns.nth(i).textContent())?.trim() || '';
          if (txt) visible.push(txt.substring(0, 40));
        }
      }
      logIssue(`OpenCode button not found. Visible: ${visible.join(' | ')}`);
    } else {
      await opencodeBtn.click();
      await page.waitForTimeout(1500);
      logStep('Selected OpenCode agent.');
    }
    await page.screenshot({ path: 'test-results/audit/04-agent-selected.png', fullPage: true });

    // ═══════════════════════════════════════════
    // PHASE 4: DIRECTORY BROWSER + MODEL SELECTION
    // ═══════════════════════════════════════════
    logStep('Phase 4: Directory browser + model selection');

    // Wait for directory entries AND models to load
    await page.waitForTimeout(3000);

    // --- MODEL SELECTION (lives in directory step) ---
    const modelSelect = page.locator('[data-testid="new-session-modal"] select').first();
    // Wait for model discovery to complete (max 15s)
    const hasModelSelect = await modelSelect.isVisible().catch(() => false);

    if (hasModelSelect) {
      // Wait for models to finish loading
      await page.waitForFunction(() => {
        const sel = document.querySelector('[data-testid="new-session-modal"] select');
        if (!sel) return false;
        const opts = sel.querySelectorAll('option');
        // Not loading anymore if we have real options (not just "Loading..." or "No models")
        return Array.from(opts).some(o => !o.textContent?.includes('Loading') && !o.textContent?.includes('No models') && o.value);
      }, { timeout: 15_000 }).catch(() => null);

      // Get all option texts including optgroups
      const options = await modelSelect.locator('option').allTextContents();
      logStep(`Model options loaded (${options.length}): ${options.slice(0, 5).join(', ')}...`);

      // Try to find GLM-4.7 in options
      let glmModel = options.find(o => o.includes('GLM') && o.includes('4.7'));
      if (!glmModel) glmModel = options.find(o => o.toLowerCase().includes('glm'));
      if (!glmModel) glmModel = options.find(o => o.includes('4.7'));

      if (glmModel) {
        await modelSelect.selectOption({ label: glmModel });
        logStep(`Selected model: ${glmModel}`);
      } else {
        // Check optgroups for provider-based grouping
        const optgroups = await modelSelect.locator('optgroup').all();
        const groupLabels: string[] = [];
        for (const group of optgroups) {
          const label = await group.getAttribute('label');
          groupLabels.push(label || '');
          if (label?.includes('Z.AI') || label?.includes('Coding') || label?.includes('zai')) {
            const groupOpts = await group.locator('option').allTextContents();
            const glm = groupOpts.find(o => o.includes('GLM') || o.includes('4.7'));
            if (glm) {
              await modelSelect.selectOption({ label: glm });
              logStep(`Selected from group "${label}": ${glm}`);
              glmModel = glm;
            }
          }
        }
        if (!glmModel) {
          logIssue(`GLM-4.7 not found in model options. Groups: ${groupLabels.join(', ')}. Options: ${options.slice(0, 10).join(', ')}`);
          // Fallback: select first real option
          const fallback = options.find(o => !o.includes('Loading') && !o.includes('No models') && !o.includes('Select') && o.trim());
          if (fallback) {
            await modelSelect.selectOption({ label: fallback });
            logStep(`Fallback model: ${fallback}`);
          }
        }
      }
    } else {
      logIssue('Model select dropdown not found in directory step');
    }

    await page.screenshot({ path: 'test-results/audit/05-model-selected.png', fullPage: true });

    // --- DIRECTORY BROWSING ---
    const dirButtons = page.locator('[data-testid="new-session-modal"] button').filter({ hasText: /development|Documents|Desktop|Downloads/i });
    const dirCount = await dirButtons.count();
    logStep(`Found ${dirCount} directory entries`);

    if (dirCount > 0) {
      const devBtn = dirButtons.filter({ hasText: /development/i }).first();
      if (await devBtn.isVisible().catch(() => false)) {
        await devBtn.click();
        await page.waitForTimeout(1500);
        logStep('Clicked "development" directory.');

        // Navigate into a git repo subdirectory (OpenSofa)
        await page.waitForTimeout(1000);
        const subDirs = page.locator('[data-testid="new-session-modal"] button').filter({ hasText: /OpenSofa/i });
        const hasSubDir = await subDirs.first().isVisible().catch(() => false);
        if (hasSubDir) {
          await subDirs.first().click();
          await page.waitForTimeout(1500);
          logStep('Navigated into OpenSofa subdirectory (git repo).');
        } else {
          logStep('OpenSofa subdirectory not found, proceeding with current directory.');
        }
      } else {
        await dirButtons.first().click();
        await page.waitForTimeout(1500);
        logStep('Clicked first directory entry.');
      }
    } else {
      logIssue('No directory entries found');
    }

    await page.screenshot({ path: 'test-results/audit/06-directory-browsing.png', fullPage: true });

    // Click "Continue with ~/{path}" to proceed to prompt step
    const continueDirBtn = page.locator('button').filter({ hasText: /Continue with/i }).first();
    if (await continueDirBtn.isVisible().catch(() => false)) {
      await continueDirBtn.click();
      await page.waitForTimeout(1500);
      logStep('Clicked "Continue with" button → moved to prompt step.');
    } else {
      logIssue('Continue directory button not found');
      // List buttons for debugging
      const btns = page.locator('[data-testid="new-session-modal"] button');
      const count = await btns.count();
      const visible: string[] = [];
      for (let i = 0; i < count; i++) {
        if (await btns.nth(i).isVisible().catch(() => false)) {
          visible.push((await btns.nth(i).textContent())?.trim().substring(0, 40) || '');
        }
      }
      logStep(`Directory step buttons: ${visible.join(' | ')}`);
    }

    await page.screenshot({ path: 'test-results/audit/07-prompt-step.png', fullPage: true });

    // ═══════════════════════════════════════════
    // PHASE 5: FILL PROMPT + START SESSION
    // ═══════════════════════════════════════════
    logStep('Phase 5: Fill prompt and start session');

    // Fill session name
    const sessionInput = page.locator('[data-testid="new-session-modal"] input[placeholder*="e.g"]');
    if (await sessionInput.isVisible().catch(() => false)) {
      await sessionInput.fill('audit-test');
      logStep('Session name: audit-test');
    }

    // Fill message textarea
    const textareas = page.locator('[data-testid="new-session-modal"] textarea');
    const taCount = await textareas.count();

    if (taCount > 0) {
      await textareas.last().fill('Hello! List all files in the current directory and tell me what you see.');
      logStep('Filled message textarea.');
    } else {
      logIssue('No textarea found in prompt step');
    }

    await page.screenshot({ path: 'test-results/audit/08-ready.png', fullPage: true });

    // ═══════════════════════════════════════════
    // PHASE 6: START SESSION
    // ═══════════════════════════════════════════
    logStep('Phase 6: Start session');

    const startBtn = page.locator('button').filter({ hasText: /Start Session|Launch|Create Session|Begin/i }).first();
    const hasStart = await startBtn.isVisible().catch(() => false);

    if (!hasStart) {
      logIssue('Start Session button not found');
      const btns = page.locator('[data-testid="new-session-modal"] button');
      const count = await btns.count();
      const visible: string[] = [];
      for (let i = 0; i < count; i++) {
        if (await btns.nth(i).isVisible().catch(() => false)) {
          visible.push((await btns.nth(i).textContent())?.trim().substring(0, 30) || '');
        }
      }
      logStep(`Available buttons: ${visible.join(' | ')}`);
    } else {
      const isDisabled = await startBtn.isDisabled().catch(() => false);
      if (isDisabled) {
        logIssue('Start Session button is disabled');
      }
      await startBtn.click();
      logStep('Clicked Start Session. Waiting for navigation...');
      // Session creation involves: POST session, polling for readiness, sending initial message
      // Can take up to 60s for agent to start
      try {
        await page.waitForURL(/\/session\//, { timeout: 60_000 });
        logStep('URL changed to session view!');
      } catch {
        logIssue('Navigation to session view timed out after 60s');
      }
    }

    await page.screenshot({ path: 'test-results/audit/10-after-start.png', fullPage: true });

    // ═══════════════════════════════════════════
    // PHASE 7: VERIFY SESSION VIEW
    // ═══════════════════════════════════════════
    logStep('Phase 7: Verify session view');
    const url = page.url();
    logStep(`URL: ${url}`);

    if (url.includes('/session/')) {
      logStep('✅ Navigated to session view!');

      // Check session view elements
      const desktopView = page.getByTestId('session-view-desktop');
      await expect(desktopView).toBeVisible({ timeout: 10_000 });

      // Check message input
      const msgInput = page.getByTestId('message-input');
      await expect(msgInput).toBeVisible({ timeout: 5000 });
      logStep('Message input visible in session view.');

      // Test command palette
      await msgInput.fill('/mod');
      await page.waitForTimeout(800);
      const palette = page.locator('[class*="command"]');
      const hasPalette = await palette.first().isVisible().catch(() => false);
      if (hasPalette) {
        logStep('Command palette appeared on /mod');
      } else {
        logIssue('Command palette did not appear when typing /mod');
      }
      await msgInput.fill('');
      await page.waitForTimeout(300);

      // Send follow-up
      await msgInput.fill('What files are in the current directory?');
      const sendBtn = page.getByTestId('send-message-btn');
      if (await sendBtn.isVisible().catch(() => false)) {
        await sendBtn.click();
        logStep('Sent follow-up message.');
      }

      await page.waitForTimeout(8000);
      await page.screenshot({ path: 'test-results/audit/11-session-active.png', fullPage: true });

      // Check for conversation messages
      const convElements = page.locator('[class*="message-bubble"], [class*="conversation"] > div, [data-testid="session-view-desktop"] > div > div > div');
      const elCount = await convElements.count();
      logStep(`Found ${elCount} conversation elements.`);

    } else {
      logIssue(`Did not navigate to session view. URL: ${url}`);
    }

    // ═══════════════════════════════════════════
    // PHASE 8: SIDEBAR NAVIGATION
    // ═══════════════════════════════════════════
    logStep('Phase 8: Sidebar navigation');

    // Wait for modal to fully disappear before clicking sidebar links
    await page.getByTestId('new-session-modal').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    const homeLink = page.locator('a[href="/"]').first();
    if (await homeLink.isVisible().catch(() => false)) {
      await homeLink.click({ force: true });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const sessionCards = page.locator('.session-card');
      const cardCount = await sessionCards.count();
      logStep(`Back on home. Session cards: ${cardCount}`);

      if (cardCount === 0) {
        logIssue('No session cards on home after creating a session');
      }
    }

    await page.screenshot({ path: 'test-results/audit/12-final.png', fullPage: true });

    // ═══════════════════════════════════════════
    // ISSUE REPORT
    // ═══════════════════════════════════════════
    console.log('\n\n╔══════════════════════════════════════════════╗');
    console.log('║        EXPLORATORY AUDIT ISSUE REPORT        ║');
    console.log('╠══════════════════════════════════════════════╣');
    if (ISSUES.length === 0) {
      console.log('║ ✅ No issues found!                          ║');
    } else {
      ISSUES.forEach((issue, i) => console.log(`║ ${i + 1}. ${issue}`));
    }
    console.log('╚══════════════════════════════════════════════╝');

    if (networkErrors.length > 0) {
      console.log('\n[NETWORK ERRORS]');
      networkErrors.forEach(e => console.log(`  HTTP ${e.status}: ${e.url.substring(0, 80)}`));
    }

    // Write report
    const { writeFileSync, mkdirSync } = await import('fs');
    mkdirSync('test-results/audit', { recursive: true });
    writeFileSync('test-results/audit/issues.md', [
      `# Exploratory Audit Report`,
      `Date: ${new Date().toISOString()}`,
      ``,
      `## Issues (${ISSUES.length})`,
      ...ISSUES.map((issue, i) => `${i + 1}. ${issue}`),
      ``,
      `## Network Errors (${networkErrors.length})`,
      ...networkErrors.map(e => `- HTTP ${e.status}: ${e.url}`),
      ``,
      `## Console Errors (${consoleErrors.length})`,
      ...consoleErrors.map(e => `- ${e.substring(0, 150)}`),
    ].join('\n'));
    logStep('Report saved to test-results/audit/issues.md');
  });
});
