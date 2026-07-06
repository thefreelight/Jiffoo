/**
 * Standalone Worker Entry Point
 *
 * Run with: `node dist/worker.js`
 *
 * This process connects to Redis, registers all job handlers,
 * and starts consuming jobs from BullMQ queues. It does NOT
 * start the API server or the outbox poller.
 *
 * Environment variables:
 * - REDIS_URL: Redis connection string
 * - WORKER_MODE: Should be "standalone" when running this entry point
 */

import 'dotenv/config';
import { queueManager, workerManager, registerAllHandlers } from './infra/jobs';
import { winstonLogger } from './core/logger/unified-logger';

async function main(): Promise<void> {
  winstonLogger.info('Starting standalone worker process', {
    component: 'Worker',
    pid: process.pid,
  });

  // Register handlers
  registerAllHandlers();

  // Connect to Redis
  await queueManager.connect();

  if (!queueManager.isAvailable()) {
    winstonLogger.error('Redis unavailable — standalone worker cannot start', {
      component: 'Worker',
    });
    process.exit(1);
  }

  // Start workers
  await workerManager.start();

  winstonLogger.info('Standalone worker ready', {
    component: 'Worker',
    queues: ['webhook-delivery', 'email', 'fulfillment', 'stock-alert'],
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    winstonLogger.info(`Received ${signal}, shutting down worker...`, {
      component: 'Worker',
    });
    await workerManager.stop();
    await queueManager.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  winstonLogger.error('Worker process fatal error', {
    component: 'Worker',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
