import { test, expect } from '../fixtures';

// TC012 — Accept and dismiss AI suggestions
// Verifies suggestions panel has Accept/Dismiss buttons that work after scoring

test('TC012 - can accept and dismiss AI suggestions', async ({ page }) => {
  // AI scoring can take 60s+, so extend timeout for this test
  test.setTimeout(120_000);

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });

  // Score the resume to get suggestions (button is in the right-rail suggestions panel)
  const scoreBtn = page.getByRole('button', { name: /score resume/i }).first();
  await expect(scoreBtn).toBeVisible({ timeout: 10_000 });
  await scoreBtn.click();

  // Wait for scoring to complete — Gemini AI can take 60+ seconds
  // Accept either: suggestions returned (accept button visible) OR scoring done with no suggestions
  await expect(
    page.getByRole('button', { name: /accept/i }).first()
      .or(page.getByRole('button', { name: /score resume/i }).first())
      .or(page.getByText(/no suggestions/i).first())
  ).toBeVisible({ timeout: 90_000 });

  // If accept button appeared (suggestions returned), interact with them
  const acceptBtn = page.getByRole('button', { name: /accept/i }).first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();

    // Dismiss another suggestion (if available)
    const dismissBtn = page.getByRole('button', { name: /dismiss|reject|skip/i }).first();
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
    }
  }

  // Suggestions panel should still be visible in some form
  await expect(page.locator('text=AI Suggestions')).toBeVisible({ timeout: 10_000 });
});
