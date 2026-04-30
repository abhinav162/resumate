import { test, expect } from '../fixtures';
import path from 'path';
import fs from 'fs';

// TC007 — Upload a PDF resume redirects into the editor
// Verifies that uploading a valid PDF on /upload navigates to the editor

test('TC007 - upload PDF navigates to editor', async ({ page }) => {
  await page.goto('/upload');
  await page.waitForLoadState('networkidle');

  // Use test PDF from playwright/.auth/test-resume.pdf (must be pre-populated with valid PDF)
  const pdfPath = path.join(process.cwd(), 'playwright', '.auth', 'test-resume.pdf');

  // Skip if test PDF is missing (CI without pre-generated PDF)
  test.skip(!fs.existsSync(pdfPath), 'test-resume.pdf not found — skipping');

  // Find file input and set the test PDF
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(pdfPath);

  // Should navigate to editor after successful parse — Gemini AI parse can be slow (30s+)
  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 60_000 });
});
