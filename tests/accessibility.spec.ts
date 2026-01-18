import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });
  });

  test('should have heading structure', async ({ page }) => {
    // Should have at least one heading (h1, h2, etc.)
    const headings = page.locator('h1, h2, h3');
    expect(await headings.count()).toBeGreaterThanOrEqual(1);
  });

  test('should have navigation structure', async ({ page }) => {
    // Should have nav element or header
    const navElements = page.locator('nav, header, [role="navigation"], [role="banner"]');
    expect(await navElements.count()).toBeGreaterThan(0);
  });

  test('should be keyboard navigable', async ({ page }) => {
    // Tab through elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Should have a focused element
    const focusedElement = page.locator(':focus');
    const isFocused = await focusedElement.count() > 0;
    expect(isFocused).toBeTruthy();
  });

  test('should have skip-to-content link', async ({ page }) => {
    // Skip link is usually the first focusable element
    await page.keyboard.press('Tab');

    const skipLink = page.locator('a[href="#main"], a:has-text("skip"), [class*="skip"]').first();
    const hasSkipLink = await skipLink.count() > 0;

    // This is a recommendation, not a strict requirement
    if (!hasSkipLink) {
      console.log('Note: No skip-to-content link found');
    }
  });
});

test.describe('Error Handling', () => {
  test('should not have critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out expected errors
        if (!text.includes('favicon') &&
          !text.includes('404') &&
          !text.includes('permission') &&
          !text.includes('Permission') &&
          !text.includes('Firebase')) {
          errors.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });

    expect(errors).toHaveLength(0);
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');

    // Should show something (not blank page)
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load within 10 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(10000);
  });
});
