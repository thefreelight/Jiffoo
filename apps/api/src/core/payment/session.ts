import { randomUUID } from 'node:crypto';
import { Prisma, type Payment } from '@prisma/client';
import type { PaymentFact, PaymentV2Output } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { createNotification } from '@/core/notifications/service';
import { lockOrder, lockPayment } from './locks';
import { paymentNow, PAYMENT_SESSION_LIFETIME_MS } from './clock';
import { decimalToMinor } from './minor-units';
import { observePaymentReservationForTest } from './session-test-control';
import { bindPaymentProviderAccount } from './provider-account';
import { observePaymentFact } from './observations';

type SessionInput = { orderId: string; userId: string; email: string; pluginSlug: string; idempotencyKey?: string; returnUrl: string; cancelUrl: string };
function response(payment: Payment) {
  if (payment.status === 'CANCELLED') throw new ApiError('ORDER_NOT_PAYABLE');
  if (payment.status === 'UNKNOWN') throw new ApiError('PAYMENT_OUTCOME_UNKNOWN');
  if (payment.status === 'REQUIRES_REVIEW') throw new ApiError('PAYMENT_REQUIRES_REVIEW');
  if (payment.status === 'FAILED' || payment.status === 'EXPIRED') throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
  if (!payment.sessionId || !payment.actionJson || !payment.expiresAt) throw new ApiError('PAYMENT_ATTEMPT_OPEN');
  const action = payment.actionJson as NonNullable<PaymentV2Output<'createSession'>['action']>;
  return { paymentId: payment.id, sessionId: payment.sessionId, url: payment.sessionUrl || undefined, action, expiresAt: payment.expiresAt.toISOString() };
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
    await tx.order.update({ where: { id: order.id }, data: { paymentAttempts: attemptNumber, lastPaymentAttemptAt: now, lastPaymentMethod: input.pluginSlug } });
    return { payment, order, owner: true };
  });
  if (!reservation.owner) return response(reservation.payment);
  await observePaymentReservationForTest(reservation.payment.id);
  let fact: PaymentFact;
  try {
    fact = await callContract(input.pluginSlug, 'payment', 2, 'createSession', {
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
    if (current.sessionId && current.actionJson) await createNotification(tx, 'order_confirmation', input.userId, reservation.order.customerEmail || input.email, {
      orderId: input.orderId, instructions: fact.action?.type === 'instructions' ? fact.action.text : '',
    }, { relatedType: 'order', relatedId: input.orderId, dedupKey: 'notification:order_confirmation:' + input.orderId });
    return current;
  });
  return response(payment);
}
