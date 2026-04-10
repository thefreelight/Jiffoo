import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * 
 * Tests both shop (customer-facing) and admin (merchant) applications
 * with error monitoring, screenshot capture, and visual regression support.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  
  use: {
    // Base URL for API
    baseURL: 'http://localhost:3001',
    
    // Capture trace on first retry
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Viewport
    viewport: { width: 1280, height: 720 },
    
    // Timeout for actions
    actionTimeout: 15000,
    
    // Navigation timeout
    navigationTimeout: 30000,
  },
  
  // Global timeout
  timeout: 60000,
  
  // Expect timeout
  expect: {
    timeout: 10000,
  },
  
  projects: [
    // Shop frontend tests (customer-facing)
    {
      name: 'shop',
      testDir: './e2e/shop',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
      },
    },

    // Admin dashboard tests (merchant-facing, 原 tenant)
    {
      name: 'admin',
      testDir: './e2e/admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3003',
      },
    },

    // Super Admin tests (platform management, 原 admin)
    {
      name: 'super-admin',
      testDir: './e2e/super-admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3002',
      },
    },

    // Mobile shop tests
    {
      name: 'shop-mobile',
      testDir: './e2e/shop',
      use: {
        ...devices['iPhone 13'],
        baseURL: 'http://localhost:3000',
      },
    },
  ],

  // Web server configuration - starts dev servers before tests
  webServer: [
    {
      command: 'pnpm dev:api-only',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'pnpm dev:shop-only',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'pnpm dev:admin-only',
      url: 'http://localhost:3003',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'pnpm dev:super-admin-only',
      url: 'http://localhost:3002',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
  
  // Output directory for test artifacts
  outputDir: 'test-results',
});
