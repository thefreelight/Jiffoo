import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import * as pluginRuntime from '@/core/extensions/runtime/plugin-runtime';
import * as observations from '@/core/payment/observations';
import { reconcilePendingPayments } from '@/core/payment/reconciliation';
import { createTestOrder } from '../helpers/fixtures';
import { createTestUser, deleteTestUser } from '../helpers/auth';

const failingSlug = `reconcile-failing-${randomUUID().slice(0, 8)}`;
const workingSlug = `reconcile-working-${randomUUID().slice(0, 8)}`;

afterEach(() => { vi.restoreAllMocks(); });

describe('the scheduling of a payment reconciliation round', () => {
  it('a failed round backs off with the jittered interval and a successful round keeps the minute cadence', async () => {
    const user = await createTestUser();
    // The payments table keeps one open payment per order, so the two rounds
    // of the test live on two orders.
    const failingOrder = await createTestOrder({ userId: user.id, total: 10 });
    const workingOrder = await createTestOrder({ userId: user.id, total: 10 });
    const account = await prisma.paymentProviderAccount.create({ data: { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' } });
    // The failing payment carries two attempts, so the claim that follows makes
    // its third attempt and the backed off interval of that attempt is four
    // minutes.
    const failing = await prisma.payment.create({ data: {
      providerKey: account.providerKey, idempotencyKey: `idem-${randomUUID()}`, orderId: failingOrder.id, attemptNumber: 1,
      paymentMethod: failingSlug, amount: 10, sessionId: `session-${randomUUID()}`, status: 'PENDING', attempts: 2,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60000),
    } });
    const working = await prisma.payment.create({ data: {
      providerKey: account.providerKey, idempotencyKey: `idem-${randomUUID()}`, orderId: workingOrder.id, attemptNumber: 1,
      paymentMethod: workingSlug, amount: 10, sessionId: `session-${randomUUID()}`, status: 'PENDING', attempts: 0,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60000),
    } });
    try {
      // The provider boundary is stubbed: the failing provider refuses the
      // query and the working provider answers that the payment is still open.
      vi.spyOn(pluginRuntime, 'callContract').mockImplementation(async (...args: any[]) => {
        if (args[0] === failingSlug) throw new Error('The provider is unreachable');
        return { account: { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' },
          requestKey: 'request-key', sessionId: 'session-key', amountMinor: 1000, currency: 'USD',
          observedAt: new Date().toISOString(), status: 'pending', canStillBeCharged: true, requestClosed: false, captures: [] };
      });
      vi.spyOn(observations, 'observePaymentFact').mockResolvedValue(true);

      const before = Date.now();
      const result = await reconcilePendingPayments({ limit: 10, minAgeMinutes: 0 });
      const after = Date.now();

      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(result.updated).toBeGreaterThanOrEqual(1);

      // The failed round leaves the payment on the backed off interval of its
      // third attempt: four minutes plus a jitter of at most a fifth of it.
      const failedRow = await prisma.payment.findUniqueOrThrow({ where: { id: failing.id } });
      const failedDelay = failedRow.nextReconcileAt.getTime() - before;
      expect(failedDelay).toBeGreaterThanOrEqual(240_000 - 5_000);
      expect(failedDelay).toBeLessThanOrEqual(288_000 + 5_000);
      // The fixed cadence of one minute is not in force any more.
      expect(failedDelay).toBeGreaterThan(120_000);
      expect(failedRow.status).toBe('UNKNOWN');
      expect(failedRow.failureReason).toBe('request_query_unavailable');

      // The successful round keeps the business cadence of one minute.
      const workedRow = await prisma.payment.findUniqueOrThrow({ where: { id: working.id } });
      expect(workedRow.nextReconcileAt.getTime()).toBeGreaterThanOrEqual(before + 60_000 - 5_000);
      expect(workedRow.nextReconcileAt.getTime()).toBeLessThanOrEqual(after + 60_000 + 5_000);
      expect(workedRow.status).toBe('PENDING');
    } finally {
      await prisma.payment.deleteMany({ where: { id: { in: [failing.id, working.id] } } });
      await prisma.paymentProviderAccount.delete({ where: { providerKey: account.providerKey } });
      await prisma.order.deleteMany({ where: { id: { in: [failingOrder.id, workingOrder.id] } } });
      await deleteTestUser(user.id);
    }
  });
});
