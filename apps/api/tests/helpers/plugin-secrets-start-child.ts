import { startApiRuntime } from '../../src/server';
import { startWorkerRuntime } from '../../src/worker-runtime';

const warnings: string[] = [];
const originalWarn = console.warn;
console.warn = (...args) => {
  warnings.push(args.map(String).join(' '));
  originalWarn(...args);
};

async function run() {
try {
  const api = await startApiRuntime({ port: 0, host: '127.0.0.1' });
  const apiListening = api.app.server.listening;
  await api.stop();
  const worker = await startWorkerRuntime({ healthPort: 0 });
  const workerRunning = worker.state().tasks.eventDelivery;
  await worker.stop();
  process.send?.({ apiListening, workerRunning, warnings });
  process.disconnect();
} catch (error) {
  process.send?.({ error: error instanceof Error ? error.message : String(error), warnings });
  process.disconnect();
}
}

void run();
