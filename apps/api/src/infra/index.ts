/**
 * Infrastructure Services
 *
 * Contains cross-cutting infrastructure concerns that are used by business modules.
 * These services have no business logic and no routes.
 */

export * from './outbox';
export * from './queue';
export * from './backup';

// Unified job infrastructure (BullMQ + Outbox)
export {
  startJobInfrastructure,
  stopJobInfrastructure,
  queueManager,
  workerManager,
  outboxPoller,
  QUEUE_NAMES,
} from './jobs';

// Re-export forecasting worker for infrastructure layer
export { ForecastingWorker } from '@/core/inventory/forecasting/worker';
