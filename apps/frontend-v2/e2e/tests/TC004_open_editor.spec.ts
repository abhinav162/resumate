import { test, expect } from '../fixtures';

// TC004 — Open resume editor from dashboard
// Verifies clicking Edit on a resume card navigates to the editor

test('TC004 - open editor from dashboard resume card', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Click the first Edit button (rendered as <button>, not <a>)
  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();

  // Should navigate to /editor/<id>
  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });

  // Editor is visible — check for Export button which is always present
  await expect(page.getByRole('button', { name: /export/i }).first()).toBeVisible({ timeout: 10_000 });
});
