import { test, expect } from '../fixtures';

// TC002 — Dashboard lists resumes with key metadata
// Verifies resume cards appear with name and action buttons after Clerk auth loads

test('TC002 - dashboard shows resume list with metadata', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Wait for resumes to load — the Edit button appears on each resume card
  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 15_000 });

  // At least one resume name should be visible (the seeded resume is "Alex Johnson's Resume")
  await expect(page.getByText(/Alex Johnson|resume/i).first()).toBeVisible({ timeout: 5_000 });
});
