/**
 * The payment session and the order confirmation event.
 *
 * The unit test drives the payment session with mocked dependencies: the
 * contract call of the provider, the observation of the fact, the outbox and
 * the audit trail. The assertions pin that the fact of the provider and the
 * confirmation event are applied in one transaction, that a replay repairs a
 * missing event without writing a second one, and that a failed contract call
 * is recorded instead of being swallowed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ tx: null as any }));

vi.mock('@/config/database', () => ({
  prisma: {
    order: { findFirst: vi.fn(async () => ({ currency: 'USD' })) },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/core/extensions/runtime/plugin-runtime', () => ({ callContract: vi.fn() }));
vi.mock('@/core/extensions/runtime/failure', () => ({ redactPluginFailure: vi.fn(async () => 'redacted message') }));
vi.mock('@/core/payment/provider-account', () => ({
  bindPaymentProviderAccount: vi.fn(async () => ({
    account: { providerKey: 'account-1', namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' },
  })),
}));
vi.mock('@/core/payment/observations', () => ({
  observePaymentFact: vi.fn(),
  preparePaymentFact: vi.fn(),
  applyPreparedPaymentFact: vi.fn(),
}));
vi.mock('@/core/order/service', () => ({ OrderService: { recordPaymentAttempt: vi.fn(async () => undefined) } }));
vi.mock('@/infra/events/emit', () => ({ emitEvent: vi.fn(async () => ({ id: 'event-1' })) }));
vi.mock('@/core/cache/service', () => ({ CacheService: { incrementOrderVersion: vi.fn(async () => undefined) } }));
vi.mock('@/core/logger/unified-logger', () => ({ LoggerService: { logPayment: vi.fn() } }));

import { prisma } from '@/config/database';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { redactPluginFailure } from '@/core/extensions/runtime/failure';
import { ContractCallError } from '@/core/extensions/runtime/contract-errors';
import { observePaymentFact } from '@/core/payment/observations';
import { emitEvent } from '@/infra/events/emit';
import { LoggerService } from '@/core/logger/unified-logger';
import { createPaymentSession } from '@/core/payment/session';

const ORDER = {
  id: 'order-1', userId: 'user-1', currency: 'USD', totalAmount: 19.99,
  paymentStatus: 'PENDING', status: 'PENDING', paymentAttempts: 0, paymentMethod: 'manual-payment',
};
const INPUT = {
  orderId: 'order-1', userId: 'user-1', email: 'test@example.com', pluginSlug: 'manual-payment',
  returnUrl: 'https://shop.example/payment/return', cancelUrl: 'https://shop.example/payment/cancel',
};
const FACT = {
  requestKey: 'request-1', sessionId: 'session-1', account: { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' },
  amountMinor: 1999, currency: 'USD', status: 'pending', captures: [], canStillBeCharged: true, requestClosed: false,
  action: { type: 'instructions', text: 'Pay manually.' },
} as any;

/**
 * The transaction of the session, with the rows the module writes.
 *
 * The stored payment is the row of the transaction: the creation writes it,
 * the observation updates it and the session reads it.
 */
function createTransactionMock(options: { existing?: any } = {}) {
  const stored: any = { id: 'payment-1', orderId: 'order-1' };
  const tx = {
    order: {
      findUnique: vi.fn(async () => ORDER),
      update: vi.fn(async () => ORDER),
    },
    payment: {
      create: vi.fn(async ({ data }: any) => { Object.assign(stored, data); return stored; }),
      findUnique: vi.fn(async () => options.existing ?? null),
      findFirst: vi.fn(async () => null),
      findUniqueOrThrow: vi.fn(async () => stored),
      update: vi.fn(async ({ data }: any) => { Object.assign(stored, data); return stored; }),
      updateMany: vi.fn(async ({ data }: any) => { Object.assign(stored, data); return { count: 1 }; }),
    },
    paymentLedger: { create: vi.fn(async () => ({})) },
    eventRecord: { create: vi.fn(async () => ({ id: 'event-1' })), findFirst: vi.fn(async () => null) },
    eventDelivery: { create: vi.fn(async () => ({})), createMany: vi.fn(async () => ({})) },
    adminAuditEvent: { create: vi.fn(async () => ({})), upsert: vi.fn(async () => ({})) },
    $queryRaw: vi.fn(async () => [{ now: new Date('2026-10-10T00:00:00Z') }]),
    $executeRaw: vi.fn(async () => 0),
    $queryRawUnsafe: vi.fn(async () => []),
    $executeRawUnsafe: vi.fn(async () => 0),
  };
  return { tx, stored };
}

describe('the payment session and the order confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (callback: (client: any) => unknown) => callback(state.tx));
  });

  it('applies the fact of the provider and writes the confirmation event in one transaction', async () => {
    const { tx } = createTransactionMock();
    state.tx = tx;
    vi.mocked(callContract).mockResolvedValue(FACT);
    const observed: any[] = [];
    vi.mocked(observePaymentFact).mockImplementation(async (_slug: any, _fact: any, _source: any, _claim: any, _expected: any, transaction: any) => {
      observed.push(transaction);
      // The observation stores the session of the provider.
      await transaction.payment.update({ where: { id: 'payment-1' }, data: {
        sessionId: FACT.sessionId, status: 'PENDING', actionJson: FACT.action,
      } });
      return true;
    });

    const result = await createPaymentSession(INPUT);

    expect(result.sessionId).toBe('session-1');
    // The fact is applied in the transaction of the session, not in a
    // transaction of its own.
    expect(observed).toEqual([tx]);
    expect(observePaymentFact).toHaveBeenCalledWith('manual-payment', FACT, 'creation', undefined, 'payment-1', tx);
    // The confirmation event is written in the same transaction as the fact,
    // so a committed session always has its event.
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenCalledWith(
      tx,
      'order.confirmed',
      1,
      'order-1',
      { id: 'order-1', orderId: 'order-1', instructions: 'Pay manually.' },
      { actorId: 'user-1' },
    );
    // The reservation and the session: two transactions, not three.
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    // The notification row is not written by the session: the subscriber of
    // the event writes it after the commit.
    expect((tx as any).notification).toBeUndefined();
  });

  it('repairs a missing confirmation event when a session is replayed', async () => {
    const { tx } = createTransactionMock({ existing: {
      id: 'payment-1', orderId: 'order-1', paymentMethod: 'manual-payment', providerKey: 'account-1',
      status: 'PENDING', sessionId: 'session-1', actionJson: { type: 'instructions', text: 'Pay manually.' },
      expiresAt: new Date('2026-10-10T00:30:00Z'),
    } });
    state.tx = tx;

    const result = await createPaymentSession(INPUT);

    expect(result.sessionId).toBe('session-1');
    expect(tx.eventRecord.findFirst).toHaveBeenCalledWith({ where: { type: 'order.confirmed', aggregateId: 'order-1' } });
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenCalledWith(
      tx,
      'order.confirmed',
      1,
      'order-1',
      { id: 'order-1', orderId: 'order-1', instructions: 'Pay manually.' },
      { actorId: 'user-1' },
    );
    // The replay of a known session does not call the provider again.
    expect(callContract).not.toHaveBeenCalled();
  });

  it('does not write a second confirmation event when the replay finds one', async () => {
    const { tx } = createTransactionMock({ existing: {
      id: 'payment-1', orderId: 'order-1', paymentMethod: 'manual-payment', providerKey: 'account-1',
      status: 'PENDING', sessionId: 'session-1', actionJson: { type: 'instructions', text: 'Pay manually.' },
      expiresAt: new Date('2026-10-10T00:30:00Z'),
    } });
    state.tx = tx;
    tx.eventRecord.findFirst.mockResolvedValue({ id: 'event-1' } as any);

    const result = await createPaymentSession(INPUT);

    expect(result.sessionId).toBe('session-1');
    expect(tx.eventRecord.findFirst).toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('records a failure of a contract call that never left the provider', async () => {
    const { tx } = createTransactionMock();
    state.tx = tx;
    vi.mocked(callContract).mockRejectedValue(new ContractCallError('PLUGIN_DISABLED', 'Plugin manual-payment is not enabled'));

    await expect(createPaymentSession(INPUT)).rejects.toMatchObject({ code: 'PAYMENT_OUTCOME_UNKNOWN' });

    // The request never reached the provider, so the payment has no outcome
    // to wait for.
    expect(tx.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'UNKNOWN', failureReason: 'creation_not_sent' }),
    }));
    // The failure is recorded with the code, the dispatch and the sanitized
    // message of the failure.
    expect(redactPluginFailure).toHaveBeenCalledWith('manual-payment', expect.any(ContractCallError));
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: 'manual-payment', action: 'PAYMENT_SESSION_CREATION_FAILED',
        targetType: 'payment', targetId: 'payment-1',
        summary: expect.objectContaining({
          pluginSlug: 'manual-payment', errorCode: 'PLUGIN_DISABLED', dispatch: 'not_sent', message: 'redacted message',
        }),
      }),
    }));
    expect(LoggerService.logPayment).toHaveBeenCalledWith(
      'payment-session-creation-failed',
      'order-1',
      undefined,
      expect.objectContaining({
        pluginSlug: 'manual-payment', paymentId: 'payment-1', errorCode: 'PLUGIN_DISABLED',
        dispatch: 'not_sent', message: 'redacted message',
      }),
    );
  });

  it('records an unknown outcome when the contract call may have reached the provider', async () => {
    const { tx } = createTransactionMock();
    state.tx = tx;
    vi.mocked(callContract).mockRejectedValue(new ContractCallError('PLUGIN_TIMEOUT', 'Contract call timed out'));

    await expect(createPaymentSession(INPUT)).rejects.toMatchObject({ code: 'PAYMENT_OUTCOME_UNKNOWN' });

    expect(tx.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'UNKNOWN', failureReason: 'creation_outcome_unknown' }),
    }));
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'PAYMENT_SESSION_CREATION_FAILED',
        summary: expect.objectContaining({ errorCode: 'PLUGIN_TIMEOUT', dispatch: 'outcome_unknown' }),
      }),
    }));
    expect(LoggerService.logPayment).toHaveBeenCalledWith(
      'payment-session-creation-failed',
      'order-1',
      undefined,
      expect.objectContaining({ errorCode: 'PLUGIN_TIMEOUT', dispatch: 'outcome_unknown' }),
    );
  });
});
