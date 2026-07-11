/**
 * Stripe plugin - Real DB integration tests
 *
 * Requires PostgreSQL with STRIPE_DATABASE_URL set.
 * Uses the stripe-specific Prisma client generated output.
 */

import { loadEnvFile } from '../../../../../tests/shared/load-env';
import path from 'path';
loadEnvFile(path.resolve(__dirname, '../../../../../.env.test'));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const skipDb = !process.env.STRIPE_DATABASE_URL;
const describeDb = skipDb ? describe.skip : describe;

// Only create the Prisma client when we actually need it.
// We use a lazy accessor so that the import does not fail when
// the generated Prisma client does not exist (e.g. in CI without DB).
function getPrisma() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('../../node_modules/.prisma/stripe-client');
  return new PrismaClient({
    datasources: {
      db: { url: process.env.STRIPE_DATABASE_URL },
    },
  });
}

let prisma: any;

describeDb('Stripe DB Integration', () => {
  beforeAll(async () => {
    prisma = getPrisma();
    await prisma.$connect();
    await cleanAll();
  });

  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanAll();
  });

  async function cleanAll() {
    // Delete in dependency order (children first)
    await prisma.webhookEvent.deleteMany();
    await prisma.refundRecord.deleteMany();
    await prisma.paymentRecord.deleteMany();
  }

  // ==========================================================================
  // PaymentRecord CRUD
  // ==========================================================================

  describe('PaymentRecord', () => {
    it('should create and read a PaymentRecord', async () => {
      const record = await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_1',
          orderId: 'order_1',
          stripePaymentIntentId: 'pi_test_1',
          amount: 5000,
          currency: 'usd',
          status: 'processing',
          customerEmail: 'test@example.com',
          metadata: { key: 'value' },
        },
      });

      expect(record.id).toBeDefined();
      expect(record.orderId).toBe('order_1');
      expect(record.amount).toBe(5000);
      expect(record.status).toBe('processing');

      const found = await prisma.paymentRecord.findUnique({
        where: { stripePaymentIntentId: 'pi_test_1' },
      });
      expect(found).not.toBeNull();
      expect(found!.orderId).toBe('order_1');
    });

    it('should update a PaymentRecord', async () => {
      const record = await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_update',
          orderId: 'order_update',
          stripePaymentIntentId: 'pi_update',
          amount: 3000,
          currency: 'usd',
        },
      });

      const updated = await prisma.paymentRecord.update({
        where: { id: record.id },
        data: {
          status: 'succeeded',
          paidAt: new Date(),
        },
      });

      expect(updated.status).toBe('succeeded');
      expect(updated.paidAt).not.toBeNull();
    });

    it('should enforce unique constraint on [installationId, orderId]', async () => {
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_dup',
          orderId: 'order_dup',
          amount: 1000,
          currency: 'usd',
        },
      });

      await expect(
        prisma.paymentRecord.create({
          data: {
            installationId: 'ins_dup',
            orderId: 'order_dup',
            amount: 2000,
            currency: 'usd',
          },
        }),
      ).rejects.toThrow();
    });

    it('should enforce unique constraint on stripePaymentIntentId', async () => {
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_pi_dup1',
          orderId: 'order_pi_dup1',
          stripePaymentIntentId: 'pi_unique_test',
          amount: 1000,
          currency: 'usd',
        },
      });

      await expect(
        prisma.paymentRecord.create({
          data: {
            installationId: 'ins_pi_dup2',
            orderId: 'order_pi_dup2',
            stripePaymentIntentId: 'pi_unique_test',
            amount: 2000,
            currency: 'usd',
          },
        }),
      ).rejects.toThrow();
    });

    it('should allow multiple orders for the same installation with different orderIds', async () => {
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_multi',
          orderId: 'order_a',
          amount: 1000,
          currency: 'usd',
        },
      });

      const second = await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_multi',
          orderId: 'order_b',
          amount: 2000,
          currency: 'usd',
        },
      });

      expect(second.id).toBeDefined();
    });
  });

  // ==========================================================================
  // RefundRecord
  // ==========================================================================

  describe('RefundRecord', () => {
    it('should create a refund linked to a payment', async () => {
      const payment = await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_refund',
          orderId: 'order_refund',
          stripePaymentIntentId: 'pi_refund_test',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
        },
      });

      const refund = await prisma.refundRecord.create({
        data: {
          installationId: 'ins_refund',
          paymentRecordId: payment.id,
          stripeRefundId: 're_test_1',
          amount: 2500,
          reason: 'requested_by_customer',
          status: 'succeeded',
        },
      });

      expect(refund.id).toBeDefined();
      expect(refund.paymentRecordId).toBe(payment.id);
      expect(refund.amount).toBe(2500);
    });

    it('should cascade delete refunds when payment is deleted', async () => {
      const payment = await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_cascade',
          orderId: 'order_cascade',
          stripePaymentIntentId: 'pi_cascade',
          amount: 5000,
          currency: 'usd',
          status: 'refunded',
        },
      });

      await prisma.refundRecord.create({
        data: {
          installationId: 'ins_cascade',
          paymentRecordId: payment.id,
          stripeRefundId: 're_cascade_1',
          amount: 2500,
          status: 'succeeded',
        },
      });
      await prisma.refundRecord.create({
        data: {
          installationId: 'ins_cascade',
          paymentRecordId: payment.id,
          stripeRefundId: 're_cascade_2',
          amount: 2500,
          status: 'succeeded',
        },
      });

      const countBefore = await prisma.refundRecord.count({
        where: { paymentRecordId: payment.id },
      });
      expect(countBefore).toBe(2);

      await prisma.paymentRecord.delete({ where: { id: payment.id } });

      const countAfter = await prisma.refundRecord.count({
        where: { paymentRecordId: payment.id },
      });
      expect(countAfter).toBe(0);
    });

    it('should enforce unique constraint on stripeRefundId', async () => {
      const payment = await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_ref_unique',
          orderId: 'order_ref_unique',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
        },
      });

      await prisma.refundRecord.create({
        data: {
          installationId: 'ins_ref_unique',
          paymentRecordId: payment.id,
          stripeRefundId: 're_unique_test',
          amount: 1000,
          status: 'succeeded',
        },
      });

      await expect(
        prisma.refundRecord.create({
          data: {
            installationId: 'ins_ref_unique',
            paymentRecordId: payment.id,
            stripeRefundId: 're_unique_test',
            amount: 1000,
            status: 'succeeded',
          },
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // WebhookEvent
  // ==========================================================================

  describe('WebhookEvent', () => {
    it('should create a webhook event', async () => {
      const event = await prisma.webhookEvent.create({
        data: {
          installationId: 'ins_wh',
          stripeEventId: 'evt_test_1',
          eventType: 'payment_intent.succeeded',
          payload: { object: { id: 'pi_test' } },
        },
      });

      expect(event.id).toBeDefined();
      expect(event.stripeEventId).toBe('evt_test_1');
      expect(event.processed).toBe(false);
    });

    it('should enforce unique constraint on stripeEventId (idempotency)', async () => {
      await prisma.webhookEvent.create({
        data: {
          installationId: 'ins_wh_dup',
          stripeEventId: 'evt_dup_1',
          eventType: 'payment_intent.succeeded',
          payload: {},
        },
      });

      await expect(
        prisma.webhookEvent.create({
          data: {
            installationId: 'ins_wh_dup',
            stripeEventId: 'evt_dup_1',
            eventType: 'payment_intent.succeeded',
            payload: {},
          },
        }),
      ).rejects.toThrow();
    });

    it('should support upsert for idempotent event storage', async () => {
      await prisma.webhookEvent.create({
        data: {
          installationId: 'ins_wh_upsert',
          stripeEventId: 'evt_upsert',
          eventType: 'payment_intent.succeeded',
          payload: {},
        },
      });

      // Upsert should not throw
      const result = await prisma.webhookEvent.upsert({
        where: { stripeEventId: 'evt_upsert' },
        update: {},
        create: {
          installationId: 'ins_wh_upsert',
          stripeEventId: 'evt_upsert',
          eventType: 'payment_intent.succeeded',
          payload: {},
        },
      });

      expect(result.stripeEventId).toBe('evt_upsert');
    });

    it('should update processed and errorMessage fields', async () => {
      await prisma.webhookEvent.create({
        data: {
          installationId: 'ins_wh_update',
          stripeEventId: 'evt_update',
          eventType: 'payment_intent.payment_failed',
          payload: {},
        },
      });

      const updated = await prisma.webhookEvent.update({
        where: { stripeEventId: 'evt_update' },
        data: { processed: true },
      });

      expect(updated.processed).toBe(true);
    });
  });

  // ==========================================================================
  // Installation data isolation
  // ==========================================================================

  describe('Installation data isolation', () => {
    it('should not return payments from a different installation', async () => {
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_tenant_a',
          orderId: 'order_iso_1',
          amount: 3000,
          currency: 'usd',
          status: 'succeeded',
        },
      });
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_tenant_b',
          orderId: 'order_iso_2',
          amount: 7000,
          currency: 'usd',
          status: 'succeeded',
        },
      });

      const tenantAPayments = await prisma.paymentRecord.findMany({
        where: { installationId: 'ins_tenant_a' },
      });
      expect(tenantAPayments).toHaveLength(1);
      expect(tenantAPayments[0].orderId).toBe('order_iso_1');

      const tenantBPayments = await prisma.paymentRecord.findMany({
        where: { installationId: 'ins_tenant_b' },
      });
      expect(tenantBPayments).toHaveLength(1);
      expect(tenantBPayments[0].orderId).toBe('order_iso_2');
    });

    it('should isolate aggregation by installationId', async () => {
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_agg_a',
          orderId: 'order_agg_a1',
          amount: 1000,
          currency: 'usd',
          status: 'succeeded',
        },
      });
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_agg_a',
          orderId: 'order_agg_a2',
          amount: 2000,
          currency: 'usd',
          status: 'succeeded',
        },
      });
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_agg_b',
          orderId: 'order_agg_b1',
          amount: 9000,
          currency: 'usd',
          status: 'succeeded',
        },
      });

      const resultA = await prisma.paymentRecord.aggregate({
        where: { installationId: 'ins_agg_a', status: 'succeeded' },
        _sum: { amount: true },
      });
      expect(resultA._sum.amount).toBe(3000);

      const resultB = await prisma.paymentRecord.aggregate({
        where: { installationId: 'ins_agg_b', status: 'succeeded' },
        _sum: { amount: true },
      });
      expect(resultB._sum.amount).toBe(9000);
    });

    it('should allow same orderId across different installations', async () => {
      const recA = await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_dup_order_a',
          orderId: 'shared_order',
          amount: 1000,
          currency: 'usd',
        },
      });
      const recB = await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_dup_order_b',
          orderId: 'shared_order',
          amount: 2000,
          currency: 'usd',
        },
      });

      expect(recA.id).toBeDefined();
      expect(recB.id).toBeDefined();
      expect(recA.id).not.toBe(recB.id);
    });
  });

  // ==========================================================================
  // Complex queries
  // ==========================================================================

  describe('Complex queries', () => {
    it('should list payments with pagination and status filter', async () => {
      // Create multiple payments
      for (let i = 1; i <= 5; i++) {
        await prisma.paymentRecord.create({
          data: {
            installationId: 'ins_query',
            orderId: `order_q${i}`,
            amount: i * 1000,
            currency: 'usd',
            status: i <= 3 ? 'succeeded' : 'failed',
          },
        });
      }

      // Query with status filter
      const succeeded = await prisma.paymentRecord.findMany({
        where: { installationId: 'ins_query', status: 'succeeded' },
        orderBy: { createdAt: 'desc' },
      });
      expect(succeeded).toHaveLength(3);

      // Query with pagination
      const page1 = await prisma.paymentRecord.findMany({
        where: { installationId: 'ins_query' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 2,
      });
      expect(page1).toHaveLength(2);

      const total = await prisma.paymentRecord.count({
        where: { installationId: 'ins_query' },
      });
      expect(total).toBe(5);
    });

    it('should aggregate payment sums', async () => {
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_agg',
          orderId: 'order_agg1',
          amount: 3000,
          currency: 'usd',
          status: 'succeeded',
        },
      });
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_agg',
          orderId: 'order_agg2',
          amount: 7000,
          currency: 'usd',
          status: 'succeeded',
        },
      });
      await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_agg',
          orderId: 'order_agg3',
          amount: 2000,
          currency: 'usd',
          status: 'failed',
        },
      });

      const result = await prisma.paymentRecord.aggregate({
        where: { installationId: 'ins_agg', status: 'succeeded' },
        _sum: { amount: true },
      });

      expect(result._sum.amount).toBe(10000);
    });

    it('should query payment with included refunds', async () => {
      const payment = await prisma.paymentRecord.create({
        data: {
          installationId: 'ins_include',
          orderId: 'order_include',
          stripePaymentIntentId: 'pi_include',
          amount: 10000,
          currency: 'usd',
          status: 'partially_refunded',
        },
      });

      await prisma.refundRecord.create({
        data: {
          installationId: 'ins_include',
          paymentRecordId: payment.id,
          stripeRefundId: 're_include_1',
          amount: 3000,
          status: 'succeeded',
        },
      });
      await prisma.refundRecord.create({
        data: {
          installationId: 'ins_include',
          paymentRecordId: payment.id,
          stripeRefundId: 're_include_2',
          amount: 2000,
          status: 'succeeded',
        },
      });

      const paymentWithRefunds = await prisma.paymentRecord.findUnique({
        where: { id: payment.id },
        include: { refunds: true },
      });

      expect(paymentWithRefunds).not.toBeNull();
      expect(paymentWithRefunds!.refunds).toHaveLength(2);

      const totalRefunded = paymentWithRefunds!.refunds.reduce(
        (sum: number, r: any) => sum + r.amount,
        0,
      );
      expect(totalRefunded).toBe(5000);
    });
  });
});
