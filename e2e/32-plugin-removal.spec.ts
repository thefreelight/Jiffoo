import { captureReview, prepareReviewDialog, expect, test } from './review-capture';
import { login, ownerEmail } from './helpers';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import archiver from 'archiver';
import { PrismaClient } from '@prisma/client';
import type { Page } from '@playwright/test';

const db = new PrismaClient();
const owned = new Set<string>();
let fixtureName: string;
let directory: string;
let before: { installs: unknown[]; blobs: unknown[]; instances: unknown[] };
const labels = {
  en: { removed: 'Removed', uninstall: 'Uninstall', uninstallTitle: 'Uninstall plugin', restore: 'Restore', restoreTitle: 'Restore plugin', purge: 'Delete plugin', purgeTitle: 'Delete plugin permanently', confirm: 'Confirm', cancel: 'Cancel', slug: 'Plugin slug confirmation',
    uninstallDescription: 'New work stops. The package, configuration, credentials and plugin data are kept and can be restored.',
    purgeDescription: 'The installation record and configuration/credentials stored by Core are permanently deleted. Order history is kept. The plugin’s own data is NOT deleted.',
    unfinished: 'This plugin has unfinished payment work. Resolve it before deleting the installation.', corrupt: 'Plugin package is corrupt. Reinstall the package.' },
  'zh-Hans': { removed: '已卸载', uninstall: '卸载', uninstallTitle: '卸载插件', restore: '恢复', restoreTitle: '恢复插件', purge: '删除插件', purgeTitle: '永久删除插件', confirm: '确认', cancel: '取消', slug: '确认插件标识',
    uninstallDescription: '停止新的工作。插件包、配置、凭据和插件数据均保留，可以恢复。',
    purgeDescription: '永久删除安装记录以及 Core 存储的配置和凭据。订单历史保留。不会删除插件自身的数据。',
    unfinished: '此插件存在未完成的支付工作。请处理完成后再删除安装记录。', corrupt: '插件包已损坏。请重新安装插件包。' },
};
test.beforeAll(async () => {
  expect(new URL(process.env.DATABASE_URL_TEST!).pathname).toBe('/jiffoo_core_test');
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-removal-e2e-'));
});
test.beforeEach(async () => {
  before = {
    installs: await db.pluginInstall.findMany({ orderBy: { id: 'asc' } }),
    blobs: await db.pluginPackageBlob.findMany({ orderBy: { id: 'asc' } }),
    instances: await db.pluginInstallation.findMany({ orderBy: { id: 'asc' } }),
  };
});
test.afterEach(async ({}, testInfo) => {
  for (const slug of owned) {
    try {
      if (testInfo.status === testInfo.expectedStatus) {
        expect(await db.pluginInstall.findUnique({ where: { slug } })).toBeNull();
        expect(await db.pluginInstallation.count({ where: { pluginSlug: slug } })).toBe(0);
        expect(await db.pluginPackageBlob.count({ where: { pluginSlug: slug } })).toBe(0);
        expect(await db.pluginOperationLease.findUnique({ where: { slug } })).toBeNull();
      }
    } finally {
      await db.pluginInstall.deleteMany({ where: { slug } });
      await db.pluginOperationLease.deleteMany({ where: { slug } });
      await db.adminAuditEvent.deleteMany({ where: { targetType: 'plugin', targetId: slug } });
    }
  }
  owned.clear();
  expect({
    installs: await db.pluginInstall.findMany({ orderBy: { id: 'asc' } }),
    blobs: await db.pluginPackageBlob.findMany({ orderBy: { id: 'asc' } }),
    instances: await db.pluginInstallation.findMany({ orderBy: { id: 'asc' } }),
  }).toEqual(before);
});
test.afterAll(async () => { await db.$disconnect(); await fs.rm(directory, { recursive: true, force: true }); });

async function archive(slug: string) {
  const zip = archiver('zip'), chunks: Buffer[] = [];
  const done = new Promise<void>((resolve, reject) => { zip.on('data', chunk => chunks.push(chunk)); zip.on('end', resolve); zip.on('error', reject); });
  zip.append(JSON.stringify({ schemaVersion: 1, slug, name: fixtureName, version: '1.0.0', description: 'Lifecycle fixture', category: 'payment',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [], contracts: [{ name: 'payment', version: 2 }],
    configSchema: { type: 'object', properties: { note: { type: 'string', title: 'Payment note' }, credential: { type: 'string', title: 'Payment credential', sensitive: true } }, required: ['note', 'credential'] } }), { name: 'manifest.json' });
  zip.append(`module.exports={register(ctx){const requests=new Map(),account={namespace:'fixture',merchantAccount:ctx.plugin.slug,environment:'test'};ctx.contracts.implement('payment',2,{
    describe:input=>({displayName:'Removal payment',requiresManualConfirmation:true,unpaidTimeoutMinutes:30,supportedCurrencies:[input.storeCurrency],account}),
    createSession:input=>{const value={account,requestKey:input.idempotencyKey,sessionId:'removal_'+input.orderId,amountMinor:input.amountMinor,currency:input.currency,
      observedAt:new Date().toISOString(),status:'pending',captures:[],canStillBeCharged:true,requestClosed:false,action:{type:'instructions',text:ctx.config.note}};requests.set(input.idempotencyKey,value);return value;},
    queryByRequestKey:input=>requests.get(input.requestKey),handleWebhook:()=>({verification:'verified',events:[]})
  });}};`, { name: 'index.js' });
  await zip.finalize(); await done; const file = path.join(directory, `${slug}.zip`); await fs.writeFile(file, Buffer.concat(chunks)); return file;
}
async function install(page: Page) {
  const slug = `e2e-removal-${randomUUID().slice(0, 10)}`; owned.add(slug);
  fixtureName = `Removal payment ${slug}`;
  await page.goto('/en/plugins'); await page.getByLabel('Plugin ZIP', { exact: true }).setInputFiles(await archive(slug));
  await page.getByRole('button', { name: 'Preview package', exact: true }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm unsigned plugin installation', exact: true });
  await dialog.getByLabel('Plugin slug confirmation', { exact: true }).fill(slug); await dialog.getByRole('button', { name: 'Confirm installation', exact: true }).click();
  const article = page.getByRole('article', { name: fixtureName, exact: true }); await expect(article.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
  await article.getByRole('link', { name: 'Manage', exact: true }).click();
  await page.getByLabel('Payment note *', { exact: true }).fill('Kept payment instructions'); await page.getByLabel('Payment credential *', { exact: true }).fill('removal-fixture-secret');
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click(); await expect(page.getByLabel('Payment credential *', { exact: true })).toHaveValue('');
  return slug;
}
async function uninstall(page: Page, locale: keyof typeof labels = 'en', capture = false) {
  const text = labels[locale]; await page.goto(`/${locale}/plugins`);
  const trigger = page.getByRole('article', { name: fixtureName, exact: true }).getByRole('button', { name: text.uninstall, exact: true });
  if (capture) await prepareReviewDialog(page, trigger, { width: 1440, height: 900 });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: text.uninstallTitle, exact: true }); await expect(dialog).toContainText(text.uninstallDescription);
  if (capture) await captureReview(page, 'plugin-removal-review', `uninstall-dialog-${locale}`, { width: 1440, height: 900 });
  await dialog.getByRole('button', { name: text.confirm, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('article', { name: fixtureName, exact: true })).toHaveCount(0); await page.getByRole('button', { name: text.removed, exact: true }).click();
  await expect(page.getByRole('article', { name: fixtureName, exact: true })).toBeVisible();
  if (capture) await captureReview(page, 'plugin-removal-review', `removed-view-${locale}`, { width: 1440, height: 900 });
}
async function restore(page: Page, locale: keyof typeof labels = 'en') {
  const text = labels[locale]; await page.getByRole('article', { name: fixtureName, exact: true }).getByRole('button', { name: text.restore, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: text.restoreTitle, exact: true }); await dialog.getByRole('button', { name: text.confirm, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('article', { name: fixtureName, exact: true })).toHaveCount(0);
  await page.goto('/en/plugins'); const article = page.getByRole('article', { name: fixtureName, exact: true });
  await expect(article.getByRole('button', { name: 'Enable', exact: true })).toBeVisible(); await expect(article.getByRole('button', { name: 'Disable', exact: true })).toHaveCount(0);
}
async function purge(page: Page, slug: string, locale: keyof typeof labels = 'en', capture = false, blocked = false) {
  const text = labels[locale], trigger = page.getByRole('article', { name: fixtureName, exact: true }).getByRole('button', { name: text.purge, exact: true });
  if (capture) await prepareReviewDialog(page, trigger, { width: 1440, height: 900 });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: text.purgeTitle, exact: true }); await expect(dialog).toContainText(text.purgeDescription);
  await expect(dialog.getByRole('button', { name: text.confirm, exact: true })).toBeDisabled(); await dialog.getByLabel(text.slug, { exact: true }).fill(slug);
  if (capture) await captureReview(page, 'plugin-removal-review', `purge-dialog-${locale}`, { width: 1440, height: 900 });
  await dialog.getByRole('button', { name: text.confirm, exact: true }).click();
  if (blocked) {
    await expect(dialog.getByRole('alert')).toHaveText(text.unfinished);
    if (capture) await captureReview(page, 'plugin-removal-review', `unfinished-payment-${locale}`, { width: 1440, height: 900 });
    await dialog.getByRole('button', { name: text.cancel, exact: true }).click();
  } else { await expect(dialog).toBeHidden(); await expect(page.getByRole('article', { name: fixtureName, exact: true })).toHaveCount(0); }
}

test('L real upload, configuration, uninstall and disabled restore retain credentials and enabling restores payment availability', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!'); const slug = await install(page);
  const before = await db.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
  await uninstall(page, 'en', true); expect((await db.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } })).configJson).toEqual(before.configJson);
  await restore(page); await page.getByRole('article', { name: fixtureName, exact: true }).getByRole('button', { name: 'Enable', exact: true }).click();
  await expect(page.getByRole('article', { name: fixtureName, exact: true }).getByRole('button', { name: 'Disable', exact: true })).toBeVisible();
  const methods = await page.request.get('http://127.0.0.1:3001/api/v1/payments/available-methods');
  expect(methods.ok()).toBe(true); expect((await methods.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ name: slug })]));
  await page.getByRole('article', { name: fixtureName, exact: true }).getByRole('link', { name: 'Manage', exact: true }).click();
  await expect(page.getByLabel('Payment note *', { exact: true })).toHaveValue('Kept payment instructions');
  await expect(page.getByLabel('Payment credential *', { exact: true })).toHaveAttribute('placeholder', 'Configured. Enter a new value to replace it.');
  await uninstall(page, 'zh-Hans', true); await restore(page, 'zh-Hans'); await uninstall(page); await purge(page, slug);
});

test('M typed purge blocks unfinished payments and keeps payment order history readable in Admin and Shop', async ({ page, newObservedContext }) => {
  test.setTimeout(120_000); await login(page, ownerEmail, 'FinalOwnerPassword123!'); const slug = await install(page);
  await page.goto('/en/plugins'); await page.getByRole('article', { name: fixtureName, exact: true }).getByRole('button', { name: 'Enable', exact: true }).click();
  await expect(page.getByRole('article', { name: fixtureName, exact: true }).getByRole('button', { name: 'Disable', exact: true })).toBeVisible();
  const context = await newObservedContext({ baseURL: 'http://127.0.0.1:3003', viewport: { width: 1440, height: 900 } }), shop = await context.newPage();
  try {
    await shop.goto('/en/register'); await shop.getByLabel('Name').fill('Removal Buyer'); await shop.getByLabel('Email').fill(`${slug}@e2e.example`);
    await shop.getByLabel('Password', { exact: true }).fill('RemovalBuyerPassword123!'); await shop.getByRole('button', { name: 'Create account' }).click(); await expect(shop).toHaveURL(/\/en\/account$/);
    await shop.goto('/en/products'); await shop.getByRole('searchbox', { name: 'Search products' }).fill('E2E Product'); await shop.getByRole('button', { name: 'Search', exact: true }).click();
    await shop.getByRole('link', { name: /E2E Product/ }).click(); await shop.getByRole('button', { name: 'Add to cart' }).click(); await shop.getByRole('link', { name: 'Checkout', exact: true }).click();
    await shop.getByLabel('First name').fill('Removal'); await shop.getByLabel('Last name').fill('Buyer'); await shop.getByLabel('Phone').fill('+1-555-0132'); await shop.getByLabel('Address line 1').fill('32 Test Street');
    await shop.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco'); await shop.getByLabel('State / province').fill('CA'); await shop.getByLabel('Postal code').fill('94105');
    await shop.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' }); await shop.getByRole('button', { name: 'Get shipping options' }).click();
    await shop.getByRole('radio', { name: /Free shipping/i }).check(); await shop.getByRole('radio', { name: 'Removal payment', exact: true }).check(); await shop.getByRole('button', { name: 'Place order' }).click();
    await expect(shop).toHaveURL(/\/en\/checkout\/complete\?order=/); const orderId = new URL(shop.url()).searchParams.get('order')!;
    for (const locale of ['en', 'zh-Hans'] as const) {
      if (locale === 'en') await uninstall(page); else { await page.goto(`/${locale}/plugins`); await page.getByRole('button', { name: labels[locale].removed, exact: true }).click(); }
      await purge(page, slug, locale, true, true);
    }
    await restore(page, 'zh-Hans'); await page.getByRole('article', { name: fixtureName, exact: true }).getByRole('button', { name: 'Enable', exact: true }).click();
    await expect(page.getByRole('article', { name: fixtureName, exact: true }).getByRole('button', { name: 'Disable', exact: true })).toBeVisible();
    await page.goto(`/en/orders/${orderId}`); await page.getByLabel('Payment reference').fill(`e2e-payment-${orderId}`); await page.getByRole('button', { name: 'Record payment', exact: true }).click(); await expect(page.getByText('PAID', { exact: true })).toBeVisible();
    await uninstall(page); await purge(page, slug);
    await page.goto(`/en/orders/${orderId}`); await expect(page.getByText('PAID', { exact: true })).toBeVisible(); await expect(page.getByText(slug, { exact: true }).first()).toBeVisible();
    await shop.goto(`/en/account/orders/${orderId}`); await expect(shop.getByText('Paid', { exact: true }).first()).toBeVisible();
  } finally { await context.close(); }
});

test('H a real corrupt stored package renders its error independently in both review locales', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!'); const slug = await install(page);
  await db.pluginPackageBlob.updateMany({ where: { pluginSlug: slug }, data: { bytes: Buffer.from('corrupt package evidence') } });
  for (const locale of ['en', 'zh-Hans'] as const) {
    await page.goto(`/${locale}/plugins`); const article = page.getByRole('article', { name: fixtureName, exact: true }); await expect(article.getByRole('alert')).toHaveText(labels[locale].corrupt);
    await expect(page.getByRole('article', { name: 'Manual payment', exact: true })).toBeVisible();
    await captureReview(page, 'plugin-removal-review', `package-error-${locale}`, { width: 1440, height: 900 });
  }
  await uninstall(page); await purge(page, slug);
});
