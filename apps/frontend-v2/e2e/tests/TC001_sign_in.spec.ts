import { test, expect } from '../fixtures';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

// TC001 — Sign in redirects user into the app workspace
// Verifies that signing in with valid credentials lands on /dashboard

test('TC001 - sign in redirects to dashboard', async ({ page }) => {
  // Start fresh (no stored auth)
  await page.context().clearCookies();

  await setupClerkTestingToken({ page });
  await page.goto('/sign-in');

  await page.waitForSelector('input[name="identifier"]', { timeout: 15_000 });
  await page.fill('input[name="identifier"]', process.env.E2E_USER_EMAIL ?? 'test1@gmail.com');
  await page.locator('button.cl-formButtonPrimary').click();

  await page.waitForSelector('input[name="password"]', { timeout: 10_000 });
  await page.fill('input[name="password"]', process.env.E2E_USER_PASSWORD ?? 'Resumate1234');
  await page.locator('button.cl-formButtonPrimary').click();

  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
});
