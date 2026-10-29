import { beforeEach, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import type { NotificationTransaction } from '@/core/notifications/service';

const { prismaMock, orderServiceMock, emitOrderPaidEventMock, emitEventMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    payment: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
    paymentLedger: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  },
  orderServiceMock: { applyPaymentSucceeded: vi.fn(), applyPaymentFailed: vi.fn(), getOrderProjection: vi.fn() },
  emitOrderPaidEventMock: vi.fn(),
  emitEventMock: vi.fn(),
}));

vi.mock('@/config/database', () => ({ prisma: prismaMock }));
vi.mock('@/core/order/service', () => ({ OrderService: orderServiceMock }));
vi.mock('@/core/payment/order-paid-event', () => ({ emitOrderPaidEvent: emitOrderPaidEventMock }));
vi.mock('@/infra/events/emit', () => ({ emitEvent: emitEventMock }));

import { isAppliedPaymentFactConflict, recordPaymentSucceeded } from '@/core/payment/reconciliation';

/**
 * A unique violation as the Prisma client reports it.
 *
 * The client reports the model of the violation and its target: the list of
 * the columns of a schema level unique, or the name of the constraint of the
 * database. The engine of this deployment reports no target at all for a
 * violation of a schema level unique, so the model is often the only signal
 * of the conflict.
 */
function uniqueConflict(meta?: Record<string, unknown>, code = 'P2002'): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code, clientVersion: 'test', meta });
}

const paymentRow = {
  id: 'payment-1', orderId: 'order-1', status: 'PENDING', providerKey: 'provider-key-1', amount: 10, currency: 'USD',
  paymentMethod: 'card', paymentIntentId: null, providerEventId: null, sessionId: null, metadata: null,
  reviewResolution: null, claimToken: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.payment.findUnique.mockResolvedValue({ orderId: 'order-1' });
  prismaMock.payment.findUniqueOrThrow.mockResolvedValue(paymentRow);
  prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.paymentLedger.findUnique.mockResolvedValue(null);
  prismaMock.$queryRaw.mockResolvedValue([{ now: new Date() }]);
  // The transaction of the call hands its own client to the callback, like
  // the Prisma client does.
  prismaMock.$transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => run(prismaMock));
  orderServiceMock.applyPaymentSucceeded.mockResolvedValue({ refundRequired: false, refundReason: null });
  emitOrderPaidEventMock.mockResolvedValue({ userId: 'user-1' });
  emitEventMock.mockResolvedValue({});
});

it('accepts the capture keys of the payment ledger', () => {
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: ['providerKey', 'providerPaymentId'] }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: ['idempotencyKey'] }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: ['providerEventId'] }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: 'payment_ledger_providerKey_providerPaymentId_key' }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: 'payment_ledger_idempotencyKey_key' }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: 'payment_ledger_one_accepted_capture_per_order' }))).toBe(true);
});

it('accepts the dedup key of the outbox event', () => {
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'EventRecord', target: ['dedupKey'] }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'EventRecord', target: 'dedupKey' }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'EventRecord', target: 'event_records_dedupKey_key' }))).toBe(true);
});

it('falls back to the model of the violation when the engine reports no target', () => {
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: null }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'EventRecord', target: null }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger' }))).toBe(true);
});

it('reads the placeholder of an engine that does not report the target as an absent target', () => {
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: '(not available)' }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'EventRecord', target: '  (Not Available)  ' }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'User', target: '(not available)' }))).toBe(false);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: '' }))).toBe(true);
});

it('rejects a unique violation that is not an applied payment fact', () => {
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentObservation', target: ['source', 'evidenceHash'] }))).toBe(false);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'User', target: ['email'] }))).toBe(false);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'User', target: null }))).toBe(false);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentProviderAccount', target: 'payment_provider_accounts_namespace_merchantAccount_environment_key' }))).toBe(false);
  // Another model is never an applied fact, not even on a column that the
  // ledger uses for its own key.
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'Payment', target: ['idempotencyKey'] }))).toBe(false);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: ['someOtherColumn'] }))).toBe(false);
});

it('rejects a violation without a model that does not name a constraint', () => {
  expect(isAppliedPaymentFactConflict(uniqueConflict({ target: null }))).toBe(false);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ target: ['email'] }))).toBe(false);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ target: 'payment_observations_source_evidenceHash_key' }))).toBe(false);
  // Without a model only the name of an accepted constraint identifies the
  // conflict.
  expect(isAppliedPaymentFactConflict(uniqueConflict({ target: 'payment_ledger_idempotencyKey_key' }))).toBe(true);
  expect(isAppliedPaymentFactConflict(uniqueConflict({ target: 'event_records_dedupKey_key' }))).toBe(true);
});

it('rejects an error that is not a unique violation', () => {
  expect(isAppliedPaymentFactConflict(uniqueConflict({ modelName: 'PaymentLedger', target: ['providerKey', 'providerPaymentId'] }, 'P2025'))).toBe(false);
  expect(isAppliedPaymentFactConflict(new Error('Unique constraint failed'))).toBe(false);
  expect(isAppliedPaymentFactConflict(undefined)).toBe(false);
});

it('rethrows a unique violation of another model instead of reporting it as an applied payment fact', async () => {
  // The violation of a constraint that has nothing to do with the payment
  // ledger is not an applied fact: it must reach the caller, so the webhook
  // fails loudly and the provider retries. The baseline that converted every
  // unique violation into a false result resolves instead of rejecting.
  const conflict = uniqueConflict({ modelName: 'User', target: null });
  prismaMock.paymentLedger.create.mockRejectedValue(conflict);
  await expect(recordPaymentSucceeded({ paymentId: 'payment-1', providerEventId: 'event-1', providerPaymentId: 'capture-1' })).rejects.toBe(conflict);
});

it('reports a unique violation of the payment ledger as an applied payment fact', async () => {
  const conflict = uniqueConflict({ modelName: 'PaymentLedger', target: null });
  prismaMock.paymentLedger.create.mockRejectedValue(conflict);
  await expect(recordPaymentSucceeded({ paymentId: 'payment-1', providerEventId: 'event-1', providerPaymentId: 'capture-1' })).resolves.toBe(false);
});

it('propagates a unique violation inside a transaction of the caller', async () => {
  // The caller owns the transaction: the violation must not be converted
  // into a false result there, because the transaction of the caller would
  // stay aborted and its next statement would fail with "current
  // transaction is aborted".
  const conflict = uniqueConflict({ modelName: 'PaymentLedger', target: null });
  prismaMock.paymentLedger.create.mockRejectedValue(conflict);
  await expect(recordPaymentSucceeded({ paymentId: 'payment-1', providerEventId: 'event-1', providerPaymentId: 'capture-1' },
    prismaMock as unknown as NotificationTransaction)).rejects.toBe(conflict);
});

it('opens the transaction of a payment fact with the bounds of the payment path', async () => {
  prismaMock.paymentLedger.create.mockResolvedValue({ id: 'ledger-1' });
  await expect(recordPaymentSucceeded({ paymentId: 'payment-1', providerEventId: 'event-1', providerPaymentId: 'capture-1' })).resolves.toBe(true);
  expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function),
    expect.objectContaining({ maxWait: 10_000, timeout: 30_000 }));
});
