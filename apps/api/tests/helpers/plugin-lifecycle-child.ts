import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { resetPluginState } from '@/core/admin/extension-installer/plugin-state';

if (process.env.NODE_ENV !== 'test' || !['audit', 'acquired'].includes(process.env.JIFFOO_TEST_PLUGIN_LEASE_BARRIER ?? '') || !process.send) {
  throw new Error('Plugin lifecycle child requires the explicit test IPC guard');
}
process.once('message', async (value) => {
  const message = value as { operation: 'uninstall' | 'restore' | 'purge'; slug: string; actorId: string };
  try {
    if (message.operation === 'uninstall') await PluginManagementService.uninstallPlugin(message.slug, message.actorId);
    else if (message.operation === 'restore') await PluginManagementService.restorePlugin(message.slug, message.actorId);
    else await PluginManagementService.purgePlugin(message.slug, message.slug, message.actorId);
    process.send!({ kind: 'done', statusCode: 200 });
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
