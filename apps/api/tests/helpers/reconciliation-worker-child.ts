import { startWorkerRuntime } from '../../src/worker-runtime';
import { PaymentReconciliationJob } from '../../src/jobs/payment-reconciliation';
import { sharedProtection } from '../../src/infra/shared-protection';
import { withPaymentTestClock } from '../../src/core/payment/clock';

async function main() {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/jiffoo_core_test' || new URL(process.env.REDIS_URL!).pathname !== '/15') throw new Error('Unsafe worker test environment');
  const runtime = await startWorkerRuntime({ healthPort: 0 });
  await PaymentReconciliationJob.drain();
  process.on('message', async (message: any) => {
    if (message.kind === 'stop') {
      await runtime.stop(); process.disconnect(); return;
    }
    try {
      const result = message.kind === 'warm'
        ? await sharedProtection.rate(`${message.namespace}:ready`, 60000, 1000)
        : await withPaymentTestClock(true, message.offsetMs ?? 0, () => PaymentReconciliationJob.reconcileNow());
      process.send?.({ id: message.id, result, state: runtime.state() });
    } catch (error) { process.send?.({ id: message.id, error: String(error) }); }
  });
  process.send?.({ kind: 'ready', instanceId: runtime.instanceId, heartbeatKey: runtime.heartbeatKey, healthPort: runtime.healthPort });
}
main().catch((error) => { console.error(error); process.exitCode = 1; process.disconnect?.(); });
