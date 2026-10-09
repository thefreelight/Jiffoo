import { createTestApp } from './create-test-app';
import { startWorkerRuntime } from '@/worker-runtime';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { sharedProtection } from '@/infra/shared-protection';
import { closePluginDatabase } from '@/core/admin/extension-installer/plugin-database';
import { deliverInstallationEvent } from '@/core/admin/extension-installer/plugin-runtime';
import { drainPluginInstallOperations } from '@/core/admin/extension-installer/plugin-migration-operation';
import { assertPluginDatabaseTestControl, withPluginDatabaseTestControl } from '@/core/admin/extension-installer/plugin-database-test-control';
import type { PluginEvent } from '@jiffoo/shared';

async function main() {
  assertPluginDatabaseTestControl();
  if (!process.send || new URL(process.env.DATABASE_URL!).pathname !== '/jiffoo_core_test' || new URL(process.env.REDIS_URL!).pathname !== '/15') throw new Error('Unsafe plugin database process fixture');
  const role = process.argv[2];
  const worker = role === 'worker' ? await startWorkerRuntime({ healthPort: 0 }) : undefined;
  const app = role === 'api' ? await createTestApp({ disableFileSystem: false, disableRedis: false, disableDynamicPlugins: false }) : undefined;
  const base = await app?.listen({ host: '127.0.0.1', port: 0 });
  const pending = new Set<Promise<unknown>>();
  process.on('message', (message: { kind: string; id: string; installationId: string; event: PluginEvent }) => {
    if (message.kind === 'shutdown') {
      void (async () => {
        await drainPluginInstallOperations();
        await worker?.stop(); await closePluginDatabase(); await Promise.allSettled([...pending]);
        await app?.close(); sharedProtection.close(); await redisCache.disconnect(); await prisma.$disconnect();
        process.disconnect();
      })().catch(error => { console.error(error); process.exitCode = 1; process.disconnect?.(); });
      return;
    }
    if (message.kind !== 'event' || role !== 'worker') return;
    const work = withPluginDatabaseTestControl({}, () => deliverInstallationEvent(message.installationId, message.event));
    pending.add(work);
    void work.then(result => process.send?.({ kind: 'result', id: message.id, result }), error => process.send?.({ kind: 'result', id: message.id, code: error.code })).finally(() => pending.delete(work));
  });
  process.send({ kind: 'ready', role, base, pid: process.pid });
}
void main().catch(error => { console.error(error); process.exitCode = 1; process.disconnect?.(); });
