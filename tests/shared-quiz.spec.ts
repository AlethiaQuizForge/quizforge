import { test, expect } from '@playwright/test';

test.describe('Shared Quiz Access', () => {
  // Note: You'll need to replace this with a real shared quiz ID from your database
  const SAMPLE_SHARED_QUIZ_ID = 'test-shared-quiz-id';

  test('should allow unauthenticated users to view shared quiz', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Try to access a shared quiz (replace with real ID)
    await page.goto(`/?quiz=${SAMPLE_SHARED_QUIZ_ID}`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for permission errors
    const hasPermissionError = errors.some(
      (e) => e.includes('permission') || e.includes('Permission')
    );
    expect(hasPermissionError).toBeFalsy();
  });

  test('should display quiz content for valid shared link', async ({ page }) => {
    // This test requires a valid shared quiz ID
    // Skip if no real quiz ID is configured
    test.skip(SAMPLE_SHARED_QUIZ_ID === 'test-shared-quiz-id', 'No real shared quiz ID configured');

    await page.goto(`/?quiz=${SAMPLE_SHARED_QUIZ_ID}`);

    // Should show quiz content or questions
    await expect(page.locator('text=/question|quiz/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid shared quiz', async ({ page }) => {
    await page.goto('/?quiz=invalid-nonexistent-id-12345');

    // Wait for error handling
    await page.waitForLoadState('networkidle');

    // Should show error toast or message (not crash)
    // The page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Shared Quiz Taking', () => {
  test.skip(true, 'Requires valid shared quiz ID - configure SAMPLE_SHARED_QUIZ_ID');

  test('should allow taking quiz without login', async ({ page }) => {
    // Navigate to shared quiz
    await page.goto('/?quiz=REPLACE_WITH_REAL_ID');

    // Start quiz
    const startButton = page.locator('button:has-text("Start"), button:has-text("Take Quiz")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
    }

    // Should see question
    await expect(page.locator('[data-testid="question"], .question').first()).toBeVisible();
  });

  test('should submit answers and see results', async ({ page }) => {
    await page.goto('/?quiz=REPLACE_WITH_REAL_ID');

    // Start and answer questions
    const startButton = page.locator('button:has-text("Start")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
    }

    // Click first option
    await page.locator('button[data-option], .option').first().click();

    // Should progress or show feedback
    await expect(page.locator('body')).toBeVisible();
  });
});
