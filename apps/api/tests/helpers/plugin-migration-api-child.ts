import { createTestApp } from './create-test-app';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { drainPluginInstallOperations } from '@/core/admin/extension-installer/plugin-migration-operation';
import { coreProcessIdentity } from '@/infra/core-process-identity';

async function main() {
  if (!process.send) throw new Error('Migration API fixture requires IPC');
  const app = await createTestApp({ disableFileSystem: false, disableRedis: false, disableDynamicPlugins: false });
  const base = await app.listen({ host: '127.0.0.1', port: 0 });
  process.send({ kind: 'ready', base, bootNonce: coreProcessIdentity.bootNonce });
  process.on('message', async message => {
    if ((message as { kind?: string })?.kind !== 'shutdown') return;
    await drainPluginInstallOperations();
    await app.close();
    await redisCache.disconnect();
    await prisma.$disconnect();
    process.disconnect();
    process.exit(0);
  });
}
void main().catch(error => { console.error(error); process.exitCode = 1; process.disconnect?.(); });
