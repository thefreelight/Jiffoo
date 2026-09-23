import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/config/database';
import { pluginFsInstaller } from './plugin-fs-installer';
import { PluginManagementService } from '@/core/admin/plugin-management/service';

const BUILTIN_SYNC_LOCK = 824_301_551;

export async function syncBuiltinPlugins(builtinRoot: string): Promise<void> {
  await prisma.$executeRawUnsafe(`SELECT pg_advisory_lock(${BUILTIN_SYNC_LOCK})`);
  try {
    const entries = await fs.readdir(builtinRoot, { withFileTypes: true });
    for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
      const directory = path.join(builtinRoot, entry.name);
      const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')) as { slug: string; version: string };
      const installed = await prisma.pluginInstall.findUnique({ where: { slug: manifest.slug } });
      if (installed && installed.version === manifest.version) continue;
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
  } finally {
    await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock(${BUILTIN_SYNC_LOCK})`);
  }
}
