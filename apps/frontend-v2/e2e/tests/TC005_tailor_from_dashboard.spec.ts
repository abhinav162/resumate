import { test, expect } from '../fixtures';

// TC005 — Start tailoring workflow from dashboard with a selected resume
// Verifies clicking Tailor on a resume card navigates to /tailor with resumeId

test('TC005 - tailor button on resume card links to tailor page', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Click the first Tailor button
  const tailorBtn = page.getByRole('link', { name: /tailor/i }).first();
  await expect(tailorBtn).toBeVisible({ timeout: 10_000 });
  await tailorBtn.click();

  // Should navigate to /tailor with optional resumeId query param
  await expect(page).toHaveURL(/\/tailor/, { timeout: 15_000 });

  // Tailor workspace should have a job description input
  await expect(page.getByPlaceholder(/job description/i).or(page.getByLabel(/job description/i)).first()).toBeVisible({ timeout: 10_000 });
});
