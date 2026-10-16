import { captureReview, expect, test } from './review-capture';
import type { Page, APIRequestContext } from '@playwright/test';
import { api, login, ownerEmail } from './helpers';

async function capture(page: Page, name: string) { await captureReview(page, 'marketplace', name, { width: 1440, height: 900 }); }
async function marketplace(page: Page) {
  await login(page, ownerEmail, 'FinalOwnerPassword123!'); await page.goto('/en/plugins');
  await page.getByRole('tab', { name: 'Marketplace', exact: true }).click();
  await expect(page.getByRole('article', { name: 'E2E Marketplace Shipping', exact: true })).toBeVisible();
}
async function seedOlderVersion(request: APIRequestContext) {
  const token = (await api<{ token: string }>(request, '/auth/login', { method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' } })).token;
  const preview = await api<{ previewToken: string }>(request, '/extensions/marketplace/preview', { method: 'POST', token, data: { pluginId: 'e2e-market-update', version: '1.0.0' } });
  const operation = await api<{ operationId: string }>(request, '/extensions/marketplace/install', { method: 'POST', token, data: { pluginId: 'e2e-market-update', version: '1.0.0', previewToken: preview.previewToken, confirmMigrations: true } });
  let state: { terminal: boolean; phase: string; committedPrefix: number }, cursor = '';
  do {
    state = await api(request, `/extensions/plugin/operations/${operation.operationId}?wait=true${cursor}`, { token });
    cursor = `&phase=${encodeURIComponent(state.phase)}&committedPrefix=${state.committedPrefix}`;
  } while (!state.terminal);
  expect(state.phase).toBe('SUCCESS');
}

test('H test signing banner appears on authenticated dashboard but login makes no marketplace request', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/extensions/marketplace/status')) requests.push(request.url()); });
  await page.goto('/en/auth/login'); await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByText('Test signing mode', { exact: true })).toHaveCount(0); expect(requests).toEqual([]);
  await capture(page, 'login-no-banner'); await login(page, ownerEmail, 'FinalOwnerPassword123!'); await page.goto('/en/dashboard');
  await expect(page.getByText('Test signing mode', { exact: true })).toBeVisible(); await capture(page, 'dashboard-banner');
});

test('I real catalog uses honest trust copy and an incompatible latest release cannot be installed', async ({ page }) => {
  await marketplace(page);
  await expect(page.getByRole('article', { name: 'E2E Marketplace Shipping', exact: true }).getByText('Verified at install', { exact: true })).toBeVisible();
  const incompatible = page.getByRole('article', { name: 'E2E Incompatible Plugin', exact: true });
  await expect(incompatible.getByText(/Requires a newer Core version \(v99\)/)).toBeVisible();
  await expect(incompatible.getByRole('button', { name: 'Incompatible version', exact: true })).toBeDisabled(); await capture(page, 'incompatible');
  await page.goto('/zh-Hans/plugins?tab=market');
  await expect(page.getByRole('article', { name: 'E2E Marketplace Shipping', exact: true }).getByText('安装时验证', { exact: true })).toBeVisible();
  await capture(page, 'catalog-zh-Hans');
});

test('J install the latest real package after preview and show Test-signed on list and detail', async ({ page }) => {
  await marketplace(page); const entry = page.getByRole('article', { name: 'E2E Marketplace Shipping', exact: true });
  await entry.getByRole('button', { name: 'Install', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm installation', exact: true });
  await expect(dialog.getByText('Test-signed', { exact: true })).toBeVisible();
  const request = page.waitForRequest(request => request.url().endsWith('/extensions/marketplace/install') && request.method() === 'POST');
  await dialog.getByRole('button', { name: 'Confirm installation', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ pluginId: 'e2e-market-shipping', version: '2.0.0', previewToken: expect.any(String), confirmMigrations: true });
  await expect(dialog).toBeHidden(); await expect(entry.getByRole('button', { name: 'Installed', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'Installed', exact: true }).click();
  const installed = page.getByRole('article', { name: 'E2E Marketplace Shipping', exact: true });
  await expect(installed.getByText(/2\.0\.0/)).toBeVisible(); await expect(installed.getByText('Test-signed', { exact: true })).toBeVisible();
  await expect(installed.getByText('Disabled', { exact: true })).toBeVisible(); await capture(page, 'installed-test-signed');
  await installed.getByRole('link', { name: 'Manage', exact: true }).click();
  await expect(page.getByText('Test-signed', { exact: true }).first()).toBeVisible(); await expect(page.getByText('Verified', { exact: true })).toHaveCount(0);
});

test('K update an existing v1 installation to the latest v2 through its preview', async ({ page, request }) => {
  await seedOlderVersion(request); await marketplace(page);
  const entry = page.getByRole('article', { name: 'E2E Marketplace Update', exact: true });
  await expect(entry.getByText(/update available/i)).toBeVisible(); await entry.getByRole('button', { name: 'Update', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm installation', exact: true });
  await dialog.getByRole('button', { name: 'Confirm installation', exact: true }).click(); await expect(dialog).toBeHidden();
  await expect(entry.getByRole('button', { name: 'Installed', exact: true })).toBeDisabled();
  await expect(entry.getByText(/Installed 2\.0\.0/)).toBeVisible(); await expect(entry.getByText(/update available/i)).toHaveCount(0);
});

test('L real digest failure displays the refusal and installs nothing', async ({ page }) => {
  await marketplace(page); const entry = page.getByRole('article', { name: 'E2E Broken Package', exact: true });
  const response = page.waitForResponse(response => response.url().endsWith('/extensions/marketplace/preview'));
  await entry.getByRole('button', { name: 'Install', exact: true }).click();
  const failed = await response; expect(failed.status()).toBe(422); expect((await failed.json()).error.code).toBe('MARKETPLACE_DIGEST_MISMATCH');
  await expect(page.getByText('The package failed signature, identity, digest or compatibility checks.', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Confirm installation', exact: true }).getByRole('button', { name: 'Confirm installation', exact: true })).toBeDisabled();
  await capture(page, 'digest-error'); await page.getByRole('dialog', { name: 'Confirm installation', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: 'Installed', exact: true }).click(); await expect(page.getByRole('article', { name: 'E2E Broken Package', exact: true })).toHaveCount(0);
});
