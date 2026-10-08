import { captureReview, expect, test } from './review-capture';
import type { Page } from '@playwright/test';
import { login, ownerEmail } from './helpers';

async function capture(page: Page, name: string) {
  await captureReview(page, 'marketplace', name, { width: 1440, height: 900 });
}
async function marketplace(page: Page) {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/plugins');
  await page.getByRole('button', { name: 'Marketplace', exact: true }).click();
  await expect(page.getByRole('article', { name: 'E2E Marketplace Shipping' })).toBeVisible();
}

test('H test signing banner appears on authenticated dashboard but login makes no marketplace request', async ({ page }) => {
  const statusRequests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/extensions/marketplace/status')) statusRequests.push(request.url()); });
  await page.goto('/en/auth/login');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByText('Test signing mode', { exact: true })).toHaveCount(0);
  expect(statusRequests).toEqual([]);
  await capture(page, 'login-no-banner');
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/dashboard');
  await expect(page.getByText('Test signing mode', { exact: true })).toBeVisible();
  await capture(page, 'dashboard-banner');
});

test('I browse real catalog in English and Chinese and reject the incompatible version', async ({ page }) => {
  await marketplace(page);
  const entry = page.getByRole('article', { name: 'E2E Marketplace Shipping' });
  await expect(entry.getByText('Verified at install', { exact: true })).toBeVisible();
  await expect(entry.getByText('Declared capabilities (unverified): shipping', { exact: true })).toBeVisible();
  await capture(page, 'catalog-en');
  await entry.getByRole('button', { name: 'Details', exact: true }).click();
  await entry.getByRole('combobox', { name: 'E2E Marketplace Shipping Version' }).selectOption('3.0.0');
  await expect(entry.getByText('Incompatible version: Requires API v99', { exact: true })).toBeVisible();
  await expect(entry.getByRole('button', { name: 'Install', exact: true })).toBeDisabled();
  await capture(page, 'incompatible');
  await page.goto('/zh-Hans/plugins');
  await page.getByRole('button', { name: '插件市场', exact: true }).click();
  await expect(page.getByText('测试签名模式', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'E2E Marketplace Shipping' }).getByText('安装时验证', { exact: true })).toBeVisible();
  await capture(page, 'catalog-zh-Hans');
});

test('J install real marketplace v1 and show Test-signed without Verified in list and detail', async ({ page }) => {
  await marketplace(page);
  const entry = page.getByRole('article', { name: 'E2E Marketplace Shipping' });
  await entry.getByRole('button', { name: 'Details', exact: true }).click();
  await entry.getByRole('combobox', { name: 'E2E Marketplace Shipping Version' }).selectOption('1.0.0');
  const request = page.waitForRequest((request) => request.url().endsWith('/extensions/marketplace/install') && request.method() === 'POST');
  await entry.getByRole('button', { name: 'Install', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ pluginId: 'e2e-market-shipping', version: '1.0.0', previewToken: expect.any(String), confirmMigrations: true });
  await expect(page.getByText('Plugin installed successfully.', { exact: true })).toBeVisible();
  await expect(entry.getByText('Update available', { exact: true })).toBeVisible();
  await capture(page, 'update-available');
  await page.getByRole('button', { name: 'Installed plugins', exact: true }).click();
  const installed = page.getByRole('article', { name: 'E2E Marketplace Shipping' });
  await expect(installed.getByText('Version: 1.0.0', { exact: true })).toBeVisible();
  await expect(installed.getByText('Test-signed', { exact: true })).toBeVisible();
  await expect(installed.getByText('Verified', { exact: true })).toHaveCount(0);
  await capture(page, 'installed-test-signed');
  await installed.getByRole('link', { name: 'Manage', exact: true }).click();
  await expect(page.getByText('Test-signed', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Verified', { exact: true })).toHaveCount(0);
});

test('K update marketplace v1 to v2 and refresh catalog and installed version', async ({ page }) => {
  await marketplace(page);
  const entry = page.getByRole('article', { name: 'E2E Marketplace Shipping' });
  await expect(entry.getByText('Update available', { exact: true })).toBeVisible();
  await entry.getByRole('button', { name: 'Details', exact: true }).click();
  await entry.getByRole('combobox', { name: 'E2E Marketplace Shipping Version' }).selectOption('2.0.0');
  await entry.getByRole('button', { name: 'Update', exact: true }).click();
  await expect(page.getByText('Plugin installed successfully.', { exact: true })).toBeVisible();
  await expect(entry.getByText('Installed version: 2.0.0', { exact: true })).toBeVisible();
  await expect(entry.getByText('Update available', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Installed plugins', exact: true }).click();
  await expect(page.getByRole('article', { name: 'E2E Marketplace Shipping' }).getByText('Version: 2.0.0', { exact: true })).toBeVisible();
});

test('L real digest failure displays an error and installs nothing', async ({ page }) => {
  await marketplace(page);
  const entry = page.getByRole('article', { name: 'E2E Broken Package' });
  const response = page.waitForResponse((response) => response.url().endsWith('/extensions/marketplace/preview'));
  await entry.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(entry.getByRole('button', { name: 'Install', exact: true })).toBeDisabled();
  const failed = await response;
  expect(failed.status()).toBe(422);
  expect((await failed.json()).error.code).toBe('MARKETPLACE_DIGEST_MISMATCH');
  await expect(page.getByText('The package failed signature, identity, digest or compatibility checks.', { exact: true })).toBeVisible();
  await capture(page, 'digest-error');
  await page.getByRole('button', { name: 'Installed plugins', exact: true }).click();
  await expect(page.getByRole('article', { name: 'E2E Broken Package' })).toHaveCount(0);
});
