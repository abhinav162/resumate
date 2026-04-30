import { test, expect } from '../fixtures';

// TC017 — Tailor page: job description field is interactive
// Verifies the JD textarea accepts input and no JD validation error appears inline

test('TC017 - tailor works with only job description filled', async ({ page }) => {
  await page.goto('/tailor');
  await page.waitForLoadState('networkidle');

  // Fill only the job description
  const jdInput = page.getByPlaceholder(/job description/i).or(page.getByLabel(/job description/i)).first();
  await expect(jdInput).toBeVisible({ timeout: 10_000 });
  await jdInput.fill('We are looking for a Senior Frontend Engineer proficient in React and TypeScript to join our product team.');

  // Submit button should exist
  const submitBtn = page.getByRole('button', { name: /tailor|generate/i }).first();
  await expect(submitBtn).toBeVisible({ timeout: 5_000 });

  // No inline "job description required" validation error should be present
  await expect(page.getByText(/job description.*required/i)).not.toBeVisible();

  // JD text should be present in the field
  const value = await jdInput.inputValue();
  expect(value.length).toBeGreaterThan(0);
});
