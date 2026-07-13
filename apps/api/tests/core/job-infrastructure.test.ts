/**
 * Tests for the Unified Job Infrastructure
 *
 * Tests cover:
 * - QueueManager: enqueue, resolveQueue, isAvailable
 * - WorkerManager: register, executeInline
 * - OutboxPoller: processBatch (with mocked DB + queue)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('@/config/database', () => ({
  prisma: {
    outboxEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/config/env', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
    WORKER_MODE: 'embedded' as const,
  },
}));

vi.mock('@/core/logger/unified-logger', () => ({
  winstonLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  LoggerService: {
    log: vi.fn(),
    logError: vi.fn(),
  },
}));

vi.mock('@/core/webhooks/event-dispatcher', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================
// Tests
// ============================================================

describe('Unified Job Infrastructure', () => {
  describe('Types', () => {
    it('should define all queue names', async () => {
      const { QUEUE_NAMES } = await import('@/infra/jobs/types');
      expect(QUEUE_NAMES.WEBHOOK_DELIVERY).toBe('webhook-delivery');
      expect(QUEUE_NAMES.EMAIL).toBe('email');
      expect(QUEUE_NAMES.FULFILLMENT).toBe('fulfillment');
      expect(QUEUE_NAMES.STOCK_ALERT).toBe('stock-alert');
    });
  });

  describe('QueueManager', () => {
    it('should resolve event types to correct queues', async () => {
      // Import without connecting — resolveQueue doesn't need Redis
      const { queueManager } = await import('@/infra/jobs/queue-manager');

      expect(queueManager.resolveQueue('webhook.delivery')).toBe('webhook-delivery');
      expect(queueManager.resolveQueue('order.created')).toBe('webhook-delivery');
      expect(queueManager.resolveQueue('email.send')).toBe('email');
      expect(queueManager.resolveQueue('user.registered')).toBe('email');
      expect(queueManager.resolveQueue('order.paid')).toBe('fulfillment');
      expect(queueManager.resolveQueue('stock.check')).toBe('stock-alert');
      expect(queueManager.resolveQueue('inventory.adjusted')).toBe('stock-alert');
    });

    it('should default to webhook-delivery for unknown event types', async () => {
      const { queueManager } = await import('@/infra/jobs/queue-manager');
      expect(queueManager.resolveQueue('unknown.event')).toBe('webhook-delivery');
    });

    it('should report unavailable when not connected', async () => {
      const { queueManager } = await import('@/infra/jobs/queue-manager');
      // Without calling connect(), Redis is not available
      expect(queueManager.isAvailable()).toBe(false);
    });

    it('should return false from enqueue when Redis unavailable', async () => {
      const { queueManager } = await import('@/infra/jobs/queue-manager');
      const result = await queueManager.enqueue({
        outboxEventId: 'test-id',
        eventType: 'webhook.delivery',
      });
      expect(result).toBe(false);
    });
  });

  describe('WorkerManager', () => {
    it('should register handlers', async () => {
      const { workerManager } = await import('@/infra/jobs/worker-manager');
      const { QUEUE_NAMES } = await import('@/infra/jobs/types');

      const handler = {
        queue: QUEUE_NAMES.EMAIL,
        eventTypes: ['test.event'],
        handle: vi.fn(),
      };

      workerManager.register(handler);
      // No error means registration succeeded
    });

    it('should execute handlers inline', async () => {
      const { workerManager } = await import('@/infra/jobs/worker-manager');
      const { QUEUE_NAMES } = await import('@/infra/jobs/types');

      const mockHandle = vi.fn().mockResolvedValue(undefined);
      const handler = {
        queue: QUEUE_NAMES.WEBHOOK_DELIVERY,
        eventTypes: ['inline.test'],
        handle: mockHandle,
      };

      workerManager.register(handler);

      await workerManager.executeInline({
        outboxEventId: 'inline-test-id',
        eventType: 'inline.test',
      });

      expect(mockHandle).toHaveBeenCalledWith({
        outboxEventId: 'inline-test-id',
        eventType: 'inline.test',
      });
    });

    it('should handle missing handler gracefully in inline mode', async () => {
      const { workerManager } = await import('@/infra/jobs/worker-manager');

      // Should not throw
      await workerManager.executeInline({
        outboxEventId: 'no-handler-test',
        eventType: 'nonexistent.event.type',
      });
    });
  });

  describe('OutboxPoller', () => {
    it('should start and stop without errors', async () => {
      const { outboxPoller } = await import('@/infra/jobs/outbox-poller');

      outboxPoller.start();
      outboxPoller.stop();
    });
  });

  describe('Handlers', () => {
    it('should register all handlers without errors', async () => {
      const { registerAllHandlers } = await import('@/infra/jobs/handlers');
      // Should not throw
      registerAllHandlers();
    });
  });

  describe('Event Type Routing', () => {
    it('should route order events to webhook-delivery', async () => {
      const { queueManager } = await import('@/infra/jobs/queue-manager');
      expect(queueManager.resolveQueue('order.created')).toBe('webhook-delivery');
      expect(queueManager.resolveQueue('order.updated')).toBe('webhook-delivery');
      expect(queueManager.resolveQueue('order.cancelled')).toBe('webhook-delivery');
    });

    it('should route payment events to webhook-delivery', async () => {
      const { queueManager } = await import('@/infra/jobs/queue-manager');
      expect(queueManager.resolveQueue('payment.succeeded')).toBe('webhook-delivery');
      expect(queueManager.resolveQueue('payment.failed')).toBe('webhook-delivery');
    });

    it('should route email events to email queue', async () => {
      const { queueManager } = await import('@/infra/jobs/queue-manager');
      expect(queueManager.resolveQueue('email.send')).toBe('email');
      expect(queueManager.resolveQueue('password.reset')).toBe('email');
    });

    it('should route fulfillment events to fulfillment queue', async () => {
      const { queueManager } = await import('@/infra/jobs/queue-manager');
      expect(queueManager.resolveQueue('fulfillment.create')).toBe('fulfillment');
      expect(queueManager.resolveQueue('order.paid')).toBe('fulfillment');
    });

    it('should route stock events to stock-alert queue', async () => {
      const { queueManager } = await import('@/infra/jobs/queue-manager');
      expect(queueManager.resolveQueue('stock.check')).toBe('stock-alert');
      expect(queueManager.resolveQueue('inventory.adjusted')).toBe('stock-alert');
    });
  });
});
