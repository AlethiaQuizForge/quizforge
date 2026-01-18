import { test, expect } from '@playwright/test';

test.describe('Authentication UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to fully load (not just loading screen)
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });
    // Wait for loading to complete
    await page.waitForFunction(() => !document.body.innerText.includes('Loading...'), { timeout: 15000 });
  });

  test('should display auth options on landing page', async ({ page }) => {
    // Look for sign in/sign up text or buttons
    const authText = page.locator('text=/sign in|sign up|log in|get started|create account/i').first();
    await expect(authText).toBeVisible({ timeout: 10000 });
  });

  test('should have Google sign-in option', async ({ page }) => {
    // Google button might have different text/icon
    const googleButton = page.locator('button:has-text("Google"), [aria-label*="Google"], button:has-text("Continue with Google")').first();

    // It might be on a modal, click sign in first if needed
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible()) {
      await signInButton.click();
      await page.waitForTimeout(500);
    }

    // Now check for Google button
    const isGoogleVisible = await googleButton.isVisible().catch(() => false);
    expect(isGoogleVisible).toBeTruthy();
  });

  test('should show email/password form', async ({ page }) => {
    // Click sign in if needed to show form
    const signInButton = page.locator('text=/sign in|log in|email/i').first();
    if (await signInButton.isVisible()) {
      await signInButton.click();
      await page.waitForTimeout(500);
    }

    // Look for email input
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[name="email"]').first();
    const hasEmailInput = await emailInput.isVisible().catch(() => false);

    // Auth form should be accessible
    expect(hasEmailInput).toBeTruthy();
  });
});

test.describe('Protected Routes', () => {
  test('should handle unauthenticated access gracefully', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      // Ignore expected Firebase permission errors
      if (!err.message.includes('permission') && !err.message.includes('Permission')) {
        errors.push(err.message);
      }
    });

    await page.goto('/');
    await page.waitForSelector('text=QuizForge', { timeout: 15000 });

    // Should not have unhandled errors
    expect(errors).toHaveLength(0);
  });
});
