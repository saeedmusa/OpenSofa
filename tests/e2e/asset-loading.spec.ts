/**
 * Asset Loading & MIME Type Diagnostic Tests
 *
 * Verifies that CSS, JS, and HTML assets load with correct Content-Type headers.
 * This catches the "CSS loaded as text/plain" regression.
 */
import { test, expect } from '@playwright/test';

test.describe('Asset Loading', () => {
  test('index.html loads with text/html content type', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('text/html');
  });

  test('CSS assets load with text/css content type', async ({ page, request }) => {
    // Navigate to collect CSS URLs from the loaded page
    const cssUrls: string[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('.css')) {
        cssUrls.push(response.url());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (cssUrls.length === 0) {
      // Try to find CSS links directly
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(el => (el as HTMLLinkElement).href)
      );
      cssUrls.push(...links);
    }

    expect(cssUrls.length).toBeGreaterThan(0);

    for (const cssUrl of cssUrls) {
      const url = new URL(cssUrl);
      const response = await request.get(url.pathname);
      expect(response.status()).toBe(200);
      const contentType = response.headers()['content-type'] || '';
      expect(
        contentType,
        `CSS asset ${url.pathname} should have text/css content type, got: ${contentType}`
      ).toContain('text/css');
    }
  });

  test('JS assets load with text/javascript content type', async ({ page, request }) => {
    const jsUrls: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/assets/') && url.endsWith('.js')) {
        jsUrls.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(jsUrls.length).toBeGreaterThan(0);

    for (const jsUrl of jsUrls.slice(0, 3)) {
      const url = new URL(jsUrl);
      const response = await request.get(url.pathname);
      expect(response.status()).toBe(200);
      const contentType = response.headers()['content-type'] || '';
      expect(
        contentType,
        `JS asset ${url.pathname} should have text/javascript content type, got: ${contentType}`
      ).toContain('text/javascript');
    }
  });

  test('manifest.json loads correctly', async ({ request }) => {
    const response = await request.get('/manifest.json');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');
  });

  test('sw.js loads correctly', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('text/javascript');
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('[SW]') &&
        !e.includes('service-worker') &&
        !e.includes('favicon') &&
        !e.includes('404')
    );

    expect(criticalErrors).toEqual([]);
  });
});
