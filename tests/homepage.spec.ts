import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await expect(page).toHaveTitle(/QuizForge/i);

    // Check no JavaScript errors
    expect(errors).toHaveLength(0);
  });

  test('should display login/signup options', async ({ page }) => {
    await page.goto('/');

    // Check for auth buttons or forms
    const hasAuthElements = await page.locator('button, input[type="email"], [data-testid="login"]').first().isVisible();
    expect(hasAuthElements).toBeTruthy();
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check Open Graph tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();
  });

  test('should toggle dark mode', async ({ page }) => {
    await page.goto('/');

    // Look for dark mode toggle
    const darkModeToggle = page.locator('button[aria-label*="dark"], button[aria-label*="theme"], [data-testid="dark-mode"]').first();

    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      // Verify theme changed (check for dark class on html/body)
      await expect(page.locator('html')).toHaveClass(/dark/);
    }
  });
});

test.describe('Navigation', () => {
  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');

    // Check for nav element or navigation links
    const navElements = page.locator('nav, [role="navigation"]');
    expect(await navElements.count()).toBeGreaterThan(0);
  });

  test('should load pricing page', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page).toHaveURL(/pricing/);

    // Check pricing content loads
    await expect(page.locator('text=/free|pro|school|university/i').first()).toBeVisible();
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
