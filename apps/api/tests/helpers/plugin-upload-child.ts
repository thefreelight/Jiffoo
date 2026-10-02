import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { pluginFsInstaller } from '@/core/admin/extension-installer/plugin-fs-installer';
import { resetPluginState } from '@/core/admin/extension-installer/plugin-state';
import type { PluginInstallOptions } from '@/core/admin/extension-installer/types';
import { installMarketplacePlugin } from '@/core/admin/extension-installer/marketplace-install';

if (process.env.NODE_ENV !== 'test' || !['audit', 'published'].includes(process.env.JIFFOO_TEST_PLUGIN_LEASE_BARRIER ?? '') || !process.send) {
  throw new Error('Plugin upload child requires the explicit test IPC guard');
}
process.once('message', async (value) => {
  const message = value as { filePath: string; options: PluginInstallOptions; slug: string; marketplace?: { pluginId: string; version: string; actorId: string } };
  try {
    const result = message.marketplace
      ? await installMarketplacePlugin(message.marketplace.pluginId, message.marketplace.version, message.marketplace.actorId)
      : await pluginFsInstaller.install(Readable.from(await fs.readFile(message.filePath)), message.options);
    process.send!({ kind: 'done', statusCode: 200, result: { slug: result.slug, version: result.version, warnings: result.warnings } });
  } catch (error) {
    process.send!({ kind: 'done', statusCode: (error as { statusCode?: number }).statusCode ?? 500 });
  } finally {
    await resetPluginState(message.slug);
    await redisCache.disconnect();
    await prisma.$disconnect();
    process.disconnect?.();
  }
});
process.send({ kind: 'ready' });
