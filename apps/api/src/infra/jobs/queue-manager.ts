/**
 * Queue Manager — Centralized BullMQ queue management
 *
 * Creates and manages BullMQ Queue instances for all named queues.
 * Handles Redis connection lifecycle and provides a unified API
 * for enqueuing jobs.
 */

import { Queue, QueueEvents, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/config/env';
import { winstonLogger } from '@/core/logger/unified-logger';
import { QUEUE_NAMES, type QueueName, type BaseJobData } from './types';

/**
 * Default job options applied to all queues.
 * - 5 retry attempts with exponential backoff
 * - Jobs removed after 1000 completions or 5000 failures
 * - Job ID set to outboxEventId for idempotency
 */
const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

/**
 * Maps event type prefixes to their target queues.
 * Used by the OutboxPoller to route events to the correct queue.
 */
const EVENT_TYPE_TO_QUEUE: Record<string, QueueName> = {
  // Webhook events
  'webhook.': QUEUE_NAMES.WEBHOOK_DELIVERY,
  'order.created': QUEUE_NAMES.WEBHOOK_DELIVERY,
  'order.updated': QUEUE_NAMES.WEBHOOK_DELIVERY,
  'order.cancelled': QUEUE_NAMES.WEBHOOK_DELIVERY,
  'payment.succeeded': QUEUE_NAMES.WEBHOOK_DELIVERY,
  'payment.failed': QUEUE_NAMES.WEBHOOK_DELIVERY,
  'product.created': QUEUE_NAMES.WEBHOOK_DELIVERY,
  'product.updated': QUEUE_NAMES.WEBHOOK_DELIVERY,

  // Email events
  'email.': QUEUE_NAMES.EMAIL,
  'user.registered': QUEUE_NAMES.EMAIL,
  'order.confirmation': QUEUE_NAMES.EMAIL,
  'password.reset': QUEUE_NAMES.EMAIL,

  // Fulfillment events
  'fulfillment.': QUEUE_NAMES.FULFILLMENT,
  'order.paid': QUEUE_NAMES.FULFILLMENT,
  'shipment.': QUEUE_NAMES.FULFILLMENT,

  // Stock alert events
  'stock.': QUEUE_NAMES.STOCK_ALERT,
  'inventory.': QUEUE_NAMES.STOCK_ALERT,
};

class QueueManager {
  private connection: IORedis | null = null;
  private queues: Map<QueueName, Queue> = new Map();
  private queueEvents: Map<QueueName, QueueEvents> = new Map();
  private redisAvailable = true;

  /**
   * Initialize the Redis connection and all queues.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async connect(): Promise<void> {
    if (this.connection) return;

    try {
      this.connection = new IORedis(env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          if (times > 3) {
            winstonLogger.warn('Redis connection retries exhausted, jobs will run inline', {
              component: 'QueueManager',
            });
            this.redisAvailable = false;
            return null;
          }
          return Math.min(times * 500, 2000);
        },
      });

      // Test connection
      await this.connection.ping();
      winstonLogger.info('Redis connected for BullMQ queues', {
        component: 'QueueManager',
      });

      // Create queues
      for (const queueName of Object.values(QUEUE_NAMES)) {
        // bullmq bundles its own ioredis type declarations; the runtime
        // client is structurally identical, so bridge the nominal mismatch.
        const queue = new Queue(queueName, {
          connection: this.connection as unknown as ConnectionOptions,
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        this.queues.set(queueName, queue);

        const events = new QueueEvents(queueName, {
          connection: this.connection.duplicate() as unknown as ConnectionOptions,
        });
        this.queueEvents.set(queueName, events);
      }
    } catch (error) {
      winstonLogger.warn('Redis unavailable, jobs will run inline', {
        component: 'QueueManager',
        error: error instanceof Error ? error.message : String(error),
      });
      this.redisAvailable = false;
    }
  }

  /**
   * Check if Redis/BullMQ is available.
   * When false, the OutboxPoller will execute handlers inline.
   */
  isAvailable(): boolean {
    return this.redisAvailable && this.connection !== null;
  }

  /**
   * Get a queue by name.
   */
  getQueue(name: QueueName): Queue | null {
    return this.queues.get(name) ?? null;
  }

  /**
   * Enqueue a job to the appropriate queue based on event type.
   * Uses outboxEventId as the job ID for idempotency.
   *
   * @returns true if enqueued to BullMQ, false if Redis unavailable
   */
  async enqueue(data: BaseJobData): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    const queueName = this.resolveQueue(data.eventType);
    const queue = this.queues.get(queueName);
    if (!queue) {
      winstonLogger.warn('No queue found for event type', {
        component: 'QueueManager',
        eventType: data.eventType,
        queueName,
      });
      return false;
    }

    try {
      // Use outboxEventId as job ID for idempotency
      await queue.add(data.eventType, data, {
        jobId: data.outboxEventId,
      });
      return true;
    } catch (error) {
      winstonLogger.error('Failed to enqueue job', {
        component: 'QueueManager',
        eventType: data.eventType,
        outboxEventId: data.outboxEventId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Resolve which queue an event type should be routed to.
   */
  resolveQueue(eventType: string): QueueName {
    // Try exact match first
    if (EVENT_TYPE_TO_QUEUE[eventType]) {
      return EVENT_TYPE_TO_QUEUE[eventType];
    }

    // Try prefix match
    for (const [prefix, queue] of Object.entries(EVENT_TYPE_TO_QUEUE)) {
      if (prefix.endsWith('.') && eventType.startsWith(prefix)) {
        return queue;
      }
    }

    // Default to webhook delivery (most common event type)
    return QUEUE_NAMES.WEBHOOK_DELIVERY;
  }

  /**
   * Get queue depth (number of waiting + delayed jobs).
   */
  async getQueueDepth(name: QueueName): Promise<number> {
    const queue = this.queues.get(name);
    if (!queue) return 0;

    const [waiting, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getDelayedCount(),
    ]);
    return waiting + delayed;
  }

  /**
   * Close all queues and connections.
   */
  async disconnect(): Promise<void> {
    for (const events of this.queueEvents.values()) {
      await events.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();
    this.queueEvents.clear();

    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }

    winstonLogger.info('QueueManager disconnected', {
      component: 'QueueManager',
    });
  }
}

export const queueManager = new QueueManager();
