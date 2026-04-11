import { test as base, expect } from '@playwright/test';
import { setupClerkTestingToken, clerkSetup } from '@clerk/testing/playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env so VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are available.
// This runs once per worker process.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Call clerkSetup once per worker to obtain CLERK_FAPI and CLERK_TESTING_TOKEN.
// This makes one backend API call to create a testing token that bypasses bot protection.
let clerkSetupDone = false;

async function ensureClerkSetup() {
  if (!clerkSetupDone && !process.env.CLERK_TESTING_TOKEN) {
    try {
      await clerkSetup();
      clerkSetupDone = true;
    } catch {
      // If clerkSetup fails (no CLERK_SECRET_KEY), we proceed without bot-protection bypass.
      // Tests may fail if JWTs expire during the run.
    }
  }
}

/**
 * Extract the Clerk user ID from the stored auth state.
 * The __session cookie contains a short-lived JWT whose 'sub' claim is the user ID.
 */
function getUserIdFromAuth(): string | null {
  try {
    const authFile = path.resolve(__dirname, '../playwright/.auth/user.json');
    const authState = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
    const sessionCookie = authState.cookies?.find((c: any) => c.name === '__session');
    if (!sessionCookie) return null;
    const [, payloadB64] = sessionCookie.value.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Extended test fixture that:
 * 1. Calls clerkSetup (once per worker) to get CLERK_TESTING_TOKEN
 * 2. Calls setupClerkTestingToken so Clerk can refresh expired JWTs without bot protection
 * 3. Injects x-user-id header on all /api/ requests as a timing-race guard
 */
export const test = base.extend<object, object>({
  page: async ({ page }, use) => {
    // Ensure we have a testing token (fetched once per worker)
    await ensureClerkSetup();

    // Intercept Clerk FAPI requests and add testing token to bypass bot protection
    await setupClerkTestingToken({ page });

    // Inject x-user-id on backend API requests — guards against the race where
    // window.Clerk.user isn't hydrated yet when the first API call fires.
    const userId = getUserIdFromAuth();
    if (userId) {
      await page.route('**/api/**', async (route) => {
        const existing = route.request().headers();
        if (!existing['x-user-id']) {
          await route.continue({ headers: { ...existing, 'x-user-id': userId } });
        } else {
          await route.continue();
        }
      });
    }

    await use(page);
  },
});

export { expect };
