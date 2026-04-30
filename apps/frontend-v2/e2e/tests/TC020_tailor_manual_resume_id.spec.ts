import { test, expect } from '../fixtures';

// TC020 — Tailor page allows providing a resume ID manually
// Verifies the tailor form has a resume selector that accepts manual input

test('TC020 - tailor page allows selecting or entering resume ID', async ({ page }) => {
  await page.goto('/tailor');
  await page.waitForLoadState('networkidle');

  // There should be a resume selector (dropdown or text input for resume ID)
  const resumeSelector = page.locator('select').or(
    page.getByLabel(/resume/i).or(
      page.getByPlaceholder(/resume id|select resume/i)
    )
  ).first();

  await expect(resumeSelector).toBeVisible({ timeout: 10_000 });

  // Get a resume ID from the dashboard to use
  const dashResponse = await page.request.get('http://localhost:4300/api/resumes');
  const resumes = await dashResponse.json().catch(() => []);

  if (Array.isArray(resumes) && resumes.length > 0) {
    const firstId = resumes[0].id ?? resumes[0].uuid;
    if (firstId) {
      // Fill the resume selector with the ID
      const tag = await resumeSelector.evaluate((el: HTMLElement) => el.tagName.toLowerCase());
      if (tag === 'select') {
        await resumeSelector.selectOption(firstId);
      } else {
        await resumeSelector.fill(firstId);
      }
    }
  }

  // Job description is still required — just verify form is interactive
  const jdInput = page.getByPlaceholder(/job description/i).or(page.getByLabel(/job description/i)).first();
  await expect(jdInput).toBeVisible({ timeout: 5_000 });
});
