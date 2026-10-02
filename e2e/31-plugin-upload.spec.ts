import { captureReview, expect, test } from './review-capture';
import { login, ownerEmail } from './helpers';
import { uploadPackages } from './upload-packages';
import type { Page } from '@playwright/test';

let packages: Awaited<ReturnType<typeof uploadPackages>>;
test.beforeAll(async () => { packages = await uploadPackages(); });
test.afterAll(async () => { await packages.cleanup(); });
const labels = {
  en: { file: 'Plugin ZIP', preview: 'Preview package', continue: 'Continue', dialog: 'Confirm unsigned plugin installation', slug: 'Plugin slug confirmation', confirm: 'Confirm installation', cancel: 'Cancel', install: 'Install package', downgrade: 'Downgrade is not supported. Upload a higher version.' },
  'zh-Hans': { file: '插件 ZIP', preview: '预览插件包', continue: '继续', dialog: '确认安装未签名插件', slug: '确认插件标识', confirm: '确认安装', cancel: '取消', install: '安装插件包', downgrade: '不支持降级，请上传更高版本。' },
};
async function preview(page: Page, locale: keyof typeof labels, file: string) {
  await page.goto(`/${locale}/plugins`); await page.getByLabel(labels[locale].file, { exact: true }).setInputFiles(file);
  await page.getByRole('button', { name: labels[locale].preview, exact: true }).click();
}
async function capture(page: Page, name: string) { await captureReview(page, 'plugin-upload-review', name, { width: 1440, height: 900 }); }

test('M real unsigned upload requires a typed second confirmation, remains disabled and is audited', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  for (const locale of ['en', 'zh-Hans'] as const) {
    await preview(page, locale, packages.unsigned);
    await expect(page.getByRole('heading', { name: 'E2E Upload Unsigned', exact: true })).toBeVisible();
    await capture(page, `unsigned-warning-${locale}`);
    await page.getByRole('button', { name: labels[locale].continue, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: labels[locale].dialog, exact: true });
    await expect(dialog.getByRole('button', { name: labels[locale].confirm, exact: true })).toBeDisabled();
    await dialog.getByLabel(labels[locale].slug, { exact: true }).fill('wrong');
    await expect(dialog.getByRole('button', { name: labels[locale].confirm, exact: true })).toBeDisabled();
    await capture(page, `second-confirmation-${locale}`);
    await dialog.getByRole('button', { name: labels[locale].cancel, exact: true }).click();
  }
  await preview(page, 'en', packages.unsigned); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: labels.en.dialog, exact: true });
  await dialog.getByLabel(labels.en.slug, { exact: true }).fill('e2e-upload-unsigned');
  const response = page.waitForResponse(response => response.url().endsWith('/extensions/plugin/install'));
  await dialog.getByRole('button', { name: 'Confirm installation', exact: true }).click(); expect((await response).status()).toBe(200);
  const installed = page.getByRole('article', { name: 'E2E Upload Unsigned', exact: true });
  await expect(installed.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
  await expect(installed.getByRole('button', { name: 'Disable', exact: true })).toHaveCount(0);
  await page.goto('/en/audit-events');
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('PLUGIN_UNSIGNED_INSTALL_CONFIRMED');
  await expect(page.getByRole('row', { name: /e2e-upload-unsigned/ })).toBeVisible();
});

test('N real test-signed ZIP upgrades v1 to v2 and rejects downgrade through local upload', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!'); await preview(page, 'en', packages.signedV1);
  const first = page.waitForResponse(response => response.url().endsWith('/extensions/plugin/install'));
  await page.getByRole('button', { name: 'Install package', exact: true }).click(); expect((await first).status()).toBe(200);
  for (const locale of ['en', 'zh-Hans'] as const) {
    await preview(page, locale, packages.signedV2); await expect(page.getByText(/1\.0\.0 → 2\.0\.0/)).toBeVisible();
    await capture(page, `signed-upgrade-${locale}`);
  }
  await preview(page, 'en', packages.signedV2); const updated = page.waitForResponse(response => response.url().endsWith('/extensions/plugin/install'));
  await page.getByRole('button', { name: 'Install package', exact: true }).click(); const result = await updated;
  expect(result.status()).toBe(200); expect((await result.json()).data.version).toBe('2.0.0');
  const installed = page.getByRole('article', { name: 'E2E Upload Signed', exact: true });
  await expect(installed.getByText('Version: 2.0.0', { exact: true })).toBeVisible();
  await expect(installed.getByText('Test-signed', { exact: true })).toBeVisible();
  for (const locale of ['en', 'zh-Hans'] as const) {
    await preview(page, locale, packages.signedV1); await expect(page.getByText(labels[locale].downgrade, { exact: true })).toBeVisible();
    await capture(page, `downgrade-error-${locale}`);
  }
});
