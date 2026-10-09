import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/config/database';
import { pluginFsInstaller } from './plugin-fs-installer';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { packBuiltinPlugin } from './builtin-package';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';

const BUILTIN_SYNC_LOCK = 824_301_551;

export async function syncBuiltinPlugins(builtinRoot: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${BUILTIN_SYNC_LOCK})::text`;
    const entries = await fs.readdir(builtinRoot, { withFileTypes: true });
    for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
      const directory = path.join(builtinRoot, entry.name);
      const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')) as { slug: string; version: string };
      const { hash, bytes } = await packBuiltinPlugin(directory);
      const installed = await prisma.pluginInstall.findUnique({ where: { slug: manifest.slug } });
      if (installed && installed.version === manifest.version && installed.zipHash === hash) {
        await prisma.$transaction(tx => pluginPackageBlobStore.put(tx, manifest.slug, hash, bytes));
        if (!await pluginPackageStore.get(manifest.slug, hash)) {
          const deployment = await pluginPackageStore.put(manifest.slug, hash, directory);
          await deployment.commit();
        }
        continue;
      }
      const wasInstalled = Boolean(installed);
      await pluginFsInstaller.installFromDirectory(directory, { source: 'builtin' });
      if (!wasInstalled) {
        const instance = await PluginManagementService.getDefaultInstance(manifest.slug);
        if (!instance) throw new Error(`Builtin plugin "${manifest.slug}" has no default installation`);
        await PluginManagementService.updateInstance(instance.id, { enabled: true });
        await prisma.adminStaffAuditLog.create({
          data: {
            staffUserId: 'system',
            staffEmail: 'system',
            actorUserId: 'system',
            actorEmail: 'system',
            action: 'BUILTIN_PLUGIN_INSTALLED',
            metadata: { slug: manifest.slug, version: manifest.version, source: 'builtin' },
          },
        });
      }
    }
  }, { timeout: 120_000 });
}
