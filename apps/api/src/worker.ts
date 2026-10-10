import 'module-alias/register';
import 'dotenv/config';
import { startWorkerRuntime } from './worker-runtime';
import { winstonLogger } from './core/logger/unified-logger';
import { registerPluginProcessFailureHandlers } from './core/admin/extension-installer/plugin-process-failure';
import { observeWorkerShutdownForTest } from './infra/worker-shutdown';
import { coreProcessIdentity } from './infra/core-process-identity';

registerPluginProcessFailureHandlers();

startWorkerRuntime().then((runtime) => {
  const shutdown = async () => {
    try { process.exit(await runtime.stop()); }
    catch (error) {
      winstonLogger.error('Worker shutdown failed', { error: error instanceof Error ? error.name : 'UnknownError' });
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
  observeWorkerShutdownForTest('ready', { bootNonce: coreProcessIdentity.bootNonce, healthPort: runtime.healthPort });
}).catch((error) => {
  winstonLogger.error('Worker process fatal error', {
    component: 'Worker',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
