import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const areas = [
  '01-install', '02-login', '03-password', '04-language', '05-settings',
  '06-health-plugins', '07-products', '08-orders', '09-customers',
  '10-staff', '11-forgot-password',
  '12-translations',
  '13-shop',
  '14-shop-registration', '15-shop-account', '16-shop-checkout-price-stock',
  '17-shop-order-history-cancel', '18-order-refund',
  '19-themes',
  '20-admin-theme',
  '21-shop-page-boundaries',
  '22-shop-payment-csp',
  '23-shop-storefront-code',
  '24-admin-storefront-code',
  '25-shop-provider-code',
  '26-shop-purchase-tracking',
  '27-admin-audit-events',
  '28-disabled-payment-plugin',
  '29-plugin-config',
  '30-marketplace',
  '31-plugin-upload',
  '32-plugin-removal',
  '33-plugin-recorded-error',
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
  projects: [...areas.map((name, index) => ({
    name,
    testMatch: `${name}.spec.ts`,
    use: { baseURL: ['13-shop', '14-shop-registration', '15-shop-account'].includes(name) ? 'http://127.0.0.1:3003' : 'http://127.0.0.1:3002' },
    dependencies: index ? [areas[index - 1]] : [],
  })), {
    name: 'visual',
    testMatch: 'visual.spec.ts',
    dependencies: ['19-themes'],
  }],
});
