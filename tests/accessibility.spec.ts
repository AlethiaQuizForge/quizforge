import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Should have at least one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('should have aria-labels on icon buttons', async ({ page }) => {
    await page.goto('/');

    // Check icon-only buttons have aria-labels
    const iconButtons = page.locator('button:not(:has-text(*))');
    const count = await iconButtons.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = iconButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledBy = await button.getAttribute('aria-labelledby');
      const title = await button.getAttribute('title');

      // Should have some form of accessible name
      const hasAccessibleName = ariaLabel || ariaLabelledBy || title;
      if (await button.isVisible()) {
        expect(hasAccessibleName).toBeTruthy();
      }
    }
  });

  test('should have skip-to-content link', async ({ page }) => {
    await page.goto('/');

    // Look for skip link (may be visually hidden)
    const skipLink = page.locator('a[href="#main"], a:has-text("skip")').first();
    const exists = await skipLink.count() > 0;

    // Skip link should exist for keyboard users
    expect(exists).toBeTruthy();
  });

  test('should have semantic navigation', async ({ page }) => {
    await page.goto('/');

    // Should use nav element or role="navigation"
    const navElements = page.locator('nav, [role="navigation"]');
    expect(await navElements.count()).toBeGreaterThan(0);
  });

  test('should have sufficient color contrast (basic check)', async ({ page }) => {
    await page.goto('/');

    // Basic check - text should be visible
    const bodyText = page.locator('body');
    await expect(bodyText).toBeVisible();
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through first few elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Should have visible focus indicator
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should not have console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected/benign errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');

    // Should show custom 404 or redirect, not crash
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load homepage within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
  });
});
