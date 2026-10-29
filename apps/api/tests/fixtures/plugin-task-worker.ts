import { PluginTaskWorker } from '../../src/core/plugins/task-worker';
import { prisma } from '../../src/config/database';
import { startCoreProcess, finishCoreProcess } from '../../src/infra/core-process';
import { coreProcessIdentity } from '../../src/infra/core-process-identity';
import { validateDatabaseUrl } from '../../src/config/test-lane';

validateDatabaseUrl(process.env.DATABASE_URL!);
if (process.env.NODE_ENV !== 'test' || !process.env.G1_TASK_INSTALLATION_ID) throw new Error('Test task worker requires its owned installation');
let release: (() => void) | undefined;
let heartbeat: (() => Promise<void>) | undefined;
let stopping = false;
// The lease must outlive a renewal, because the renewal is a database
// transaction: under a loaded shard that transaction can take longer than a
// short lease, the lease expires while the handler still runs, the next
// renewal loses its claim and aborts the execution. A 5 second lease with a
// 250 millisecond renewal leaves the renewal room to finish, while the lease
// stays short enough for the case to observe its expiry.
const worker = new PluginTaskWorker({ installationIds: [process.env.G1_TASK_INSTALLATION_ID], leaseMs: 5_000, renewalMs: 250, retryMs: [0], execute: async (claim, input) => {
  heartbeat = () => input.heartbeat({ child: true });
  process.send?.({ kind: 'claimed', taskId: input.taskId, claimId: input.claimId, fence: input.fence, bootNonce: claim.bootNonce });
  if (!stopping) await new Promise<void>(resolve => { release = resolve; });
  return { child: true };
} });
async function main() {
await startCoreProcess('worker');
process.on('message', async (message: { kind: string }) => {
  try {
    if (message.kind === 'tick') { await worker.tick(); process.send?.({ kind: 'tick-complete' }); }
    if (message.kind === 'release') release?.();
    if (message.kind === 'heartbeat') { await heartbeat?.(); process.send?.({ kind: 'heartbeat-ok' }); }
    if (message.kind === 'stop') { stopping = true; release?.(); await worker.drain(); await finishCoreProcess(); await prisma.$disconnect(); process.exit(0); }
  } catch (error) { process.send?.({ kind: 'error', code: error && typeof error === 'object' && 'code' in error ? error.code : 'TEST_ERROR' }); }
});
process.send?.({ kind: 'ready', bootNonce: coreProcessIdentity.bootNonce });
}
void main().catch(error => { console.error(error instanceof Error ? error.name : 'UnknownError'); process.exit(1); });
