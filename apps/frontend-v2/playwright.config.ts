import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('.env', import.meta.url).pathname });

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  retries: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Auth setup runs first and saves session to playwright/.auth/user.json
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    // All other tests reuse the saved auth state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['auth-setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
