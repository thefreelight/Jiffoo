import { EventDeliveryEngine } from '../../src/infra/events/delivery';
import { prisma } from '../../src/config/database';
import { seedBuiltinCache } from './seed-builtin-cache';
import { setWorkerShutdownObserverForTest } from '../../src/infra/worker-shutdown';

if (new URL(process.env.DATABASE_URL!).pathname !== '/jiffoo_core_test'
  || new URL(process.env.REDIS_URL!).pathname !== '/15') throw new Error('Event child requires isolated test services');

const engine = new EventDeliveryEngine(`child-${process.pid}`, { timeoutMs: Number(process.env.EVENT_TEST_TIMEOUT_MS || 30000) });
setWorkerShutdownObserverForTest(true, (stage, details) => {
  if (stage === 'event-wrapper-settled') process.send?.({ kind: 'wrapper-settled', ...details });
});
let released = false;
const waiters = new Set<() => void>();
(globalThis as Record<string, unknown>).__eventWorkerRelease = {
  wait: () => released ? Promise.resolve() : new Promise<void>((resolve) => { waiters.add(resolve); }),
};
process.on('message', async (message: { command: string; requestId: string }) => {
  if (message.command === 'release') return;
  if (message.command === 'release-all') {
    released = true;
    for (const resolve of waiters) resolve();
    waiters.clear();
    return;
  }
  if (message.command === 'crash') process.exit(99);
  try {
    if (message.command === 'run') {
      const count = await engine.runOnce();
      process.send!({ kind: 'claimed', requestId: message.requestId, count });
      await engine.drain();
      process.send!({ kind: 'done', requestId: message.requestId, count });
    } else if (message.command === 'drain-all') {
      let total = 0;
      while (true) {
        const count = await engine.runOnce();
        process.send!({ kind: 'claimed', requestId: message.requestId, count });
        await engine.drain();
        total += count;
        if (count === 0) break;
      }
      process.send!({ kind: 'done', requestId: message.requestId, count: total });
    } else if (message.command === 'stop') {
      released = true;
      for (const resolve of waiters) resolve();
      waiters.clear();
      for (const item of engine.unsettled()) {
        if ('installationId' in item) process.emit('message', { command: 'release', installationId: item.installationId });
      }
      await engine.stop();
      await prisma.$disconnect();
      process.disconnect();
    } else throw new Error('Unexpected event worker command');
  } catch (error) {
    process.send!({ kind: 'error', requestId: message.requestId, message: error instanceof Error ? error.message : String(error) });
  }
});
if (process.env.JIFFOO_TEST_ISOLATED_PLUGIN_ROOT === '1') {
  void seedBuiltinCache().then(
    () => process.send!({ kind: 'ready', pid: process.pid }),
    (error) => { process.send!({ kind: 'error', message: String(error) }); process.exitCode = 1; },
  );
} else {
  process.send!({ kind: 'ready', pid: process.pid });
}
