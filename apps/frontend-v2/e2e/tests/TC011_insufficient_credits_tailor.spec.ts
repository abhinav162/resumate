import { test, expect } from '../fixtures';

// TC011 — Insufficient credits prompt when tailoring
// NOTE: Requires a test user with 0 credits. Set E2E_ZERO_CREDIT_USER_EMAIL/PASSWORD.

test('TC011 - insufficient credits shows prompt when tailoring', async ({ page }) => {
  const zeroEmail = process.env.E2E_ZERO_CREDIT_USER_EMAIL;
  const zeroPass = process.env.E2E_ZERO_CREDIT_USER_PASSWORD;

  if (!zeroEmail || !zeroPass) {
    test.skip(true, 'Set E2E_ZERO_CREDIT_USER_EMAIL and E2E_ZERO_CREDIT_USER_PASSWORD to run this test');
    return;
  }

  await page.goto('/tailor');
  await page.waitForLoadState('networkidle');

  // Fill job description
  const jdInput = page.getByPlaceholder(/job description/i).or(page.getByLabel(/job description/i)).first();
  await expect(jdInput).toBeVisible({ timeout: 5_000 });
  await jdInput.fill('Software Engineer at Acme Corp. Requirements: React, TypeScript, 3+ years experience.');

  // Submit
  const submitBtn = page.getByRole('button', { name: /tailor|generate/i }).first();
  await expect(submitBtn).toBeVisible({ timeout: 5_000 });
  await submitBtn.click();

  // Insufficient credits prompt should appear
  await expect(
    page.getByText(/not enough credits|insufficient credits|credits required/i).first()
  ).toBeVisible({ timeout: 10_000 });
});
