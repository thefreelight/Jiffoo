import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { getTestPrisma } from '../helpers/db';

const prisma = getTestPrisma();
const builtinRoot = path.resolve(process.cwd(), 'builtin-plugins');
const slugs = ['manual-payment', 'free-shipping', 'zero-tax', 'manual-fulfillment', 'console-email'];

async function removeBuiltins(): Promise<void> {
  await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: { in: slugs } } });
  await prisma.pluginInstall.deleteMany({ where: { slug: { in: slugs } } });
  await prisma.adminStaffAuditLog.deleteMany({ where: { action: 'BUILTIN_PLUGIN_INSTALLED' } });
  await Promise.all(slugs.map((slug) => pluginPackageStore.delete(slug)));
}

describe('Builtin plugins', () => {
  beforeAll(async () => {
    await removeBuiltins();
  });

  afterAll(async () => {
    await removeBuiltins();
  });

  it('installs all five builtins through startup sync with builtin trust and a system audit entry', async () => {
    await syncBuiltinPlugins(builtinRoot);
    const packages = await prisma.pluginInstall.findMany({ where: { slug: { in: slugs } }, include: { installations: true } });
    expect(packages).toHaveLength(5);
    for (const plugin of packages) {
      expect(plugin.source).toBe('builtin');
      expect(plugin.trustLevel).toBe('builtin');
      expect(plugin.installations).toHaveLength(1);
      expect(plugin.installations[0].enabled).toBe(true);
    }
    expect(await prisma.adminStaffAuditLog.count({ where: { action: 'BUILTIN_PLUGIN_INSTALLED', actorUserId: 'system' } })).toBe(5);
  });

  it('leaves matching builtin versions and merchant enable choices unchanged on a later sync', async () => {
    const before = (await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.pluginRegistryVersion;
    const manual = await PluginManagementService.getDefaultInstance('manual-payment');
    await prisma.pluginInstallation.update({ where: { id: manual!.id }, data: { enabled: false } });
    await syncBuiltinPlugins(builtinRoot);
    const after = (await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.pluginRegistryVersion;
    expect(after).toBe(before);
    expect((await PluginManagementService.getDefaultInstance('manual-payment'))?.enabled).toBe(false);
    await prisma.pluginInstallation.update({ where: { id: manual!.id }, data: { enabled: true } });
  });

  it('updates a changed builtin version through the install pipeline and runs onUpgrade', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'builtin-upgrade-'));
    const source = path.join(root, 'manual-payment');
    const marker = path.join(root, 'upgrade-marker');
    await fs.cp(path.join(builtinRoot, 'manual-payment'), source, { recursive: true });
    const manifestPath = path.join(source, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.version = '1.0.1';
    manifest.lifecycle = { onUpgrade: true };
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    await fs.writeFile(path.join(source, 'index.js'), `const fs = require('fs'); module.exports = { register(ctx) { ctx.contracts.implement('payment', 1, { describe: (input) => ({ displayName: 'Manual payment', requiresManualConfirmation: true, unpaidTimeoutMinutes: 4320, supportedCurrencies: [input.storeCurrency], instructions: 'Pay manually.' }), createSession: () => ({ sessionId: 'manual', action: { type: 'instructions', text: 'Pay manually.' } }), getSessionStatus: () => ({ status: 'pending' }) }); }, __lifecycle_onUpgrade() { fs.writeFileSync(${JSON.stringify(marker)}, 'upgraded'); } };`);
    try {
      await syncBuiltinPlugins(root);
      expect((await prisma.pluginInstall.findUnique({ where: { slug: 'manual-payment' } }))?.version).toBe('1.0.1');
      expect(await fs.readFile(marker, 'utf8')).toBe('upgraded');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('dispatches each builtin contract through callContract', async () => {
    const described = await callContract('manual-payment', 'payment', 1, 'describe', { storeCurrency: 'USD' });
    expect(described).toMatchObject({ unpaidTimeoutMinutes: 4320, supportedCurrencies: ['USD'] });
    expect(await callContract('manual-payment', 'payment', 1, 'createSession', { orderId: 'order-1', amountMinor: 100, currency: 'USD', customer: { id: 'customer-1', email: 'customer@example.com' }, returnUrl: 'https://example.com/return', cancelUrl: 'https://example.com/cancel', idempotencyKey: 'attempt-1' })).toMatchObject({ action: { type: 'instructions', text: 'Pay manually.' } });
    expect(await callContract('free-shipping', 'shipping', 1, 'quote', { currency: 'USD', items: [], subtotalMinor: 0, address: { country: 'US' } })).toMatchObject({ options: [{ id: 'free', amountMinor: 0 }] });
    expect(await callContract('zero-tax', 'tax', 1, 'calculate', { currency: 'USD', lines: [{ lineId: 'line-1', productId: 'product-1', variantId: 'variant-1', quantity: 1, amountMinor: 100 }], shippingAmountMinor: 0, address: { country: 'US' } })).toMatchObject({ lines: [{ lineId: 'line-1', taxMinor: 0 }], totalTaxMinor: 0 });
    expect(await callContract('manual-fulfillment', 'fulfillment', 1, 'createFulfillment', { orderId: 'order-1', items: [], address: { country: 'US' }, idempotencyKey: 'attempt-1' })).toMatchObject({ status: 'pending' });
    const logger = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    expect(await callContract('console-email', 'notification', 1, 'send', { channel: 'email', to: 'customer@example.com', subject: 'Subject', html: '<p>Text</p>', text: 'Text', locale: 'en', idempotencyKey: 'message-1' })).toMatchObject({ accepted: true });
    expect(logger).toHaveBeenCalled();
    logger.mockRestore();
  });

  it('rejects disabling the last enabled provider for every contract and allows one of two shipping providers to disable', async () => {
    const contracts = [['manual-payment', 'payment'], ['free-shipping', 'shipping'], ['zero-tax', 'tax'], ['manual-fulfillment', 'fulfillment'], ['console-email', 'notification']] as const;
    for (const [slug, contract] of contracts) {
      const instance = await PluginManagementService.getDefaultInstance(slug);
      await expect(PluginManagementService.updateInstance(instance!.id, { enabled: false })).rejects.toMatchObject({ statusCode: 409, code: 'LAST_PROVIDER_REQUIRED', contract });
    }
    const secondSlug = 'shipping-second-provider';
    const source = await fs.mkdtemp(path.join(os.tmpdir(), 'shipping-provider-'));
    try {
      await fs.writeFile(path.join(source, 'manifest.json'), JSON.stringify({ schemaVersion: 1, slug: secondSlug, name: secondSlug, version: '1.0.0', description: 'Second shipping provider', category: 'shipping', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [], contracts: [{ name: 'shipping', version: 1 }] }));
      await fs.writeFile(path.join(source, 'index.js'), "module.exports = { register(ctx) { ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [] }) }); } };");
      const deployment = await pluginPackageStore.put(secondSlug, source);
      await deployment.commit();
      const storedPackage = await pluginPackageStore.get(secondSlug);
      const storedManifest = JSON.parse(await fs.readFile(storedPackage!.getEntryPath('manifest.json'), 'utf8'));
      await prisma.pluginInstall.create({ data: { slug: secondSlug, name: secondSlug, version: '1.0.0', runtimeType: 'internal-fastify', source: 'local-zip', manifestJson: storedManifest } });
      const second = await prisma.pluginInstallation.create({ data: { pluginSlug: secondSlug, instanceKey: 'default', enabled: true } });
      const free = await PluginManagementService.getDefaultInstance('free-shipping');
      await expect(PluginManagementService.updateInstance(free!.id, { enabled: false })).resolves.toMatchObject({ enabled: false });
      await PluginManagementService.updateInstance(free!.id, { enabled: true });
      await PluginManagementService.updateInstance(second.id, { enabled: false });
    } finally {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: secondSlug } });
      await prisma.pluginInstall.deleteMany({ where: { slug: secondSlug } });
      await pluginPackageStore.delete(secondSlug);
      await fs.rm(source, { recursive: true, force: true });
      const free = await PluginManagementService.getDefaultInstance('free-shipping');
      if (free && !free.enabled) await prisma.pluginInstallation.update({ where: { id: free.id }, data: { enabled: true } });
    }
  });

  it('does not allow builtins to be uninstalled or purged', async () => {
    await expect(PluginManagementService.uninstallPlugin('manual-payment')).rejects.toThrow('Cannot uninstall built-in plugins');
    await expect(PluginManagementService.purgePlugin('manual-payment')).rejects.toThrow('Cannot purge built-in plugins');
  });
});
