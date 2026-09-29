import 'module-alias/register';
import 'dotenv/config';
import { startWorkerRuntime } from './worker-runtime';
import { winstonLogger } from './core/logger/unified-logger';
import { registerPluginProcessFailureHandlers } from './core/admin/extension-installer/plugin-process-failure';

registerPluginProcessFailureHandlers();

startWorkerRuntime().then((runtime) => {
  const shutdown = async () => {
    await runtime.stop();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
}).catch((error) => {
  winstonLogger.error('Worker process fatal error', {
    component: 'Worker',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
