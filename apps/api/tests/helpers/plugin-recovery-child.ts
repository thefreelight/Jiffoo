import { prisma } from '@/config/database';
import { startCoreProcess, drainCoreProcess, finishCoreProcess } from '@/infra/core-process';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import { withRecoveryTestControl, assertRecoveryTestControl } from '@/core/admin/extension-installer/plugin-recovery-test-control';
import { startPluginRecoverySweeper } from '@/core/admin/extension-installer/plugin-recovery';
import { withPluginMigrationGate } from '@/core/admin/extension-installer/plugin-migration-gate';
import { createPluginDatabase, withPluginDatabaseInvocation, withPluginDatabaseHandler, closePluginDatabase } from '@/core/admin/extension-installer/plugin-database';
import { withPluginDatabaseTestControl } from '@/core/admin/extension-installer/plugin-database-test-control';
import { startPluginInstallOperation, drainPluginInstallOperations } from '@/core/admin/extension-installer/plugin-migration-operation';
import { localUploadOptions } from './plugin-upload';

async function main() {
  assertRecoveryTestControl();
  if (!process.send || new URL(process.env.DATABASE_URL!).pathname !== '/jiffoo_core_test') throw new Error('Unsafe recovery fixture');
  const role = process.argv[2] === 'worker' ? 'worker' : 'api';
  await withRecoveryTestControl({ heartbeatMs: 20 }, () => startCoreProcess(role));
  const sweeper = withRecoveryTestControl({ sweepMs: 20 }, () => startPluginRecoverySweeper());
  const held = new Map<string, () => void>();
  const pending = new Set<Promise<unknown>>();
  process.on('message', (message: { kind: string; id: string; slug: string; bytes: string; actorId: string; sql?: boolean; hold?: boolean }) => {
    if (message.kind === 'release') { held.get(message.id)?.(); held.delete(message.id); return; }
    if (message.kind === 'freeze') { process.send?.({ kind: 'frozen' }); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); return; }
    if (message.kind === 'stop') {
      for (const resolve of held.values()) resolve();
      void (async () => { await sweeper.stop(); await drainCoreProcess(); await closePluginDatabase(); await Promise.allSettled([...pending]); await drainPluginInstallOperations(); await finishCoreProcess(); await prisma.$disconnect(); process.disconnect(); })();
      return;
    }
    const work = (async () => {
      if (message.kind === 'sweep') { await sweeper.run(); return; }
      if (message.kind === 'marker') {
        const db = createPluginDatabase(message.slug, message.slug);
        await withPluginMigrationGate(message.slug, () => withPluginDatabaseInvocation(message.slug, message.slug, () => withPluginDatabaseHandler(message.slug, message.slug, async () => {
          if (message.sql) await withPluginDatabaseTestControl({ limits: { statementMs: 500 }, observe: value => { if (value.stage === 'query') process.send?.({ kind: 'held', id: message.id, pid: value.pid }); } }, () => db.query('SELECT pg_sleep(60)', []));
          else { process.send?.({ kind: 'held', id: message.id }); await new Promise<void>(resolve => held.set(message.id, resolve)); }
        })));
      } else if (message.kind === 'install') {
        const bytes = Buffer.from(message.bytes, 'base64');
        const limits = { leaseMs: 200, renewalMs: 30, ipcBarriers: true };
        const result = await withRecoveryTestControl(limits, () => withPluginDatabaseTestControl({ beforeMigrationRun: message.hold ? async () => { process.send?.({ kind: 'held', id: message.id }); await new Promise<void>(resolve => held.set(message.id, resolve)); } : undefined }, async () => startPluginInstallOperation(bytes, await localUploadOptions(bytes, message.actorId))));
        process.send?.({ kind: 'accepted', id: message.id, ...result });
      }
    })();
    pending.add(work); void work.then(() => process.send?.({ kind: 'done', id: message.id }), error => process.send?.({ kind: 'failed', id: message.id, code: error.code })).finally(() => pending.delete(work));
  });
  process.send({ kind: 'ready', ...coreProcessIdentity });
}
void main().catch(error => { console.error(error); process.exitCode = 1; process.disconnect?.(); });
