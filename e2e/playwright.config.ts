import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const areas = [
  '01-install', '02-login', '03-password', '04-language', '05-settings',
  '06-health-plugins', '07-products', '08-orders', '09-customers',
  '10-staff', '11-forgot-password',
];

export default defineConfig({
  testDir: '.',
  outputDir: 'test-results/artifacts',
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: resolve(__dirname, 'test-results/playwright-report.json') }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3002',
    channel: 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: areas.map((name, index) => ({
    name,
    testMatch: `${name}.spec.ts`,
    dependencies: index ? [areas[index - 1]] : [],
  })),
});
