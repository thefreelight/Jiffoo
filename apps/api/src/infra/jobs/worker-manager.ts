/**
 * Worker Manager — BullMQ Worker lifecycle management
 *
 * Manages Worker instances for each queue. Supports three deployment modes:
 * - embedded: Workers start inside the API process
 * - standalone: Workers run in a separate process (node dist/worker.js)
 * - off: No workers; jobs are enqueued but not consumed
 *
 * When Redis is unavailable, the OutboxPoller falls back to inline execution.
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/config/env';
import { winstonLogger } from '@/core/logger/unified-logger';
import { queueManager } from './queue-manager';
import { QUEUE_NAMES, type QueueName, type JobHandler, type BaseJobData } from './types';

/**
 * Handler registry: maps event types to their handlers.
 */
const handlerRegistry = new Map<string, JobHandler>();

/**
 * Worker instances per queue.
 */
const workers = new Map<QueueName, Worker<BaseJobData>>();

/**
 * Parse WORKER_MODE from environment.
 */
function getWorkerMode(): 'embedded' | 'standalone' | 'off' {
  const mode = process.env.WORKER_MODE || 'embedded';
  if (mode === 'standalone' || mode === 'off' || mode === 'embedded') {
    return mode;
  }
  return 'embedded';
}

class WorkerManager {
  private started = false;

  /**
   * Register a job handler.
   * Must be called before start().
   */
  register(handler: JobHandler): void {
    for (const eventType of handler.eventTypes) {
      handlerRegistry.set(eventType, handler);
      winstonLogger.debug('Registered job handler', {
        component: 'WorkerManager',
        eventType,
        queue: handler.queue,
      });
    }
  }

  /**
   * Start workers for all registered queues.
   * In 'off' mode, this is a no-op.
   * In 'standalone' mode, this should be called from the worker entry point.
   * In 'embedded' mode, this is called from the API server.
   */
  async start(): Promise<void> {
    if (this.started) return;

    const mode = getWorkerMode();
    if (mode === 'off') {
      winstonLogger.info('Worker mode is "off" — jobs will not be consumed', {
        component: 'WorkerManager',
      });
      return;
    }

    if (!queueManager.isAvailable()) {
      winstonLogger.warn('Redis unavailable — workers not started, jobs will run inline', {
        component: 'WorkerManager',
      });
      return;
    }

    // Create a dedicated connection for workers
    const connection = new IORedis(env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });

    // Group handlers by queue
    const queuesWithHandlers = new Set<QueueName>();
    for (const handler of handlerRegistry.values()) {
      queuesWithHandlers.add(handler.queue);
    }

    // Start a worker for each queue that has handlers
    for (const queueName of queuesWithHandlers) {
      const worker = new Worker<BaseJobData>(
        queueName,
        async (job: Job<BaseJobData>) => {
          return this.processJob(job);
        },
        {
          connection: connection.duplicate(),
          concurrency: 5,
        }
      );

      worker.on('completed', (job) => {
        winstonLogger.debug('Job completed', {
          component: 'WorkerManager',
          jobId: job.id,
          eventType: job.data.eventType,
        });
      });

      worker.on('failed', (job, err) => {
        winstonLogger.error('Job failed', {
          component: 'WorkerManager',
          jobId: job?.id,
          eventType: job?.data?.eventType,
          error: err.message,
          attemptsMade: job?.attemptsMade,
        });

        // After 5 attempts, route to DLQ
        if (job && job.attemptsMade >= 5) {
          this.handleDeadLetter(job, err).catch((dlqErr) => {
            winstonLogger.error('Failed to process dead letter', {
              component: 'WorkerManager',
              jobId: job.id,
              error: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
            });
          });
        }
      });

      workers.set(queueName, worker);
    }

    this.started = true;
    winstonLogger.info('WorkerManager started', {
      component: 'WorkerManager',
      mode,
      queues: Array.from(queuesWithHandlers),
    });
  }

  /**
   * Process a single job by dispatching to the registered handler.
   */
  private async processJob(job: Job<BaseJobData>): Promise<void> {
    const { eventType, outboxEventId } = job.data;
    const handler = handlerRegistry.get(eventType);

    if (!handler) {
      winstonLogger.warn('No handler registered for event type', {
        component: 'WorkerManager',
        eventType,
        outboxEventId,
      });
      return;
    }

    const startTime = Date.now();
    await handler.handle(job.data);
    const duration = Date.now() - startTime;

    winstonLogger.debug('Job processed', {
      component: 'WorkerManager',
      eventType,
      outboxEventId,
      durationMs: duration,
    });
  }

  /**
   * Handle dead letter — called when a job exceeds max retry attempts.
   * For webhook events, records to WebhookDeadLetter table.
   * For other events, logs structured error.
   */
  private async handleDeadLetter(job: Job<BaseJobData>, error: Error): Promise<void> {
    const { eventType, outboxEventId } = job.data;

    winstonLogger.error('Job exceeded max retries — dead letter', {
      component: 'WorkerManager',
      eventType,
      outboxEventId,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      error: error.message,
    });

    // Mark outbox event as permanently failed
    try {
      const { prisma } = await import('@/config/database');
      await prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: {
          lastError: `Dead letter after ${job.attemptsMade} attempts: ${error.message}`,
          retryCount: job.attemptsMade,
        },
      });
    } catch (dbErr) {
      winstonLogger.error('Failed to mark outbox event as dead-lettered', {
        component: 'WorkerManager',
        outboxEventId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }
  }

  /**
   * Execute a handler inline (fallback when Redis is unavailable).
   * This sacrifices retry semantics but preserves availability.
   */
  async executeInline(data: BaseJobData): Promise<void> {
    const handler = handlerRegistry.get(data.eventType);
    if (!handler) {
      winstonLogger.warn('No handler for inline execution', {
        component: 'WorkerManager',
        eventType: data.eventType,
      });
      return;
    }

    winstonLogger.warn('Executing job inline (Redis unavailable)', {
      component: 'WorkerManager',
      eventType: data.eventType,
      outboxEventId: data.outboxEventId,
    });

    try {
      await handler.handle(data);
    } catch (error) {
      winstonLogger.error('Inline job execution failed', {
        component: 'WorkerManager',
        eventType: data.eventType,
        outboxEventId: data.outboxEventId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't rethrow — inline execution is best-effort
    }
  }

  /**
   * Stop all workers.
   */
  async stop(): Promise<void> {
    for (const worker of workers.values()) {
      await worker.close();
    }
    workers.clear();
    this.started = false;
    winstonLogger.info('WorkerManager stopped', {
      component: 'WorkerManager',
    });
  }

  /**
   * Check if workers are running.
   */
  isRunning(): boolean {
    return this.started;
  }
}

export const workerManager = new WorkerManager();
