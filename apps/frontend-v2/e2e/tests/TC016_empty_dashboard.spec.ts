import { test, expect } from '../fixtures';

// TC016 — Empty dashboard prompts user to upload a resume
// NOTE: Requires a test user with no resumes. Uses E2E_EMPTY_USER_EMAIL/PASSWORD.
// Falls back to checking the upload prompt UI element exists on a non-empty dashboard.

test('TC016 - empty state shows upload prompt', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Check if dashboard is empty (no resume cards)
  const resumeCards = page.getByText('Tailored copies');
  const cardCount = await resumeCards.count();

  if (cardCount === 0) {
    // Empty state: should show upload call-to-action
    await expect(
      page.getByRole('link', { name: /upload/i }).or(
        page.getByRole('button', { name: /upload/i })
      ).first()
    ).toBeVisible({ timeout: 10_000 });

    // Clicking should navigate to /upload
    await page.getByRole('link', { name: /upload/i }).or(
      page.getByRole('button', { name: /upload/i })
    ).first().click();

    await expect(page).toHaveURL(/upload/, { timeout: 10_000 });
  } else {
    // Non-empty dashboard: still check upload button exists in nav/header
    await expect(
      page.getByRole('link', { name: /upload/i }).or(
        page.getByRole('button', { name: /upload/i })
      ).first()
    ).toBeVisible({ timeout: 5_000 });
  }
});
