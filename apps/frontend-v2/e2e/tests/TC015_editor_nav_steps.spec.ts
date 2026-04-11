import { test, expect } from '../fixtures';

// TC015 — Navigate editor steps using the left rail
// Verifies clicking steps in the left tool rail changes the active section

test('TC015 - left rail navigation switches editor sections', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });

  // The editor left rail is a div.w-16 containing icon-only buttons (Contact, Experience, ...)
  // Default is "Contact" (index 0), click "Experience" (index 1) and verify section changes
  const navButtons = page.locator('div.w-16 button');
  await expect(navButtons.first()).toBeVisible({ timeout: 10_000 });
  const count = await navButtons.count();
  expect(count).toBeGreaterThan(1);

  // Current section heading should show "01. Contact" (default)
  await expect(page.getByRole('heading', { name: /contact/i }).first()).toBeVisible({ timeout: 5_000 });

  // Click Experience (index 1)
  await navButtons.nth(1).click();

  // Section heading should now show Experience
  await expect(page.getByRole('heading', { name: /experience/i }).first()).toBeVisible({ timeout: 5_000 });

  // Click Education (index 2)
  await navButtons.nth(2).click();

  // Section heading should now show Education
  await expect(page.getByRole('heading', { name: /education/i }).first()).toBeVisible({ timeout: 5_000 });
});
