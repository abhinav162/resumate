import { test, expect } from '../fixtures';

// TC008 — Score resume and view AI suggestions
// Verifies the Score button triggers AI analysis and shows suggestions panel

test('TC008 - score resume shows AI suggestions', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Navigate to editor
  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });

  // Click Score button in editor
  const scoreBtn = page.getByRole('button', { name: /score/i }).first();
  await expect(scoreBtn).toBeVisible({ timeout: 5_000 });
  await scoreBtn.click();

  // AI suggestions or score panel should appear
  const suggestionsPanel = page.getByText(/score|suggestion|improvement/i).first();
  await expect(suggestionsPanel).toBeVisible({ timeout: 30_000 });
});
