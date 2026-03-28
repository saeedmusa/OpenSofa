/**
 * Full Product Audit - OpenCode + GLM-4.7
 *
 * Walks the complete flow:
 * 1. Auth + WebSocket
 * 2. New session modal: Custom → OpenCode → directory → model → prompt
 * 3. Session creation with GLM-4.7
 * 4. Agent interaction: send message, observe file changes
 * 5. Command palette: /model, /agent switching
 * 6. Sidebar navigation back to home
 */

import { test, expect } from '@playwright/test';
import { TEST_TOKEN } from './fixtures';

const LOG: string[] = [];
function log(msg: string) {
  LOG.push(msg);
  console.log(msg);
}
function issue(msg: string) {
  LOG.push(`[ISSUE] ${msg}`);
  console.log(`\x1b[31m[ISSUE]\x1b[0m ${msg}`);
}
function step(msg: string) {
  LOG.push(`[STEP] ${msg}`);
  console.log(`\x1b[32m[STEP]\x1b[0m ${msg}`);
}

test.describe('Full Product Audit - OpenCode + GLM-4.7', () => {
  test.setTimeout(300_000);
  test.use({ viewport: { width: 1440, height: 900 } });

  test('complete product walkthrough with GLM-4.7', async ({ page }) => {
    // Collect console + network errors
    const consoleErrors: string[] = [];
    const networkErrors: { url: string; status: number }[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('response', res => { if (res.status() >= 400) networkErrors.push({ url: res.url(), status: res.status() }); });

    // ═══════════════════════════════════════════
    // 1. AUTH & LOAD
    // ═══════════════════════════════════════════
    step('1. Load app with auth');
    await page.addInitScript((token) => { localStorage.setItem('opensofa_token', token); }, TEST_TOKEN);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/full-audit/01-home.png', fullPage: true });

    await expect(page.getByTestId('desktop-home')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('connection-status')).toBeVisible({ timeout: 15_000 });
    const connText = await page.getByTestId('connection-status').textContent().catch(() => '');
    step(`Connection: ${connText}`);

    // ═══════════════════════════════════════════
    // 2. OPEN MODAL → CUSTOM → OPENCODE
    // ═══════════════════════════════════════════
    step('2. Open modal and select Custom → OpenCode');
    await page.getByTestId('new-session-btn').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('new-session-modal')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/full-audit/02-modal-templates.png', fullPage: true });

    // Click Custom
    await page.locator('button').filter({ hasText: /Custom.*Start from scratch/ }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/full-audit/03-agent-step.png', fullPage: true });

    // Select OpenCode
    const ocBtn = page.locator('button').filter({ hasText: /OpenCode/i }).first();
    await expect(ocBtn).toBeVisible({ timeout: 5000 });
    await ocBtn.click();
    await page.waitForTimeout(1500);
    step('Selected OpenCode agent');
    await page.screenshot({ path: 'test-results/full-audit/04-agent-selected.png', fullPage: true });

    // ═══════════════════════════════════════════
    // 3. MODEL SELECTION (in directory step)
    // ═══════════════════════════════════════════
    step('3. Model selection in directory step');
    await page.waitForTimeout(3000);

    // Wait for model discovery to complete
    const modelSelect = page.locator('[data-testid="new-session-modal"] select').first();
    await page.waitForFunction(() => {
      const sel = document.querySelector('[data-testid="new-session-modal"] select');
      if (!sel) return false;
      const opts = sel.querySelectorAll('option');
      return Array.from(opts).some(o => !o.textContent?.includes('Loading') && !o.textContent?.includes('No models') && o.value);
    }, { timeout: 20_000 }).catch(() => null);

    const hasSelect = await modelSelect.isVisible().catch(() => false);
    if (!hasSelect) {
      issue('Model select dropdown not visible in directory step');
    } else {
      // Check optgroups
      const optgroups = await modelSelect.locator('optgroup').all();
      const groupInfo: string[] = [];
      for (const group of optgroups) {
        const label = await group.getAttribute('label') ?? '';
        const optCount = await group.locator('option').count();
        groupInfo.push(`${label} (${optCount})`);
      }
      step(`Model providers: ${groupInfo.join(', ')}`);
      await page.screenshot({ path: 'test-results/full-audit/05-model-dropdown.png', fullPage: true });

      // Select GLM-4.7
      const allOptions = await modelSelect.locator('option').allTextContents();
      const glm47 = allOptions.find(o => o.includes('GLM') && o.includes('4.7'));
      if (glm47) {
        await modelSelect.selectOption({ label: glm47 });
        step(`Selected model: ${glm47}`);
      } else {
        issue(`GLM-4.7 not found in options: ${allOptions.slice(0, 10).join(', ')}`);
        const fallback = allOptions.find(o => !o.includes('Loading') && !o.includes('No models') && o.trim());
        if (fallback) { await modelSelect.selectOption({ label: fallback }); step(`Fallback: ${fallback}`); }
      }
    }

    await page.screenshot({ path: 'test-results/full-audit/06-model-selected.png', fullPage: true });

    // ═══════════════════════════════════════════
    // 4. DIRECTORY BROWSER → git repo
    // ═══════════════════════════════════════════
    step('4. Navigate to development/OpenSofa');
    await page.waitForTimeout(1000);

    // Click development
    const devBtn = page.locator('[data-testid="new-session-modal"] button').filter({ hasText: /^development$/i }).first();
    if (await devBtn.isVisible().catch(() => false)) {
      await devBtn.click();
      await page.waitForTimeout(1500);
      step('Entered development directory');

      // Click OpenSofa (git repo)
      const sofaBtn = page.locator('[data-testid="new-session-modal"] button').filter({ hasText: /^OpenSofa$/i }).first();
      if (await sofaBtn.isVisible().catch(() => false)) {
        await sofaBtn.click();
        await page.waitForTimeout(1500);
        step('Entered OpenSofa (git repo)');
      } else {
        issue('OpenSofa directory not found in development');
      }
    } else {
      issue('development directory not found');
    }

    await page.screenshot({ path: 'test-results/full-audit/07-directory.png', fullPage: true });

    // Continue with this directory
    const continueBtn = page.locator('button').filter({ hasText: /Continue with/i }).first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(1500);
      step('Clicked Continue → moved to prompt step');
    } else {
      issue('Continue button not found');
    }

    await page.screenshot({ path: 'test-results/full-audit/08-prompt-step.png', fullPage: true });

    // ═══════════════════════════════════════════
    // 5. FILL PROMPT + CREATE SESSION
    // ═══════════════════════════════════════════
    step('5. Fill prompt and create session');

    // Session name
    const nameInput = page.locator('[data-testid="new-session-modal"] input[placeholder*="e.g"]');
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('glm47-audit');
      step('Session name: glm47-audit');
    }

    // Message - ask agent to create/modify files so we can see file changes
    const textarea = page.locator('[data-testid="new-session-modal"] textarea').last();
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill('Create a file called hello.txt with the content "Hello from GLM-4.7!" and list all files in the current directory.');
      step('Filled message: file creation task');
    }

    await page.screenshot({ path: 'test-results/full-audit/09-ready.png', fullPage: true });

    // Click Start Session
    const startBtn = page.locator('button').filter({ hasText: /Start Session/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();
    step('Clicked Start Session...');

    // Wait for navigation
    try {
      await page.waitForURL(/\/session\//, { timeout: 90_000 });
      step('Navigated to session view!');
    } catch {
      issue('Navigation to session view timed out after 90s');
    }

    await page.screenshot({ path: 'test-results/full-audit/10-session-view.png', fullPage: true });

    // ═══════════════════════════════════════════
    // 6. VERIFY SESSION VIEW
    // ═══════════════════════════════════════════
    step('6. Verify session view');
    const url = page.url();
    step(`URL: ${url}`);

    if (url.includes('/session/')) {
      // Check session view layout
      await expect(page.getByTestId('session-view-desktop')).toBeVisible({ timeout: 10_000 });
      step('Session view desktop layout visible');

      // Check message input
      await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 5000 });
      step('Message input visible');

      // Wait for agent to process initial message
      step('Waiting for agent response (30s)...');
      await page.waitForTimeout(30000);
      await page.screenshot({ path: 'test-results/full-audit/11-agent-response.png', fullPage: true });

      // Check conversation for file change indicators
      const pageText = await page.textContent('body').catch(() => '');
      const hasFileMention = pageText?.includes('hello.txt') || pageText?.includes('file') || pageText?.includes('created');
      if (hasFileMention) {
        step('Agent response mentions files/creation');
      } else {
        step('Agent response may still be processing or no file mention found');
      }

      // ═══════════════════════════════════════════
      // 7. COMMAND PALETTE - /model
      // ═══════════════════════════════════════════
      step('7. Test command palette - /model');
      const msgInput = page.getByTestId('message-input');
      await msgInput.fill('/model');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/full-audit/12-cmd-model.png', fullPage: true });

      // Check if command palette or model list appeared
      const cmdPalette = page.locator('[class*="command"], [class*="palette"], [class*="Command"]');
      const hasPalette = await cmdPalette.first().isVisible().catch(() => false);
      if (hasPalette) {
        step('Command palette appeared for /model');
      } else {
        // Maybe it shows as inline suggestions or a different UI
        const bodyText = await page.textContent('body').catch(() => '');
        if (bodyText?.includes('model') || bodyText?.includes('Model')) {
          step('Model-related UI appeared (possibly inline)');
        } else {
          issue('No command palette or model UI appeared for /model');
        }
      }

      // ═══════════════════════════════════════════
      // 8. SWITCH AGENT via /agent or sidebar
      // ═══════════════════════════════════════════
      step('8. Test agent switching');

      // Clear input and try /agent command
      await msgInput.fill('');
      await page.waitForTimeout(300);
      await msgInput.fill('/agent');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/full-audit/13-cmd-agent.png', fullPage: true });

      const agentPalette = page.locator('[class*="command"], [class*="palette"], [class*="Command"]');
      const hasAgentPalette = await agentPalette.first().isVisible().catch(() => false);
      if (hasAgentPalette) {
        step('Command palette appeared for /agent');

        // Try to find and click a different agent option (e.g., Claude Code)
        const claudeOpt = page.locator('text=/claude/i').first();
        if (await claudeOpt.isVisible().catch(() => false)) {
          step('Found Claude Code option in agent switcher');
          // Don't actually click to avoid disrupting the session
        }
      } else {
        issue('No command palette or agent UI appeared for /agent');
      }

      // ═══════════════════════════════════════════
      // 9. SEND FOLLOW-UP MESSAGE
      // ═══════════════════════════════════════════
      step('9. Send follow-up message');
      await msgInput.fill('');
      await page.waitForTimeout(300);
      await msgInput.fill('Now read the hello.txt file and tell me what it says. Also list any other files that were changed.');
      const sendBtn = page.getByTestId('send-message-btn');
      if (await sendBtn.isVisible().catch(() => false)) {
        await sendBtn.click();
        step('Sent follow-up message');
      }

      // Wait for response
      await page.waitForTimeout(25000);
      await page.screenshot({ path: 'test-results/full-audit/14-followup-response.png', fullPage: true });

      // ═══════════════════════════════════════════
      // 10. NAVIGATE HOME VIA SIDEBAR
      // ═══════════════════════════════════════════
      step('10. Navigate home via sidebar');
      await page.getByTestId('new-session-modal').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);

      const homeLink = page.locator('a[href="/"]').first();
      if (await homeLink.isVisible().catch(() => false)) {
        await homeLink.click({ force: true });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        step('Navigated back to home');

        // Check session cards
        const bodyText = await page.textContent('body').catch(() => '');
        if (bodyText?.includes('glm47-audit') || bodyText?.includes('audit')) {
          step('Session card visible on home page');
        }
      }

      await page.screenshot({ path: 'test-results/full-audit/15-home-with-session.png', fullPage: true });
    } else {
      issue(`URL did not navigate to session view: ${url}`);
    }

    // ═══════════════════════════════════════════
    // REPORT
    // ═══════════════════════════════════════════
    const { writeFileSync, mkdirSync } = await import('fs');
    mkdirSync('test-results/full-audit', { recursive: true });
    writeFileSync('test-results/full-audit/report.md', [
      '# Full Product Audit Report',
      `Date: ${new Date().toISOString()}`,
      `Config: OpenCode agent, GLM-4.7 model`,
      '',
      '## Steps Log',
      ...LOG.map(l => `- ${l}`),
      '',
      '## Network Errors',
      ...networkErrors.map(e => `- HTTP ${e.status}: ${e.url.substring(0, 100)}`),
      '',
      '## Console Errors',
      ...consoleErrors.map(e => `- ${e.substring(0, 200)}`),
    ].join('\n'));
    step('Report saved to test-results/full-audit/report.md');
  });
});
