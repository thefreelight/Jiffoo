import { afterEach, describe, expect, it } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { getTestPrisma } from '../helpers/db';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { dispatchPluginRuntimeEvent } from '@/core/admin/extension-installer/plugin-runtime';
import { dispatchContractV1Event } from '@/core/admin/extension-installer/contract-v1-runtime';
import { resetPluginRegistryFreshness } from '@/core/admin/extension-installer/plugin-registry-freshness';
import { loadEnabledPluginRuntimes } from '@/core/admin/extension-installer/plugin-reconciliation';
import {
  getBreakerState,
  isRateLimitAllowed,
  recordBreakerFailure,
  resetBreaker,
  resetRateLimiter,
} from '@/core/admin/extension-installer/gateway-protection';

const prisma = getTestPrisma();

describe('Plugin lifecycle reconciliation', () => {
  const slugs: string[] = [];
  const sourceDirectories: string[] = [];
  const markerPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(slugs.splice(0).map(async (slug) => {
      resetBreaker(slug);
      resetRateLimiter(slug);
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await pluginPackageStore.delete(slug);
    }));
    await Promise.all(sourceDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
    await Promise.all(markerPaths.splice(0).map((marker) => fs.rm(marker, { force: true })));
    resetPluginRegistryFreshness();
  });

  async function createPlugin(slug: string, source: string, enabled = true): Promise<string> {
    slugs.push(slug);
    const sourceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), '.plugin-lifecycle-reconciliation-'));
    sourceDirectories.push(sourceDirectory);
    await fs.mkdir(path.join(sourceDirectory, 'server'), { recursive: true });
    const manifest = {
      schemaVersion: 1,
      slug,
      name: slug,
      version: '1.0.0',
      description: 'Plugin lifecycle reconciliation test',
      author: 'test-suite',
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js',
      permissions: [],
    };
    await fs.writeFile(path.join(sourceDirectory, 'manifest.json'), JSON.stringify(manifest), 'utf-8');
    await fs.writeFile(path.join(sourceDirectory, 'server', 'index.js'), source, 'utf-8');
    const deployment = await pluginPackageStore.put(slug, sourceDirectory);
    await deployment.commit();
    await prisma.pluginInstall.create({
      data: { slug, name: slug, version: '1.0.0', runtimeType: 'internal-fastify', source: 'local-zip', manifestJson: manifest },
    });
    const installation = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'default', enabled },
    });
    return installation.id;
  }

  it('drops runtime event handlers and protection state on disable, then loads a fresh runtime on enable', async () => {
    const slug = `reconcile-${Date.now().toString(36)}`.slice(0, 30);
    const installationId = await createPlugin(slug, `
module.exports = {
  manifest: { id: ${JSON.stringify(slug)}, version: '1.0.0', contract: 'v1' },
  register(ctx) { ctx.events.subscribe('order.created', () => undefined); },
};`);

    await dispatchPluginRuntimeEvent('order.created', {});
    expect(await dispatchContractV1Event(installationId, 'order.created', {})).toBe(1);
    for (let index = 0; index < 10; index += 1) recordBreakerFailure(slug);
    expect(getBreakerState(slug)).toBe('open');
    expect(isRateLimitAllowed(slug, 1)).toBe(true);
    expect(isRateLimitAllowed(slug, 1)).toBe(false);

    await PluginManagementService.updateInstance(installationId, { enabled: false });
    expect(await dispatchContractV1Event(installationId, 'order.created', {})).toBe(0);
    expect(getBreakerState(slug)).toBe('closed');
    expect(isRateLimitAllowed(slug, 1)).toBe(true);
    await PluginManagementService.updateInstance(installationId, { enabled: true });
    expect(await dispatchContractV1Event(installationId, 'order.created', {})).toBe(1);
  });

  it('rejects an enable when runtime loading fails without changing the database state', async () => {
    const slug = `load-fail-${Date.now().toString(36)}`.slice(0, 30);
    const installationId = await createPlugin(slug, 'module.exports = {};', false);

    await expect(PluginManagementService.updateInstance(installationId, { enabled: true })).rejects.toThrow('Plugin runtime failed to load');
    expect((await prisma.pluginInstallation.findUnique({ where: { id: installationId } }))?.enabled).toBe(false);
  });

  it('increments the registry version for restore and purge', async () => {
    const slug = `registry-${Date.now().toString(36)}`.slice(0, 30);
    await createPlugin(slug, 'module.exports = { register() {} };');
    const before = (await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.pluginRegistryVersion ?? 0;

    await PluginManagementService.uninstallPlugin(slug);
    await PluginManagementService.restorePlugin(slug);
    const afterRestore = (await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.pluginRegistryVersion ?? 0;
    expect(afterRestore).toBe(before + 2);

    await PluginManagementService.purgePlugin(slug);
    const afterPurge = (await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.pluginRegistryVersion ?? 0;
    expect(afterPurge).toBe(afterRestore + 1);
  });

  it('skips an invalid stored manifest at startup while loading healthy plugins', async () => {
    const goodSlug = `startup-good-${Date.now().toString(36)}`.slice(0, 30);
    const badSlug = `startup-bad-${Date.now().toString(36)}`.slice(0, 30);
    const goodId = await createPlugin(goodSlug, `
module.exports = {
  register(ctx) { ctx.events.subscribe('startup.event', () => undefined); },
};`);
    await createPlugin(badSlug, 'module.exports = { register() {} };');
    await prisma.pluginInstall.update({ where: { slug: badSlug }, data: { manifestJson: {} } });

    await loadEnabledPluginRuntimes();

    expect(await dispatchContractV1Event(goodId, 'startup.event', {})).toBe(1);
    const failed = await prisma.pluginInstallation.findUnique({
      where: { pluginSlug_instanceKey: { pluginSlug: badSlug, instanceKey: 'default' } },
    });
    expect(failed?.lastFailureAt).not.toBeNull();
    expect(failed?.lastFailureMessage).toContain('Stored manifest');
  });

  it('refuses a package manifest whose version differs from the installed record', async () => {
    const slug = `manifest-version-${Date.now().toString(36)}`.slice(0, 30);
    const installationId = await createPlugin(slug, 'module.exports = { register() {} };');
    const pluginPackage = await pluginPackageStore.get(slug);
    await pluginPackage!.writeText('manifest.json', JSON.stringify({
      schemaVersion: 1,
      slug,
      name: slug,
      version: '2.0.0',
      description: 'Mismatched package manifest',
      author: 'test-suite',
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js',
      permissions: [],
    }));

    await loadEnabledPluginRuntimes();

    const installation = await prisma.pluginInstallation.findUnique({ where: { id: installationId } });
    expect(installation?.lastFailureAt).not.toBeNull();
    expect(installation?.lastFailureMessage).toContain('must match the installed slug and version');
  });

  it('continues event dispatch after a handler failure and refreshes after an external registry change', async () => {
    const failingSlug = `event-fail-${Date.now().toString(36)}`.slice(0, 30);
    const healthySlug = `event-good-${Date.now().toString(36)}`.slice(0, 30);
    const marker = path.join(os.tmpdir(), `.plugin-event-${healthySlug}.txt`);
    markerPaths.push(marker);
    const failingId = await createPlugin(failingSlug, `
module.exports = {
  register(ctx) { ctx.events.subscribe('shared.event', () => { throw new Error('handler failed'); }); },
};`);
    const healthyId = await createPlugin(healthySlug, `
const fs = require('fs');
module.exports = {
  register(ctx) { ctx.events.subscribe('shared.event', () => fs.appendFileSync(${JSON.stringify(marker)}, 'handled\\n')); },
};`);

    await expect(dispatchPluginRuntimeEvent('shared.event', {})).rejects.toThrow(failingSlug);
    expect(await fs.readFile(marker, 'utf-8')).toBe('handled\n');
    expect((await prisma.pluginInstallation.findUnique({ where: { id: failingId } }))?.lastFailureMessage).toContain('handler failed');

    await prisma.pluginInstallation.update({ where: { id: healthyId }, data: { enabled: false } });
    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      create: { id: 'system', pluginRegistryVersion: 1 },
      update: { pluginRegistryVersion: { increment: 1 } },
    });
    await expect(dispatchPluginRuntimeEvent('shared.event', {})).rejects.toThrow(failingSlug);
    expect(await fs.readFile(marker, 'utf-8')).toBe('handled\n');
  });
});
