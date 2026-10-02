import path from 'node:path';
import { prisma } from '@/config/database';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';

export async function seedBuiltinCache(): Promise<void> {
  const targetRoot = process.env.EXTENSIONS_PATH;
  if (!targetRoot) return;
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_ISOLATED_PLUGIN_ROOT !== '1' || !process.send) {
    throw new Error('Isolated builtin cache requires the explicit test IPC guard');
  }
  const sourceRoot = process.env.JIFFOO_TEST_BUILTIN_SOURCE_ROOT;
  if (!sourceRoot) throw new Error('Missing parent builtin cache root');
  const rows = await prisma.pluginInstall.findMany({ where: { source: 'builtin' } });
  for (const row of rows) {
    if (!row.zipHash) throw new Error(`Builtin ${row.slug} has no package hash`);
    const deployment = await pluginPackageStore.put(row.slug, row.zipHash, path.join(sourceRoot, 'plugins', row.slug, row.zipHash));
    await deployment.commit();
  }
}
