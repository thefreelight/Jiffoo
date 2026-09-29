import { startWorkerRuntime } from '../../src/worker-runtime';

async function main() {
  if (new URL(process.env.REDIS_URL!).pathname !== '/15' ||
      new URL(process.env.DATABASE_URL!).pathname !== '/jiffoo_core_test') {
    throw new Error('Worker test child requires Redis DB 15 and jiffoo_core_test');
  }
  const runtime = await startWorkerRuntime({ healthPort: 0 });
  process.once('message', async (message) => {
    if (message !== 'stop') throw new Error('Unexpected worker test command');
    await runtime.stop();
    process.disconnect();
  });
  process.send!({ instanceId: runtime.instanceId, heartbeatKey: runtime.heartbeatKey, healthPort: runtime.healthPort });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  process.disconnect?.();
});
