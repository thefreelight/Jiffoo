import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { resetPluginState } from './plugin-state';
import { warmPluginInstanceRuntime } from './plugin-runtime';
import { recordPluginFailure } from './plugin-failure';

export async function reconcilePluginState(slug: string): Promise<void> {
  const pluginPackage = await prisma.pluginInstall.findUnique({ where: { slug } });
  const installation = await PluginManagementService.getDefaultInstance(slug);
  await resetPluginState(slug);
  if (!pluginPackage || pluginPackage.deletedAt || !installation || installation.deletedAt || !installation.enabled) return;
  await warmPluginInstanceRuntime(slug, installation.id);
}

export async function reconcileAllPluginState(): Promise<void> {
  const packages = await prisma.pluginInstall.findMany({ select: { slug: true } });
  await Promise.all(packages.map((pluginPackage) => reconcilePluginState(pluginPackage.slug)));
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
