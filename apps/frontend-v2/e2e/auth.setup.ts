import { test as setup, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { seedTestResume } from './global-setup';

const AUTH_FILE = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto('/sign-in');

  // Wait for Clerk sign-in form to load
  await page.waitForSelector('input[name="identifier"]', { timeout: 15_000 });

  // Fill email and click Continue (use visible button by role+name, not hidden type=submit)
  await page.fill('input[name="identifier"]', process.env.E2E_USER_EMAIL ?? 'test1@gmail.com');
  await page.locator('button.cl-formButtonPrimary').click();

  // Wait for password field
  await page.waitForSelector('input[name="password"]', { timeout: 10_000 });
  await page.fill('input[name="password"]', process.env.E2E_USER_PASSWORD ?? 'Resumate1234');
  await page.locator('button.cl-formButtonPrimary').click();

  // Wait until redirected to dashboard
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

  // Seed test resume directly via DB (bypasses rate limiter, no HTTP needed)
  await seedTestResume();

  // Save signed-in state
  await page.context().storageState({ path: AUTH_FILE });
});
