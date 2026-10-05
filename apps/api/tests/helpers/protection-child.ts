import { SharedProtection, pluginProtectionScope } from '@/infra/shared-protection';
import { protectionApp } from './protection-app';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';

async function main() {
  const protection = new SharedProtection(process.argv[2]);
  const app = await protectionApp(protection, process.argv[3]);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing child listener');
  process.on('message', async (message: any) => {
    if (['breaker', 'result', 'installation-rate', 'reload'].includes(message.kind)) {
      try {
        let value: unknown;
        if (message.kind === 'breaker') value = await protection.breaker(message.scope);
        if (message.kind === 'result') value = await protection.result(message.permit, message.success);
        if (message.kind === 'installation-rate') {
          const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: message.installationId } });
          if (!installation.enabled) throw new Error('Plugin is disabled');
          value = { generation: installation.protectionGeneration.toString(), ...await protection.rate(`${pluginProtectionScope(installation.id, installation.protectionGeneration)}:http`, 60000, 1) };
        }
        if (message.kind === 'reload') {
          const { ensurePluginRegistryFresh } = await import('../../src/core/admin/extension-installer/plugin-registry-freshness');
          await ensurePluginRegistryFresh(message.slug);
        }
        process.send?.({ kind: 'result', id: message.id, value: value ?? null });
      } catch (error) { process.send?.({ kind: 'result', id: message.id, error: String(error) }); }
      return;
    }
    if (message.kind !== 'stop') return;
    await app.close(); protection.close(); await prisma.$disconnect(); await redisCache.disconnect();
    process.disconnect();
  });
  process.send?.({ kind: 'ready', port: address.port, pid: process.pid });
}
main().catch((error) => { process.send?.({ kind: 'error', message: String(error) }); process.exitCode = 1; process.disconnect(); });
