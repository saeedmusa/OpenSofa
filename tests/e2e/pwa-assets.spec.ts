import { test, expect } from '@playwright/test';

test.describe('PWA Assets', () => {
  test('should have valid manifest.json', async ({ request }) => {
    const response = await request.get('/manifest.json');
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('should load all manifest icons', async ({ request }) => {
    const response = await request.get('/manifest.json');
    const manifest = await response.json();

    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src);
      expect(
        iconResponse.status(),
        `Icon ${icon.src} should be accessible`
      ).toBe(200);
    }
  });

  test('should have offline.html fallback', async ({ request }) => {
    const response = await request.get('/offline.html');
    expect(response.status()).toBe(200);
  });

  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hasSW = await page.evaluate(() =>
      navigator.serviceWorker?.getRegistration()
        .then((r) => !!r)
        .catch(() => false)
    );
    expect(hasSW).toBe(true);
  });
});
