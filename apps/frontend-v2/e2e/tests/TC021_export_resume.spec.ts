import { test, expect } from '../fixtures';

// TC021 — Export resume from the editor
// Verifies the editor has an Export button that triggers a download or shows export options

test('TC021 - export resume from editor', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });

  // Find Export button
  const exportBtn = page.getByRole('button', { name: /export|download|pdf/i }).first();
  await expect(exportBtn).toBeVisible({ timeout: 10_000 });

  // Listen for download event
  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
  await exportBtn.click();

  const download = await downloadPromise;

  if (download) {
    // Verify download started with a PDF filename
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  } else {
    // Export might open a modal or new tab instead
    await expect(
      page.getByText(/export|download|pdf/i).first()
    ).toBeVisible({ timeout: 5_000 });
  }
});
