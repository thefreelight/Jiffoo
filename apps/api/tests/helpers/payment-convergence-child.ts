import { prisma } from '../../src/config/database';
import { coreProcessIdentity } from '../../src/infra/core-process-identity';
import { startCoreProcess, drainCoreProcess, finishCoreProcess } from '../../src/infra/core-process';
import { createPaymentSession } from '../../src/core/payment/session';
import { reconcilePendingPayments } from '../../src/core/payment/reconciliation';
import { withPluginDatabaseTestControl } from '../../src/core/admin/extension-installer/plugin-database-test-control';
import { withPaymentTestClock } from '../../src/core/payment/clock';
import { withPaymentSessionTestControl } from '../../src/core/payment/session-test-control';
import { drainContractInvocations } from '../../src/core/admin/extension-installer/plugin-runtime';
import { closePluginDatabase } from '../../src/core/admin/extension-installer/plugin-database';
import { sharedProtection } from '../../src/infra/shared-protection';
import { redisCache } from '../../src/core/cache/redis';

if (process.env.NODE_ENV !== 'test' || !process.send || new URL(process.env.DATABASE_URL!).pathname !== '/jiffoo_core_test') throw new Error('Payment child requires isolated test IPC');
const pending = new Set<Promise<unknown>>();
let releaseReservation: (() => void) | undefined;
process.on('message', (message: any) => {
  if (message.command === 'crash') process.exit(99);
  if (message.command === 'release') { releaseReservation?.(); return; }
  if (message.command === 'stop') {
    releaseReservation?.();
    void (async () => {
      await drainCoreProcess(); await Promise.allSettled([...pending]); await drainContractInvocations();
      await closePluginDatabase(); await finishCoreProcess(); await redisCache.disconnect(); sharedProtection.close(); await prisma.$disconnect(); process.disconnect();
    })();
    return;
  }
  const work = withPluginDatabaseTestControl({ limits: { invocationMs: message.invocationMs ?? 10_000 } }, () => withPaymentTestClock(true, message.offsetMs ?? 0, () => message.command === 'create'
    ? withPaymentSessionTestControl(true, async paymentId => {
      process.send?.({ stage: 'reserved', paymentId });
      if (message.holdReservation) await new Promise<void>(resolve => { releaseReservation = resolve; });
    }, () => createPaymentSession(message.input))
    : reconcilePendingPayments({ minAgeMinutes: 0 })));
  pending.add(work);
  void work.then(result => process.send?.({ stage: 'done', id: message.id, result }), error => process.send?.({ stage: 'failed', id: message.id, code: error.code, error: String(error) })).finally(() => pending.delete(work));
});
void startCoreProcess(process.argv[2] === 'create' ? 'api' : 'worker').then(() => process.send?.({ stage: 'ready', bootNonce: coreProcessIdentity.bootNonce })).catch(error => { console.error(error); process.exitCode = 1; process.disconnect?.(); });
