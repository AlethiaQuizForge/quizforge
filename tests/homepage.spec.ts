import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    // Wait for React to hydrate - look for the QuizForge logo/brand
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });

    await expect(page).toHaveTitle(/QuizForge/i);

    // Check no JavaScript errors (filter permission errors which are expected without auth)
    const criticalErrors = errors.filter(e => !e.includes('permission') && !e.includes('Permission'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('should display main content', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });

    // Check for main content - either landing page or auth form
    const hasContent = await page.locator('text=/quiz|sign|login|create/i').first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check Open Graph tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();
  });

  test('should toggle dark mode if available', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });

    // Look for dark mode toggle (sun/moon icon or theme button)
    const darkModeToggle = page.locator('button:has-text("🌙"), button:has-text("☀"), button[aria-label*="dark"], button[aria-label*="theme"]').first();

    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      // Give time for theme to apply
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Navigation', () => {
  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });
    // Wait for loading to complete
    await page.waitForFunction(() => !document.body.innerText.includes('Loading...'), { timeout: 15000 });

    // Check for navigation - either nav element or header with links
    const navElements = page.locator('nav, header, [role="navigation"]');
    expect(await navElements.count()).toBeGreaterThan(0);
  });

  test('should load pricing page', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page).toHaveURL(/pricing/);

    // Wait for content
    await page.waitForSelector('text=/free|pro|school|plan/i', { timeout: 15000 });
  });

  test('should load privacy page', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL(/privacy/);
  });

  test('should load terms page', async ({ page }) => {
    await page.goto('/terms');
    await expect(page).toHaveURL(/terms/);
  });
});
