import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { captureReview, expect, test } from './review-capture';
import { login, ownerEmail } from './helpers';
import { themePackage } from './theme-package';

const fixtureImage = async () => ({ name: 'merchant-image.png', mimeType: 'image/png',
  buffer: await readFile(resolve(__dirname, 'fixtures/themes/test-admin-logo.png')) });
const canonical = /^\/uploads\/products\/[a-f0-9]{64}\/original\.jpg$/;

test('G uploaded product image survives Admin save and renders in Shop through the API', async ({ page, context }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/products/create');
  await page.getByPlaceholder('Enter product title...').fill('B5 Media Product');
  await page.getByPlaceholder('e.g. Red / XL').fill('Standard');
  await page.getByPlaceholder('SKU-REF').fill('B5-MEDIA-001');
  await page.getByPlaceholder('0.00').fill('19.99');
  await page.getByPlaceholder('0', { exact: true }).fill('20');
  const uploaded = page.waitForResponse(response => response.url().endsWith('/admin/products/upload-image') && response.request().method() === 'POST');
  await page.getByLabel('Upload', { exact: true }).setInputFiles(await fixtureImage());
  const response = await uploaded; expect(response.status()).toBe(200);
  const url = (await response.json()).data.url; expect(url).toMatch(canonical);
  await expect(page.getByRole('img', { name: 'Asset', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save Product' }).click();
  await expect(page).toHaveURL(/\/products/);
  await expect(page.getByRole('link', { name: 'B5 Media Product', exact: true })).toBeVisible();
  const shop = await context.newPage();
  const media = shop.waitForResponse(response => new URL(response.url()).pathname === url);
  await shop.goto('http://127.0.0.1:3003/en/products');
  await expect(shop.getByRole('img', { name: 'B5 Media Product', exact: true })).toHaveAttribute('src', url);
  const served = await media; expect(served.status()).toBe(200);
  expect(served.headers()['cache-control']).toContain('immutable');
  await captureReview(shop, 'upload-storage-review', 'product-shop-en', { width: 1440, height: 900 });
  for (const [locale, title] of [['en', 'Upload storage is temporarily unavailable. Try again shortly.'],
    ['zh-Hans', '上传存储暂时不可用，请稍后重试。'], ['zh-Hant', '上傳儲存暫時無法使用，請稍後再試。']]) {
    await shop.goto(`http://127.0.0.1:3003/availability?locale=${locale}&status=503&code=UPLOAD_STORAGE_UNAVAILABLE&retryAt=0&returnTo=%2Fen`);
    await expect(shop.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await captureReview(shop, 'upload-storage-review', `unavailable-shop-${locale}`, { width: 1440, height: 900 });
  }
  await shop.close();
});

test('G avatar upload saves its avatar URL and remains visible after reload', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/profile');
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(/.+/);
  await expect(page.getByLabel('Avatar URL', { exact: true })).toBeEnabled();
  const uploaded = page.waitForResponse(response => response.url().endsWith('/account/avatar') && response.request().method() === 'POST');
  await page.getByLabel('Upload Avatar', { exact: true }).setInputFiles(await fixtureImage());
  const response = await uploaded; expect(response.status()).toBe(200);
  const url = (await response.json()).data.url;
  expect(url).toMatch(/^\/uploads\/avatars\/[a-f0-9]{64}\/original\.jpg$/);
  await expect(page.getByLabel('Avatar URL', { exact: true })).toHaveValue(url);
  const saved = page.waitForResponse(response => response.url().endsWith('/account/profile') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(page.getByLabel('Avatar URL', { exact: true })).toHaveValue(url);
  const name = await page.getByLabel('Username', { exact: true }).inputValue();
  await expect(page.getByRole('img', { name, exact: true }).first()).toHaveAttribute('src', url);
  await captureReview(page, 'upload-storage-review', 'avatar-admin-en', { width: 1440, height: 900 });
});

test('G theme media upload saves a canonical URL and renders in Shop after reload', async ({ page, context }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/themes');
  await page.getByLabel('Theme package', { exact: true }).setInputFiles({ name: 'b5-theme.zip', mimeType: 'application/zip', buffer: await themePackage(false, true) });
  await page.getByLabel('I trust this unsigned theme package').check();
  await page.getByRole('button', { name: 'Upload theme', exact: true }).click();
  const row = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'E2E Upload Theme', exact: true }) });
  await row.getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(row.getByText('Active', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Configure', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Configure E2E Upload Theme', exact: true });
  const uploaded = page.waitForResponse(response => response.url().endsWith('/admin/products/upload-image') && response.request().method() === 'POST');
  await editor.getByLabel('Upload image', { exact: true }).setInputFiles(await fixtureImage());
  const response = await uploaded; expect(response.status()).toBe(200);
  const url = (await response.json()).data.url; expect(url).toMatch(canonical);
  await expect(editor.getByLabel('Hero image', { exact: true })).toHaveValue(url);
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(page.getByText('Configuration saved', { exact: true })).toBeVisible();
  const shop = await context.newPage();
  const served = shop.waitForResponse(response => new URL(response.url()).pathname === url);
  await shop.goto('http://127.0.0.1:3003/en');
  await expect(shop.getByRole('img', { name: 'Theme hero', exact: true })).toHaveAttribute('src', url);
  expect((await served).status()).toBe(200);
  await shop.reload();
  await expect(shop.getByRole('img', { name: 'Theme hero', exact: true })).toHaveAttribute('src', url);
  await captureReview(shop, 'upload-storage-review', 'theme-shop-en', { width: 1440, height: 900 });
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Restore previous theme', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Uninstall', exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Uninstall', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E2E Upload Theme', exact: true })).toHaveCount(0);
  await shop.close();
});
