import { test, expect } from '../fixtures';

// TC006 — Edit a resume from dashboard and return to dashboard
// Verifies the back button in the editor returns to /dashboard

test('TC006 - back button from editor returns to dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();

  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });

  // Click back button (← Dashboard or similar)
  const backBtn = page.getByRole('link', { name: /dashboard/i }).or(
    page.locator('a[href="/dashboard"]')
  ).first();
  await expect(backBtn).toBeVisible({ timeout: 5_000 });
  await backBtn.click();

  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
});
