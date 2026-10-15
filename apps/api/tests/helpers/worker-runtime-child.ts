import { validateDatabaseUrl, validateRedisUrl } from '../../src/config/test-lane';
import { startWorkerRuntime } from '../../src/worker-runtime';

async function main() {
  validateRedisUrl(process.env.REDIS_URL!);
  validateDatabaseUrl(process.env.DATABASE_URL!);
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
