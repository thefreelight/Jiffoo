/**
 * Outbox Poller — Enhanced with BullMQ dispatch
 *
 * Polls the OutboxEvent table and dispatches events to BullMQ queues.
 * When Redis is unavailable, falls back to inline execution.
 *
 * Key design:
 * - Job ID = OutboxEvent ID (idempotency)
 * - Events are marked as published only after successful enqueue
 * - Inline fallback preserves availability when Redis is down
 */

import { prisma } from '@/config/database';
import { winstonLogger } from '@/core/logger/unified-logger';
import { queueManager } from './queue-manager';
import { workerManager } from './worker-manager';
import type { BaseJobData } from './types';

const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 50;

class OutboxPoller {
  private interval: NodeJS.Timeout | null = null;
  private running = false;
  private processing = false;

  /**
   * Start polling the outbox table.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    winstonLogger.info('OutboxPoller started', {
      component: 'OutboxPoller',
      intervalMs: POLL_INTERVAL_MS,
    });

    // Process immediately, then on interval
    this.processBatch().catch((err) => {
      winstonLogger.error('OutboxPoller initial batch failed', {
        component: 'OutboxPoller',
        error: err instanceof Error ? err.message : String(err),
      });
    });

    this.interval = setInterval(() => {
      this.processBatch().catch((err) => {
        winstonLogger.error('OutboxPoller batch failed', {
          component: 'OutboxPoller',
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stop polling.
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
    winstonLogger.info('OutboxPoller stopped', {
      component: 'OutboxPoller',
    });
  }

  /**
   * Process a batch of unpublished outbox events.
   */
  private async processBatch(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const events = await prisma.outboxEvent.findMany({
        where: { published: false },
        orderBy: { occurredAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (events.length === 0) return;

      winstonLogger.debug('Processing outbox batch', {
        component: 'OutboxPoller',
        count: events.length,
      });

      const publishedIds: string[] = [];

      for (const event of events) {
        try {
          const jobData: BaseJobData = {
            outboxEventId: event.id,
            eventType: event.type,
            traceId: event.traceId ?? undefined,
            actorId: event.actorId ?? undefined,
          };

          // Try to enqueue to BullMQ
          const enqueued = await queueManager.enqueue(jobData);

          if (enqueued) {
            publishedIds.push(event.id);
          } else {
            // Redis unavailable — execute inline as fallback
            await workerManager.executeInline(jobData);
            publishedIds.push(event.id);
          }
        } catch (error) {
          winstonLogger.error('Failed to dispatch outbox event', {
            component: 'OutboxPoller',
            eventId: event.id,
            eventType: event.type,
            error: error instanceof Error ? error.message : String(error),
          });

          // Increment retry count, keep unpublished for next batch
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              retryCount: { increment: 1 },
              lastError: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      // Mark successfully dispatched events as published
      if (publishedIds.length > 0) {
        await prisma.outboxEvent.updateMany({
          where: { id: { in: publishedIds } },
          data: {
            published: true,
            publishedAt: new Date(),
          },
        });

        winstonLogger.debug('Outbox batch processed', {
          component: 'OutboxPoller',
          published: publishedIds.length,
          failed: events.length - publishedIds.length,
        });
      }
    } catch (error) {
      winstonLogger.error('OutboxPoller batch error', {
        component: 'OutboxPoller',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.processing = false;
    }
  }
}

export const outboxPoller = new OutboxPoller();
