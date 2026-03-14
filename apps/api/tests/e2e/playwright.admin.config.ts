import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

const repoRoot = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const testDatabaseUrl = process.env.DATABASE_URL_TEST;
if (!testDatabaseUrl) {
  throw new Error('DATABASE_URL_TEST is required for E2E tests.');
}
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';
const adminBaseUrl = process.env.E2E_ADMIN_BASE_URL || 'http://127.0.0.1:3002';

export default defineConfig({
  testDir: path.resolve(__dirname, './admin'),
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: path.resolve(__dirname, './playwright-report') }]],
  globalSetup: path.resolve(__dirname, './setup/global-setup.ts'),
  use: {
    baseURL: adminBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: path.resolve(__dirname, './.auth/admin-storage-state.json'),
  },
  webServer: [
    {
      command: 'pnpm --filter api dev',
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: repoRoot,
      env: {
        ...process.env,
        DATABASE_URL_TEST: testDatabaseUrl,
        DATABASE_URL: testDatabaseUrl,
        DISABLE_RATE_LIMITER: 'true',
      },
    },
    {
      command: 'pnpm --filter admin dev',
      url: adminBaseUrl,
      reuseExistingServer: false,
      timeout: 240_000,
      cwd: repoRoot,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
