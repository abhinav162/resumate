import { test, expect } from '../fixtures';
import path from 'path';
import fs from 'fs';

// TC022 — Non-PDF upload is blocked with a validation error
// Verifies that uploading a non-PDF file shows a validation error

test('TC022 - non-PDF file upload shows validation error', async ({ page }) => {
  await page.goto('/upload');
  await page.waitForLoadState('networkidle');

  // Create a dummy .txt file for testing
  const txtPath = path.join(process.cwd(), 'playwright', '.auth', 'test.txt');
  fs.writeFileSync(txtPath, 'This is not a PDF file.');

  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeAttached({ timeout: 10_000 });
  await fileInput.setInputFiles(txtPath);

  // Validation error should appear
  await expect(
    page.getByText(/only pdf|pdf.*only|pdf.*allowed|invalid file/i).first()
  ).toBeVisible({ timeout: 5_000 });

  // Should NOT navigate away from /upload
  expect(page.url()).toContain('/upload');
});
