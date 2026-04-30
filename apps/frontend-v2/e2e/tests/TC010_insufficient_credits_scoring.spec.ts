import { test, expect } from '../fixtures';

// TC010 — Insufficient credits prompt when scoring from editor
// NOTE: Requires a test user with 0 credits. Set E2E_ZERO_CREDIT_USER_EMAIL/PASSWORD
// to run this test with a dedicated zero-credit account.

test('TC010 - insufficient credits shows prompt when scoring', async ({ page }) => {
  const zeroEmail = process.env.E2E_ZERO_CREDIT_USER_EMAIL;
  const zeroPass = process.env.E2E_ZERO_CREDIT_USER_PASSWORD;

  if (!zeroEmail || !zeroPass) {
    test.skip(true, 'Set E2E_ZERO_CREDIT_USER_EMAIL and E2E_ZERO_CREDIT_USER_PASSWORD to run this test');
    return;
  }

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const editBtn = page.getByRole('link', { name: /edit/i }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });

  const scoreBtn = page.getByRole('button', { name: /score/i }).first();
  await expect(scoreBtn).toBeVisible({ timeout: 5_000 });
  await scoreBtn.click();

  // Insufficient credits dialog/banner should appear
  await expect(
    page.getByText(/not enough credits|insufficient credits|credits required/i).first()
  ).toBeVisible({ timeout: 10_000 });

  // Should offer a link/button to get more credits
  await expect(
    page.getByRole('link', { name: /credits|get more|buy/i }).or(
      page.getByRole('button', { name: /credits|get more|buy/i })
    ).first()
  ).toBeVisible({ timeout: 5_000 });
});
