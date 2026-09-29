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
 * Called only by the worker process.
 */
export async function startJobInfrastructure(): Promise<void> {
  winstonLogger.info('Starting job infrastructure', {
    component: 'JobInfrastructure',
  });

  // Register handlers
  registerAllHandlers();

  // Connect to Redis (for queue management)
  await queueManager.connect();

  if (!queueManager.isAvailable()) {
    await queueManager.disconnect();
    throw new Error('Redis unavailable at worker startup');
  }
  await workerManager.start();

  // Poll events in the worker process.
  outboxPoller.start();

  winstonLogger.info('Job infrastructure started', {
    component: 'JobInfrastructure',
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
