/**
 * Unified Job Infrastructure — Type Definitions
 *
 * Shared types for the BullMQ-based job system that integrates with
 * the transactional outbox pattern.
 */

/**
 * Queue names used across the system.
 * Each queue has its own concurrency and retry settings.
 */
export const QUEUE_NAMES = {
  WEBHOOK_DELIVERY: 'webhook-delivery',
  EMAIL: 'email',
  FULFILLMENT: 'fulfillment',
  STOCK_ALERT: 'stock-alert',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Worker deployment mode.
 * - embedded: Worker runs inside the API process (default)
 * - standalone: Worker runs as a separate process (node dist/worker.js)
 * - off: No worker; jobs are enqueued but not consumed (for external workers)
 */
export type WorkerMode = 'embedded' | 'standalone' | 'off';

/**
 * Base job data that all jobs must include.
 * The outboxEventId enables idempotency — the processor checks
 * whether the event has already been processed.
 */
export interface BaseJobData {
  /** OutboxEvent ID — used as the BullMQ job ID for idempotency */
  outboxEventId: string;
  /** Event type from OutboxEvent */
  eventType: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** Actor ID (user or system that triggered the event) */
  actorId?: string;
}

/**
 * Job handler interface.
 * Each queue registers a handler that processes jobs of a specific type.
 */
export interface JobHandler<TData extends BaseJobData = BaseJobData> {
  /** The event types this handler processes */
  eventTypes: string[];
  /** The queue this handler belongs to */
  queue: QueueName;
  /** Process the job */
  handle(data: TData): Promise<void>;
}

/**
 * Job result metrics for observability.
 */
export interface JobMetrics {
  queueDepth: number;
  failedTotal: number;
  completedTotal: number;
  durationSeconds: Record<string, number>;
}
