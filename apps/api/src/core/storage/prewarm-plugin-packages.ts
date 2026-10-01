import { prisma } from '@/config/database';
import { resolveCurrentPluginPackage, setPluginPackageRegistryVersion } from './current-plugin-package';

export async function prewarmPluginPackages(): Promise<void> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' }, select: { pluginRegistryVersion: true } });
  setPluginPackageRegistryVersion(settings?.pluginRegistryVersion ?? 0);
  const installs = await prisma.pluginInstall.findMany({
    where: {
      deletedAt: null,
      source: { not: 'builtin' },
      zipHash: { not: null },
      installations: { some: { enabled: true, deletedAt: null } },
    },
    select: { slug: true, zipHash: true },
  });
  await Promise.all(installs.map(async ({ slug, zipHash }) => {
    if (!zipHash) return;
    try {
      await resolveCurrentPluginPackage(slug, zipHash);
    } catch (error) {
      console.error('Plugin package startup prewarm failed', { slug, zipHash, error });
    }
  }));
  if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_PREWARM_OBSERVE === '1' && process.send) {
    process.send({ kind: 'plugin-prewarm-complete' });
  }
}
