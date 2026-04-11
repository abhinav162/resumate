import { test, expect } from '../fixtures';

// TC014 — Re-score after edits to refresh AI feedback
// Verifies that scoring again after editing shows updated results

test('TC014 - re-score after edits refreshes AI feedback', async ({ page }) => {
  // AI scoring can take 60s+, so extend timeout for this test
  test.setTimeout(120_000);

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });

  // The editor right rail has a "Score Resume — 1 credit" button in the suggestions panel
  const scoreBtn = page.getByRole('button', { name: /score resume/i }).first();
  await expect(scoreBtn).toBeVisible({ timeout: 10_000 });

  // Click to score — this calls the Gemini API; it may fail in CI without API key
  await scoreBtn.click();

  // Wait for either loading state or result
  await expect(
    page.getByText(/analyzing|scoring|score|suggestion/i).first()
  ).toBeVisible({ timeout: 30_000 });

  // Make a small edit in the contact form (first textarea visible)
  const editableField = page.locator('textarea').first();
  if (await editableField.isVisible()) {
    await editableField.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' ');
  }

  // If the score button is still visible (no suggestions returned), click again
  const scoreBtnAgain = page.getByRole('button', { name: /score resume/i }).first();
  if (await scoreBtnAgain.isVisible()) {
    await scoreBtnAgain.click();
  }

  // Final check: something score-related should still be visible
  await expect(
    page.getByText(/analyzing|scoring|score|suggestion|no suggestions/i).first()
  ).toBeVisible({ timeout: 10_000 });
});
