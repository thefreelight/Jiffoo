import { validateDatabaseUrl } from '../../src/config/test-lane';
import { buildApp, startApiRuntime, registerApiShutdownHandlers } from '@/server';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import { setWorkerShutdownDeadlineForTest } from '@/infra/worker-shutdown';
import { startWorkerRuntime } from '@/worker-runtime';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { sharedProtection } from '@/infra/shared-protection';
import { installBuiltinTheme } from '@/core/admin/extension-installer/theme-service';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';

async function main() {
  if (process.env.NODE_ENV !== 'test' && process.env.JIFFOO_TEST_THEME_BARRIER === undefined) throw new Error('Theme fixture requires the test environment');
  validateDatabaseUrl(process.env.DATABASE_URL!);
  const role = process.argv[2];
  const runtime = role === 'worker' ? await startWorkerRuntime({ healthPort: 0 })
    : role === 'startup-api' || role.startsWith('shutdown-api') ? await startApiRuntime({ port: 0, host: '127.0.0.1' })
      : await (async () => {
        const app = await buildApp(); await app.listen({ port: 0, host: '127.0.0.1' });
        return { app, stop: async () => { await app.close(); sharedProtection.close(); await redisCache.disconnect(); await prisma.$disconnect(); } };
      })();
  if (role.startsWith('shutdown-api')) {
    setWorkerShutdownDeadlineForTest(true, role === 'shutdown-api-short' ? 500 : 10_000);
    registerApiShutdownHandlers(runtime);
  }
  process.send?.({ kind: 'ready', bootNonce: coreProcessIdentity.bootNonce, base: 'app' in runtime ? `http://127.0.0.1:${(runtime.app.server.address() as { port: number }).port}` : undefined });
  process.on('message', (message: { kind: string; id?: string; directory?: string; slug?: string }) => {
    if (message.kind === 'contract-call') {
      void callContract(message.slug!, 'shipping', 1, 'quote', {}).then(value => process.send?.({ kind: 'result', id: message.id, value }))
        .catch(error => process.send?.({ kind: 'result', id: message.id, error: { code: error.code, message: error.message } }));
    }
    if (message.kind === 'builtin-install') {
      void installBuiltinTheme(message.directory!).then(result => process.send?.({ kind: 'result', id: message.id, result }))
        .catch(error => process.send?.({ kind: 'result', id: message.id, error: { code: error.code, message: error.message } }));
    }
    if (message.kind === 'stop') void runtime.stop().then(() => { process.disconnect(); process.exit(0); });
    // Windows TerminateProcess bypasses Node listeners; enter the actual API SIGTERM handler through IPC.
    if (message.kind === 'api-sigterm') process.emit('SIGTERM', 'SIGTERM');
  });
}
main().catch(error => { process.send?.({ kind: 'error', message: String(error) }); process.disconnect(); process.exitCode = 1; });
