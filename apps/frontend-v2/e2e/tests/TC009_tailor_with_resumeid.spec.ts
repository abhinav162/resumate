import { test, expect } from '../fixtures';

// TC009 — Tailor a resume using a resumeId query param
// Verifies tailor page pre-populates the resume ID field when resumeId is in URL

test('TC009 - tailor page uses resumeId from query param', async ({ page }) => {
  // Navigate to dashboard and wait for resumes to load
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Click Edit to enter the editor — extracting resumeId from the URL
  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();

  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });
  const resumeId = page.url().split('/editor/')[1];

  if (!resumeId) {
    test.skip(true, 'No resumes available — upload a resume first');
    return;
  }

  // Navigate to tailor with the resumeId
  await page.goto(`/tailor?resumeId=${resumeId}`);
  await page.waitForLoadState('networkidle');

  // The resume ID field should be pre-filled
  const resumeInput = page.getByPlaceholder(/paste resume id/i).or(
    page.getByLabel(/resume id/i)
  ).first();
  await expect(resumeInput).toBeVisible({ timeout: 5_000 });

  const value = await resumeInput.inputValue();
  expect(value).toBe(resumeId);

  // Job description input should be present
  await expect(
    page.getByPlaceholder(/job description/i).or(page.getByLabel(/job description/i)).first()
  ).toBeVisible({ timeout: 5_000 });
});
