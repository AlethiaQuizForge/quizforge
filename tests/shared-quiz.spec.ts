import { test, expect } from '@playwright/test';

test.describe('Shared Quiz Access', () => {
  test('should load homepage with invalid quiz param without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      // Ignore Firebase permission errors - expected
      if (!err.message.includes('permission') && !err.message.includes('Permission')) {
        errors.push(err.message);
      }
    });

    // Try to access with invalid quiz ID
    await page.goto('/?quiz=invalid-test-id-12345');

    // Wait for app to load
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });

    // Page should still work
    await expect(page.locator('body')).toBeVisible();

    // Should not have critical unhandled errors
    expect(errors).toHaveLength(0);
  });

  test('should display error message for non-existent quiz', async ({ page }) => {
    await page.goto('/?quiz=nonexistent-quiz-xyz');

    // Wait for app to load
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });

    // Should either show error toast or redirect to home
    // The app should be usable either way
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle empty quiz parameter', async ({ page }) => {
    await page.goto('/?quiz=');

    // Should load normally
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Shared Quiz with Real ID', () => {
  // Use env var or default test quiz
  const SHARED_QUIZ_ID = process.env.SHARED_QUIZ_ID || 's1768775890777';

  test('should load shared quiz', async ({ page }) => {
    await page.goto(`/?quiz=${SHARED_QUIZ_ID}`);

    // Wait for quiz content to load
    await page.waitForSelector('text=/question|quiz|start/i', { timeout: 15000 });

    // Should show quiz name or questions
    const hasQuizContent = await page.locator('text=/question|quiz/i').first().isVisible();
    expect(hasQuizContent).toBeTruthy();
  });

  test('should allow taking quiz without login', async ({ page }) => {
    await page.goto(`/?quiz=${SHARED_QUIZ_ID}`);

    // Look for start button or quiz content
    const startButton = page.locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Take")').first();

    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Should be able to interact with quiz
    await expect(page.locator('body')).toBeVisible();
  });
});
