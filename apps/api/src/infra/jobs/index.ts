/**
 * Unified Job Infrastructure — Public API
 *
 * This module provides the single entry point for the BullMQ + Outbox
 * async task layer. It exposes:
 * - queueManager: enqueue jobs to BullMQ queues
 * - workerManager: register handlers and manage worker lifecycle
 * - outboxPoller: poll OutboxEvent table and dispatch to queues
 * - registerAllHandlers: register built-in job handlers
 * - start/stop: lifecycle helpers
 */

export { queueManager } from './queue-manager';
export { workerManager } from './worker-manager';
export { outboxPoller } from './outbox-poller';
export { registerAllHandlers } from './handlers';
export type {
  QueueName,
  WorkerMode,
  BaseJobData,
  JobHandler,
  JobMetrics,
} from './types';
export { QUEUE_NAMES } from './types';

import { queueManager } from './queue-manager';
import { workerManager } from './worker-manager';
import { outboxPoller } from './outbox-poller';
import { registerAllHandlers } from './handlers';
import { winstonLogger } from '@/core/logger/unified-logger';

/**
 * Start the unified job infrastructure.
 *
 * In 'embedded' mode (default): connects to Redis, registers handlers,
 * starts workers, and starts the outbox poller — all inside the API process.
 *
 * In 'standalone' mode: the API process only starts the outbox poller
 * (for enqueueing); workers are started separately via `node dist/worker.js`.
 *
 * In 'off' mode: only the outbox poller runs; jobs are enqueued but not
 * consumed (for external worker deployments).
 */
export async function startJobInfrastructure(): Promise<void> {
  const mode = (process.env.WORKER_MODE || 'embedded') as 'embedded' | 'standalone' | 'off';

  winstonLogger.info('Starting job infrastructure', {
    component: 'JobInfrastructure',
    mode,
  });

  // Register handlers
  registerAllHandlers();

  // Connect to Redis (for queue management)
  await queueManager.connect();

  if (mode === 'embedded') {
    // Start workers in the same process
    await workerManager.start();
  }

  // Start the outbox poller (always runs, even in 'off' mode for enqueueing)
  outboxPoller.start();

  winstonLogger.info('Job infrastructure started', {
    component: 'JobInfrastructure',
    mode,
    redisAvailable: queueManager.isAvailable(),
    workersRunning: workerManager.isRunning(),
  });
}

/**
 * Stop the unified job infrastructure.
 */
export async function stopJobInfrastructure(): Promise<void> {
  outboxPoller.stop();
  await workerManager.stop();
  await queueManager.disconnect();

  winstonLogger.info('Job infrastructure stopped', {
    component: 'JobInfrastructure',
  });
}
