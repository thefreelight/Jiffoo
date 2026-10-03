import { captureReview, expect, test } from './review-capture';
import { login, ownerEmail } from './helpers';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import archiver from 'archiver';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const secret = 'e2e-recorded-error-sensitive-value';
test('H real uploaded candidate failure is safely recorded and displayed as historical information in list and detail', async ({ page }) => {
  expect(new URL(process.env.DATABASE_URL_TEST!).pathname).toBe('/jiffoo_core_test');
  const before = { installs: await db.pluginInstall.findMany({ orderBy: { id: 'asc' } }), blobs: await db.pluginPackageBlob.findMany({ orderBy: { id: 'asc' } }), instances: await db.pluginInstallation.findMany({ orderBy: { id: 'asc' } }) };
  const slug = `e2e-error-${randomUUID().slice(0, 12)}`, name = `Recorded error ${slug}`, directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-error-e2e-')), file = path.join(directory, 'plugin.zip');
  try {
    const zip = archiver('zip'), chunks: Buffer[] = [];
    const done = new Promise<void>((resolve, reject) => { zip.on('data', chunk => chunks.push(chunk)); zip.on('end', resolve); zip.on('error', reject); });
    zip.append(JSON.stringify({ schemaVersion: 1, slug, name, version: '1.0.0', description: 'Recorded error fixture', category: 'integration', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [], contracts: [], configSchema: { type: 'object', properties: { credential: { type: 'string', title: 'Failure credential', sensitive: true } }, required: ['credential'] } }), { name: 'manifest.json' });
    zip.append("module.exports={register(ctx){throw new Error('Candidate rejected '+ctx.config.credential);}};", { name: 'index.js' }); await zip.finalize(); await done; await fs.writeFile(file, Buffer.concat(chunks));
    await login(page, ownerEmail, 'FinalOwnerPassword123!'); await page.goto('/en/plugins'); await page.getByLabel('Plugin ZIP', { exact: true }).setInputFiles(file); await page.getByRole('button', { name: 'Preview package', exact: true }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
    const install = page.getByRole('dialog', { name: 'Confirm unsigned plugin installation', exact: true }); await install.getByLabel('Plugin slug confirmation', { exact: true }).fill(slug); await install.getByRole('button', { name: 'Confirm installation', exact: true }).click(); await expect(install).toBeHidden();
    await page.getByRole('article', { name, exact: true }).getByRole('link', { name: 'Manage', exact: true }).click(); await page.getByLabel('Failure credential *', { exact: true }).fill(secret); await page.getByRole('button', { name: 'Save configuration', exact: true }).click(); await expect(page.getByLabel('Failure credential *', { exact: true })).toHaveValue('');
    const failure = page.waitForResponse(response => response.url().includes(`/extensions/plugin/${slug}/instances/`) && response.request().method() === 'PATCH'); await page.getByRole('button', { name: 'Enable plugin', exact: true }).click(); expect((await failure).status()).toBe(500);
    const labels = { en: { label: 'Last recorded error', historical: 'Historical information. This is not current health and does not mean the plugin is unhealthy or disabled.' }, 'zh-Hans': { label: '最近记录的错误', historical: '历史记录，不代表当前健康状态，也不表示插件不健康或已禁用。' } };
    for (const locale of ['en', 'zh-Hans'] as const) {
      await page.goto(`/${locale}/plugins`); const row = page.getByRole('article', { name, exact: true }), group = row.getByRole('group', { name: labels[locale].label, exact: true });
      await expect(group).toContainText('Candidate rejected ***'); await expect(group).toContainText(labels[locale].historical); await expect(page.getByRole('main')).not.toContainText(secret);
      await captureReview(page, 'plugin-recorded-error-review', `list-error-${locale}`, { width: 1440, height: 900 });
      await page.goto(`/${locale}/plugins/${slug}`); const detail = page.getByRole('group', { name: labels[locale].label, exact: true }); await expect(detail).toContainText('Candidate rejected ***'); await expect(detail).toContainText(labels[locale].historical); await expect(page.getByRole('main')).not.toContainText(secret);
      await captureReview(page, 'plugin-recorded-error-review', `detail-error-${locale}`, { width: 1440, height: 900 });
    }
    await page.goto('/en/plugins'); await page.getByRole('article', { name, exact: true }).getByRole('button', { name: 'Uninstall', exact: true }).click(); const uninstall = page.getByRole('dialog', { name: 'Uninstall plugin', exact: true }); await uninstall.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(uninstall).toBeHidden();
    await page.getByRole('button', { name: 'Removed', exact: true }).click(); await page.getByRole('article', { name, exact: true }).getByRole('button', { name: 'Delete plugin', exact: true }).click(); const purge = page.getByRole('dialog', { name: 'Delete plugin permanently', exact: true }); await purge.getByLabel('Plugin slug confirmation', { exact: true }).fill(slug); await purge.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(purge).toBeHidden();
    expect(await db.pluginInstall.findUnique({ where: { slug } })).toBeNull();
  } finally {
    await db.pluginInstall.deleteMany({ where: { slug } }); await db.adminAuditEvent.deleteMany({ where: { targetId: slug } }); await db.pluginOperationLease.deleteMany({ where: { slug } });
    expect({ installs: await db.pluginInstall.findMany({ orderBy: { id: 'asc' } }), blobs: await db.pluginPackageBlob.findMany({ orderBy: { id: 'asc' } }), instances: await db.pluginInstallation.findMany({ orderBy: { id: 'asc' } }) }).toEqual(before);
    await db.$disconnect(); await fs.rm(directory, { recursive: true, force: true });
  }
});
