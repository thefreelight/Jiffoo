import { randomUUID } from 'node:crypto';
import { Prisma, type Payment } from '@prisma/client';
import { PLUGIN_CONTRACT_VERSIONS, type PaymentFact, type PaymentV2Output } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { ApiError, type ErrorCode } from '@/utils/api-errors';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { createNotification, type NotificationTransaction } from '@/core/notifications/service';
import { OrderService } from '@/core/order/service';
import { lockOrder, lockPayment } from '@/core/shared/locks';
import { paymentNow, PAYMENT_SESSION_LIFETIME_MS } from './clock';
import { decimalToMinor } from '@/core/shared/money';
import { observePaymentReservationForTest } from './session-test-control';
import { bindPaymentProviderAccount } from './provider-account';
import { observePaymentFact } from './observations';

type SessionInput = { orderId: string; userId: string; email: string; pluginSlug: string; idempotencyKey?: string; returnUrl: string; cancelUrl: string };

/**
 * The payment status to API error table.
 *
 * The table is built inside a function so the module keeps no container at
 * module scope. A new payment state is mapped by adding one entry here; a
 * state that is not in the table falls through to the missing session field
 * check of `response`.
 */
function paymentStatusErrorCodes(): Partial<Record<Payment['status'], ErrorCode>> {
  return {
    CANCELLED: 'ORDER_NOT_PAYABLE',
    UNKNOWN: 'PAYMENT_OUTCOME_UNKNOWN',
    REQUIRES_REVIEW: 'PAYMENT_REQUIRES_REVIEW',
    FAILED: 'PAYMENT_IDEMPOTENCY_CONFLICT',
    EXPIRED: 'PAYMENT_IDEMPOTENCY_CONFLICT',
  };
}

function response(payment: Payment) {
  const statusError = paymentStatusErrorCodes()[payment.status];
  if (statusError) throw new ApiError(statusError);
  if (!payment.sessionId || !payment.actionJson || !payment.expiresAt) throw new ApiError('PAYMENT_ATTEMPT_OPEN');
  const action = payment.actionJson as NonNullable<PaymentV2Output<'createSession'>['action']>;
  return { paymentId: payment.id, sessionId: payment.sessionId, url: payment.sessionUrl || undefined, action, expiresAt: payment.expiresAt.toISOString() };
}
/**
 * Record the order confirmation notification of a created payment session.
 *
 * The notification is written inside the payment transaction today; the event
 * driven variant (an emitted order event delivered by the core subscribers) is
 * the follow up. The arguments, the values and the dedup key stay the ones the
 * inline call used.
 */
async function recordOrderConfirmation(
  tx: NotificationTransaction,
  confirmation: { userId: string; toAddress: string; orderId: string; orderNumber: string; instructions: string },
) {
  await createNotification(tx, 'order_confirmation', confirmation.userId, confirmation.toAddress, {
    orderId: confirmation.orderNumber, instructions: confirmation.instructions,
  }, { relatedType: 'order', relatedId: confirmation.orderId, dedupKey: 'notification:order_confirmation:' + confirmation.orderId });
}

export async function createPaymentSession(input: SessionInput) {
  const orderIdentity = await prisma.order.findFirst({ where: { id: input.orderId, userId: input.userId }, select: { currency: true } });
  if (!orderIdentity) throw new ApiError('NOT_FOUND');
  const { account } = await bindPaymentProviderAccount(input.pluginSlug, orderIdentity.currency);
  const accountIdentity = { namespace: account.namespace, merchantAccount: account.merchantAccount, environment: account.environment as 'live' | 'test' };
  const requestKey = input.idempotencyKey?.trim() || randomUUID();
  const reservation = await prisma.$transaction(async tx => {
    await lockOrder(tx, input.orderId);
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order || order.userId !== input.userId) throw new ApiError('NOT_FOUND');
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED') throw new ApiError('ORDER_ALREADY_PAID');
    if (order.status !== 'PENDING') throw new ApiError('ORDER_NOT_PAYABLE');
    if (order.paymentMethod !== input.pluginSlug) throw new ApiError('PAYMENT_METHOD_MISMATCH');
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: requestKey } });
    if (existing) {
      if (existing.orderId !== order.id || existing.paymentMethod !== input.pluginSlug || existing.providerKey !== account.providerKey) throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
      if (existing.status === 'UNKNOWN') throw new ApiError('PAYMENT_OUTCOME_UNKNOWN');
      if (existing.status === 'REQUIRES_REVIEW') throw new ApiError('PAYMENT_REQUIRES_REVIEW');
      if (existing.status === 'CREATING') throw new ApiError('PAYMENT_ATTEMPT_OPEN');
      if (existing.status !== 'PENDING') throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
      return { payment: existing, order, owner: false };
    }
    const previous = await tx.payment.findFirst({ where: { orderId: order.id }, orderBy: { attemptNumber: 'desc' } });
    if (previous) {
      if (previous.status === 'UNKNOWN') throw new ApiError('PAYMENT_OUTCOME_UNKNOWN');
      if (previous.status === 'REQUIRES_REVIEW') throw new ApiError('PAYMENT_REQUIRES_REVIEW');
      if (previous.status === 'CREATING') throw new ApiError('PAYMENT_ATTEMPT_OPEN');
      const adminClosed = previous.status === 'FAILED' && previous.reviewResolution === 'NOT_CHARGED';
      if ((!previous.closureObservationId || !previous.closedAt) && !adminClosed) throw new ApiError('PAYMENT_SESSION_STILL_CHARGEABLE');
      if (previous.status === 'PENDING') throw new ApiError('PAYMENT_ATTEMPT_OPEN');
    }
    const now = await paymentNow(tx), attemptNumber = order.paymentAttempts + 1;
    const payment = await tx.payment.create({ data: {
      orderId: order.id, attemptNumber, paymentMethod: input.pluginSlug, providerKey: account.providerKey, amount: order.totalAmount, currency: order.currency,
      status: 'CREATING', idempotencyKey: requestKey, createdAt: now, nextReconcileAt: new Date(now.getTime() + 60_000),
      expiresAt: new Date(now.getTime() + PAYMENT_SESSION_LIFETIME_MS),
    } });
    await tx.paymentLedger.create({ data: { paymentId: payment.id, orderId: order.id, eventType: 'CREATED', amount: payment.amount, currency: payment.currency, provider: payment.paymentMethod, idempotencyKey: requestKey, createdAt: now } });
    await OrderService.recordPaymentAttempt(tx, { orderId: order.id, attemptNumber, at: now, method: input.pluginSlug });
    return { payment, order, owner: true };
  });
  if (!reservation.owner) return response(reservation.payment);
  await observePaymentReservationForTest(reservation.payment.id);
  let fact: PaymentFact;
  try {
    fact = await callContract(input.pluginSlug, 'payment', PLUGIN_CONTRACT_VERSIONS.payment, 'createSession', {
      orderId: reservation.order.id, amountMinor: decimalToMinor(reservation.payment.amount.toString(), reservation.payment.currency), currency: reservation.payment.currency,
      account: accountIdentity, customer: { id: input.userId, email: input.email }, returnUrl: input.returnUrl, cancelUrl: input.cancelUrl, idempotencyKey: requestKey,
    }) as PaymentFact;
  } catch {
    await prisma.$transaction(async tx => {
      await lockOrder(tx, input.orderId); await lockPayment(tx, reservation.payment.id);
      await tx.payment.updateMany({ where: { id: reservation.payment.id, status: 'CREATING' }, data: {
        status: 'UNKNOWN', failureReason: 'creation_outcome_unknown', claimToken: null, claimedBy: null, leaseUntil: null,
      } });
    });
    throw new ApiError('PAYMENT_OUTCOME_UNKNOWN');
  }
  await observePaymentFact(input.pluginSlug, fact, 'creation', undefined, reservation.payment.id);
  const payment = await prisma.$transaction(async tx => {
    await lockOrder(tx, input.orderId); await lockPayment(tx, reservation.payment.id);
    const current = await tx.payment.findUniqueOrThrow({ where: { id: reservation.payment.id } });
    if (current.status === 'CREATING') {
      await tx.payment.update({ where: { id: current.id }, data: { status: 'REQUIRES_REVIEW', failureReason: 'creation_fact_mismatch' } });
      throw new ApiError('PAYMENT_REQUIRES_REVIEW');
    }
    if (current.sessionId && current.actionJson) await recordOrderConfirmation(tx, {
      userId: input.userId, toAddress: reservation.order.customerEmail || input.email,
      orderId: input.orderId, orderNumber: reservation.order.orderNumber,
      instructions: fact.action?.type === 'instructions' ? fact.action.text : '',
    });
    return current;
  });
  return response(payment);
}
