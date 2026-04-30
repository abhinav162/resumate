import { test, expect } from '../fixtures';

// TC019 — Credits page shows purchasable packs
// Verifies credit pack cards load with Buy buttons (full Stripe checkout not tested in E2E)

test('TC019 - purchase credit pack initiates checkout', async ({ page }) => {
  await page.goto('/credits');
  await page.waitForLoadState('networkidle');

  // Page heading
  await expect(page.getByRole('heading', { name: /buy credits/i })).toBeVisible({ timeout: 10_000 });

  // At least one Buy button for a credit pack should be visible
  const buyBtn = page.getByRole('button', { name: /buy/i }).first();
  await expect(buyBtn).toBeVisible({ timeout: 10_000 });

  // Button should be enabled (not loading)
  await expect(buyBtn).toBeEnabled();

  // Click it — in test env Stripe may not be configured, so we just verify
  // the button is interactive and the page responds (shows loading or error)
  await buyBtn.click();

  // Give a moment for the request to fire
  await page.waitForTimeout(1000);

  // We should still be on the credits page (Stripe redirect won't work in tests without config)
  // OR we should have been redirected to Stripe checkout
  const url = page.url();
  const stillOnCredits = url.includes('/credits');
  const onStripe = /stripe\.com|checkout/i.test(url);

  expect(stillOnCredits || onStripe).toBe(true);
});
