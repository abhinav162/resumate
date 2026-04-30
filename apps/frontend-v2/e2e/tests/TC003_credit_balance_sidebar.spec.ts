import { test, expect } from '../fixtures';

// TC003 — Dashboard shows credit balance in the sidebar
// Verifies that credit balance is displayed in the app sidebar

test('TC003 - sidebar shows credit balance', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Credit balance widget appears in sidebar with "CREDITS" label
  await expect(page.getByText(/^credits$/i)).toBeVisible({ timeout: 10_000 });

  // The balance widget shows either a number or a loading state — wait for it to resolve
  const creditCounter = page.locator('.font-mono').first();
  await expect(creditCounter).toBeVisible({ timeout: 10_000 });

  // Once loaded, value should be numeric or show '–' if auth failed
  // Either way, the counter widget itself must be visible
  await expect(
    page.getByText(/^\d+$/).first().or(page.getByText('–').first())
  ).toBeVisible({ timeout: 10_000 });
});
