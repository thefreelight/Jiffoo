import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { resetPluginState } from './plugin-state';
import { warmPluginInstanceRuntime } from './plugin-runtime';

export async function reconcilePluginState(slug: string): Promise<void> {
  const pluginPackage = await prisma.pluginInstall.findUnique({ where: { slug } });
  const installation = await PluginManagementService.getDefaultInstance(slug);
  await resetPluginState(slug, installation?.id);
  if (!pluginPackage || pluginPackage.deletedAt || !installation || installation.deletedAt || !installation.enabled) return;
  await warmPluginInstanceRuntime(slug, installation.id);
}

export async function reconcileAllPluginState(): Promise<void> {
  const packages = await prisma.pluginInstall.findMany({ select: { slug: true } });
  await Promise.all(packages.map((pluginPackage) => reconcilePluginState(pluginPackage.slug)));
}
