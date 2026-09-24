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

import 'module-alias/register';
import 'dotenv/config';
import { queueManager, workerManager, registerAllHandlers } from './infra/jobs';
import { winstonLogger } from './core/logger/unified-logger';
import { registerPluginProcessFailureHandlers } from './core/admin/extension-installer/plugin-process-failure';
import { OrderService } from './core/order/service';
import { deliverPendingNotifications } from './core/notifications/delivery';

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

  const cancelExpiredUnpaidOrders = async () => {
    try {
      await OrderService.cancelExpiredUnpaidOrders();
    } catch (error) {
      winstonLogger.error('Unpaid order timeout failed', {
        component: 'Worker',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  await cancelExpiredUnpaidOrders();
  const unpaidTimeoutTimer = setInterval(() => void cancelExpiredUnpaidOrders(), 60_000);
  const deliverNotifications = async () => {
    try {
      await deliverPendingNotifications();
    } catch (error) {
      winstonLogger.error('Notification delivery failed', {
        component: 'Worker',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  await deliverNotifications();
  const notificationTimer = setInterval(() => void deliverNotifications(), 10_000);

  winstonLogger.info('Standalone worker ready', {
    component: 'Worker',
    queues: ['webhook-delivery', 'email', 'fulfillment'],
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    winstonLogger.info(`Received ${signal}, shutting down worker...`, {
      component: 'Worker',
    });
    await workerManager.stop();
    clearInterval(unpaidTimeoutTimer);
    clearInterval(notificationTimer);
    await queueManager.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

registerPluginProcessFailureHandlers();

main().catch((error) => {
  winstonLogger.error('Worker process fatal error', {
    component: 'Worker',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
