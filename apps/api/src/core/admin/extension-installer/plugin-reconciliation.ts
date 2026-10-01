import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { resetPluginState } from './plugin-state';
import { warmPluginInstanceRuntime } from './plugin-runtime';
import { recordPluginFailure } from './plugin-failure';
import { PluginConfigDecryptionError } from '@/core/admin/plugin-management/config-crypto';
import { PluginPackageResolutionError } from '@/core/storage/current-plugin-package';

export async function reconcilePluginState(slug: string): Promise<void> {
  const pluginPackage = await prisma.pluginInstall.findUnique({ where: { slug } });
  const installation = await PluginManagementService.getDefaultInstance(slug);
  await resetPluginState(slug);
  if (!pluginPackage || pluginPackage.deletedAt || !installation || installation.deletedAt || !installation.enabled) return;
  try {
    await warmPluginInstanceRuntime(slug, installation.id);
  } catch (error) {
    if (!(error instanceof PluginConfigDecryptionError)) throw error;
    await recordPluginFailure(slug, error, 'config', installation.id);
  }
}

export async function reconcileAllPluginState(): Promise<Map<string, unknown>> {
  const packages = await prisma.pluginInstall.findMany({ select: { slug: true, zipHash: true } });
  const failures = new Map<string, unknown>();
  await Promise.all(packages.map(async ({ slug, zipHash }) => {
    try {
      await reconcilePluginState(slug);
    } catch (error) {
      const current = await prisma.pluginInstall.findUnique({ where: { slug }, select: { zipHash: true } });
      failures.set(slug, current?.zipHash !== zipHash
        ? new PluginPackageResolutionError('PLUGIN_PACKAGE_UNAVAILABLE', 503, slug)
        : error);
      console.error('Plugin reconciliation failed', { slug, error });
      try {
        await recordPluginFailure(slug, error, 'reconcile');
      } catch (recordError) {
        console.error('Plugin reconciliation failure recording failed', { slug, error: recordError });
      }
    }
  }));
  return failures;
}

export async function loadEnabledPluginRuntimes(): Promise<void> {
  const packages = await prisma.pluginInstall.findMany({ where: { deletedAt: null }, select: { slug: true } });
  for (const pluginPackage of packages) {
    const installation = await PluginManagementService.getDefaultInstance(pluginPackage.slug);
    if (!installation?.enabled || installation.deletedAt) continue;
    try {
      await warmPluginInstanceRuntime(pluginPackage.slug, installation.id);
    } catch (error) {
      await recordPluginFailure(pluginPackage.slug, error, 'startup');
    }
  }
}
