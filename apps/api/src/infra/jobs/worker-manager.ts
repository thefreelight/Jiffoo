/**
 * Worker Manager — BullMQ Worker lifecycle management
 *
 * Manages Worker instances in the dedicated worker process.
 *
 * When Redis is unavailable, the OutboxPoller falls back to inline execution.
 */

import { Worker, Job, type ConnectionOptions } from 'bullmq';
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

class WorkerManager {
  private started = false;
  private connections: IORedis[] = [];

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
   */
  async start(): Promise<void> {
    if (this.started) return;

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
    this.connections.push(connection);

    // Group handlers by queue
    const queuesWithHandlers = new Set<QueueName>();
    for (const handler of handlerRegistry.values()) {
      queuesWithHandlers.add(handler.queue);
    }

    // Start a worker for each queue that has handlers
    for (const queueName of queuesWithHandlers) {
      const workerConnection = connection.duplicate();
      this.connections.push(workerConnection);
      const worker = new Worker<BaseJobData>(
        queueName,
        async (job: Job<BaseJobData>) => {
          return this.processJob(job);
        },
        {
          // bullmq bundles its own ioredis type declarations; the runtime
          // client is structurally identical, so bridge the nominal mismatch.
          connection: workerConnection as unknown as ConnectionOptions,
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
      await worker.waitUntilReady();
    }

    this.started = true;
    winstonLogger.info('WorkerManager started', {
      component: 'WorkerManager',
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
    for (const connection of this.connections) connection.disconnect();
    this.connections = [];
    this.started = false;
    winstonLogger.info('WorkerManager stopped', {
      component: 'WorkerManager',
    });
  }

  async getRedisConnections(): Promise<Array<{ name: string; client: { status: string } }>> {
    const connections = this.connections.map((client, index) => ({
      name: `worker-input:${index}`,
      client: client as { status: string },
    }));
    for (const [name, worker] of workers) {
      connections.push({ name: `worker-blocking:${name}`, client: await worker.waitUntilReady() });
    }
    return connections;
  }

  /**
   * Check if workers are running.
   */
  isRunning(): boolean {
    return this.started;
  }
}

export const workerManager = new WorkerManager();
