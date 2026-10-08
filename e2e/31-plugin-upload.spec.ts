import { captureReview, expect, test } from './review-capture';
import { login, ownerEmail } from './helpers';
import { uploadPackages } from './upload-packages';
import type { Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { merchant as english } from '../packages/shared/src/i18n/messages/en/merchant';
import { merchant as simplified } from '../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as traditional } from '../packages/shared/src/i18n/messages/zh-Hant/merchant';

let packages: Awaited<ReturnType<typeof uploadPackages>>;
const db = new PrismaClient();
test.beforeAll(async () => { packages = await uploadPackages(); });
test.afterAll(async () => {
  try {
    const database = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    if (database[0]?.name !== 'jiffoo_core_test') throw new Error('Upload fixture cleanup requires jiffoo_core_test.');
    for (const slug of ['e2e-upload-unsigned', 'e2e-upload-signed', 'e2e-upload-migration', 'e2e-upload-migration-retry']) {
      await db.pluginInstall.deleteMany({ where: { slug } });
      const namespace = await db.pluginNamespace.findUnique({ where: { slug } });
      if (namespace) {
        if (!namespace.schemaName.startsWith('plugin_')) throw new Error('Upload fixture cleanup requires a plugin schema.');
        await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${namespace.schemaName.replaceAll('"', '""')}" CASCADE`);
        await db.pluginMigrationAttempt.deleteMany({ where: { namespaceId: namespace.id } });
        await db.pluginMigrationSuccess.deleteMany({ where: { namespaceId: namespace.id } });
        await db.pluginNamespace.delete({ where: { id: namespace.id } });
      }
      await db.pluginMigrationOperation.deleteMany({ where: { slug } });
    }
  } finally { await packages?.cleanup(); await db.$disconnect(); }
});
const labels = {
  en: { file: 'Plugin ZIP', preview: 'Preview package', continue: 'Continue', dialog: 'Confirm unsigned plugin installation', slug: 'Plugin slug confirmation', confirm: 'Confirm installation', cancel: 'Cancel', install: 'Install package', downgrade: 'Downgrade is not supported. Upload a higher version.' },
  'zh-Hans': { file: '插件 ZIP', preview: '预览插件包', continue: '继续', dialog: '确认安装未签名插件', slug: '确认插件标识', confirm: '确认安装', cancel: '取消', install: '安装插件包', downgrade: '不支持降级，请上传更高版本。' },
};
async function preview(page: Page, locale: keyof typeof labels, file: string) {
  await page.goto(`/${locale}/plugins`); await page.getByLabel(labels[locale].file, { exact: true }).setInputFiles(file);
  await page.getByRole('button', { name: labels[locale].preview, exact: true }).click();
}
async function capture(page: Page, name: string) { await captureReview(page, 'plugin-upload-review', name, { width: 1440, height: 900 }); }
async function successfulOperation(page: Page, slug: string, version: string) {
  return page.waitForResponse(async response => {
    if (!response.url().includes('/extensions/plugin/operations/') || response.status() !== 200) return false;
    const body = await response.json();
    return body.data.slug === slug && body.data.version === version && body.data.phase === 'SUCCESS';
  });
}

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
  const completed = successfulOperation(page, 'e2e-upload-unsigned', '1.0.0');
  await dialog.getByRole('button', { name: 'Confirm installation', exact: true }).click(); expect((await response).status()).toBe(202);
  expect((await (await completed).json()).data.result).toMatchObject({ slug: 'e2e-upload-unsigned', version: '1.0.0', warnings: [] });
  const installed = page.getByRole('article', { name: 'E2E Upload Unsigned', exact: true });
  await expect(installed.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
  await expect(installed.getByRole('button', { name: 'Disable', exact: true })).toHaveCount(0);
  await page.goto('/en/audit-events');
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('PLUGIN_UNSIGNED_INSTALL_CONFIRMED');
  await expect(page.getByRole('row', { name: /e2e-upload-unsigned/ })).toBeVisible();
});

test('K migration preview confirms the plan, shows real in-flight progress and publishes the complete success result', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  for (const [locale, dictionary] of [['en', english], ['zh-Hans', simplified], ['zh-Hant', traditional]] as const) {
    const text = dictionary.plugins.upload;
    await page.goto(`/${locale}/plugins`);
    await page.getByLabel(text.file, { exact: true }).setInputFiles(packages.migrationSuccess);
    await page.getByRole('button', { name: text.preview, exact: true }).click();
    await expect(page.getByRole('heading', { name: text.migrationPlan, exact: true })).toBeVisible();
    await expect(page.getByText('1. migrations/001.sql', { exact: true })).toBeVisible();
    await expect(page.getByText('2. migrations/002.sql', { exact: true })).toBeVisible();
    await expect(page.getByText(text.backupRecommended, { exact: true })).toBeVisible();
    await expect(page.getByText(text.migrationConfirmation, { exact: true })).toBeVisible();
    await capture(page, `migration-plan-${locale}`);
  }
  await preview(page, 'en', packages.migrationSuccess);
  let release!: () => void, acquired!: () => void;
  const locked = new Promise<void>(resolve => { acquired = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const blocker = db.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(985306::bigint)`; acquired(); await gate; }, { timeout: 20_000 });
  await locked;
  const completed = successfulOperation(page, 'e2e-upload-migration', '1.0.0');
  void completed.catch(() => undefined);
  try {
    const accepted = page.waitForResponse(response => response.url().endsWith('/extensions/plugin/install'));
    await page.getByRole('button', { name: 'Install package', exact: true }).click();
    const response = await accepted; expect(response.status()).toBe(202);
    const operationId = (await response.json()).data.operationId;
    expect((await db.pluginMigrationOperation.findUniqueOrThrow({ where: { id: operationId } })).confirmed).toBe(true);
    expect(await db.adminAuditEvent.count({ where: { targetId: 'e2e-upload-migration', action: 'PLUGIN_MIGRATIONS_CONFIRMED', summary: { path: ['operationId'], equals: operationId } } })).toBe(1);
    await expect(page.getByText(`${english.plugins.upload.migrationProgress}: 1`, { exact: true })).toBeVisible();
    await capture(page, 'migration-progress-en');
    release(); await blocker;
    const state = (await (await completed).json()).data;
    expect(state.committedPrefix).toBe(2); expect(state.result).toMatchObject({ kind: 'plugin', slug: 'e2e-upload-migration', version: '1.0.0', warnings: [] });
    await expect(page.getByRole('article', { name: 'E2E Migration Success', exact: true }).getByText('Version: 1.0.0', { exact: true })).toBeVisible();
    await capture(page, 'migration-success-en');
  } finally { release(); await blocker; await completed; }
});

test('K partial SQL failure shows needs-recovery and UI retry skips the committed file', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!'); await preview(page, 'en', packages.migrationRetry);
  const accepted = page.waitForResponse(response => response.url().endsWith('/extensions/plugin/install'));
  await page.getByRole('button', { name: 'Install package', exact: true }).click(); expect((await accepted).status()).toBe(202);
  await expect(page.getByText(english.plugins.upload.needsRecovery, { exact: true })).toBeVisible();
  await expect(page.getByText(`${english.plugins.upload.migrationApplied}: 1`, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: english.plugins.upload.migrationPlan, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: english.plugins.upload.migrationRetry, exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'E2E Migration Retry', exact: true })).toHaveCount(0);
  await capture(page, 'migration-needs-recovery-en');
  const namespace = await db.pluginNamespace.findUniqueOrThrow({ where: { slug: 'e2e-upload-migration-retry' } });
  expect(namespace.schemaName).toBe('plugin_e2e_upload_migration_retry');
  const prefix = await db.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id } }); expect(prefix).toHaveLength(1);
  await db.$executeRawUnsafe(`UPDATE "${namespace.schemaName}".gate SET value = 'ready'`);
  const retried = page.waitForResponse(response => response.url().endsWith('/retry'));
  const completed = successfulOperation(page, 'e2e-upload-migration-retry', '1.0.0');
  await page.getByRole('button', { name: english.plugins.upload.migrationRetry, exact: true }).click(); expect((await retried).status()).toBe(202);
  expect((await (await completed).json()).data.committedPrefix).toBe(2);
  expect(await db.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id, order: 1 } })).toEqual(prefix);
  expect(await db.$queryRawUnsafe(`SELECT id, value FROM "${namespace.schemaName}".records ORDER BY id`)).toEqual([{ id: 1, value: 'first' }, { id: 2, value: 'ready' }]);
  await expect(page.getByRole('article', { name: 'E2E Migration Retry', exact: true }).getByText('Version: 1.0.0', { exact: true })).toBeVisible();
  await capture(page, 'migration-retry-success-en');
});

test('N real test-signed ZIP upgrades v1 to v2 and rejects downgrade through local upload', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!'); await preview(page, 'en', packages.signedV1);
  const first = page.waitForResponse(response => response.url().endsWith('/extensions/plugin/install'));
  const firstCompleted = successfulOperation(page, 'e2e-upload-signed', '1.0.0');
  await page.getByRole('button', { name: 'Install package', exact: true }).click(); expect((await first).status()).toBe(202);
  expect((await (await firstCompleted).json()).data.result).toMatchObject({ slug: 'e2e-upload-signed', version: '1.0.0', warnings: [] });
  for (const locale of ['en', 'zh-Hans'] as const) {
    await preview(page, locale, packages.signedV2); await expect(page.getByText(/1\.0\.0 → 2\.0\.0/)).toBeVisible();
    await capture(page, `signed-upgrade-${locale}`);
  }
  await preview(page, 'en', packages.signedV2); const updated = page.waitForResponse(response => response.url().endsWith('/extensions/plugin/install'));
  const updatedCompleted = successfulOperation(page, 'e2e-upload-signed', '2.0.0');
  await page.getByRole('button', { name: 'Install package', exact: true }).click(); const result = await updated;
  expect(result.status()).toBe(202); expect((await (await updatedCompleted).json()).data.result.version).toBe('2.0.0');
  const installed = page.getByRole('article', { name: 'E2E Upload Signed', exact: true });
  await expect(installed.getByText('Version: 2.0.0', { exact: true })).toBeVisible();
  await expect(installed.getByText('Test-signed', { exact: true })).toBeVisible();
  for (const locale of ['en', 'zh-Hans'] as const) {
    await preview(page, locale, packages.signedV1); await expect(page.getByText(labels[locale].downgrade, { exact: true })).toBeVisible();
    await capture(page, `downgrade-error-${locale}`);
  }
});
