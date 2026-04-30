import { test, expect } from '../fixtures';

// TC013 — Credits page displays balance and available credit packs
// Verifies /credits shows current balance and purchasable packs

test('TC013 - credits page shows balance and packs', async ({ page }) => {
  await page.goto('/credits');
  await page.waitForLoadState('networkidle');

  // Should show "Buy Credits" heading
  await expect(page.getByRole('heading', { name: /buy credits/i })).toBeVisible({ timeout: 10_000 });

  // Should show current balance line
  await expect(page.getByText(/current balance/i)).toBeVisible({ timeout: 5_000 });

  // Should show at least one buyable credit pack
  await expect(
    page.getByRole('button', { name: /buy starter|buy pro|buy max|buy credits/i }).first()
  ).toBeVisible({ timeout: 5_000 });
});
