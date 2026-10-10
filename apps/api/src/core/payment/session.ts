import { randomUUID } from 'node:crypto';
import { Prisma, type Payment } from '@prisma/client';
import type { PaymentV1Output } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { createNotification } from '@/core/notifications/service';
import { lockOrder, lockPayment } from './locks';
import { paymentNow, PAYMENT_SESSION_LIFETIME_MS } from './clock';
import { decimalToMinor } from './minor-units';
import { observePaymentReservationForTest } from './session-test-control';

type SessionInput = { orderId: string; userId: string; email: string; pluginSlug: string; idempotencyKey?: string; returnUrl: string; cancelUrl: string };
function response(payment: Payment) {
  if (!payment.sessionId || !payment.actionJson || !payment.expiresAt) throw new ApiError('PAYMENT_ATTEMPT_OPEN');
  const action = payment.actionJson as PaymentV1Output<'createSession'>['action'];
  return { sessionId: payment.sessionId, url: payment.sessionUrl || undefined, action, expiresAt: payment.expiresAt.toISOString() };
}
export async function createPaymentSession(input: SessionInput) {
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
      if (existing.orderId !== order.id || existing.paymentMethod !== input.pluginSlug) throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
      if (existing.status === 'CREATING') throw new ApiError('PAYMENT_ATTEMPT_OPEN');
      if (existing.status !== 'PENDING') throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT', { creationExpired: existing.status === 'EXPIRED' && !existing.sessionId });
      return { payment: existing, order, owner: false };
    }
    if (await tx.payment.findFirst({ where: { orderId: order.id, status: { in: ['CREATING','PENDING'] } } })) throw new ApiError('PAYMENT_ATTEMPT_OPEN');
    const now = await paymentNow(tx), attemptNumber = order.paymentAttempts + 1;
    const payment = await tx.payment.create({ data: {
      orderId: order.id, attemptNumber, paymentMethod: input.pluginSlug, amount: order.totalAmount, currency: order.currency,
      status: 'CREATING', idempotencyKey: requestKey, createdAt: now, nextReconcileAt: now,
      expiresAt: new Date(now.getTime() + PAYMENT_SESSION_LIFETIME_MS),
    } });
    await tx.paymentLedger.create({ data: { paymentId: payment.id, orderId: order.id, eventType: 'CREATED', amount: payment.amount, currency: payment.currency, provider: payment.paymentMethod, idempotencyKey: requestKey } });
    await tx.order.update({ where: { id: order.id }, data: { paymentAttempts: attemptNumber, lastPaymentAttemptAt: now, lastPaymentMethod: input.pluginSlug } });
    return { payment, order, owner: true };
  });
  if (!reservation.owner) return response(reservation.payment);
  await observePaymentReservationForTest(reservation.payment.id);
  // The reservation and request key are durable before any external side effect.
  const session = await callContract(input.pluginSlug, 'payment', 1, 'createSession', {
    orderId: reservation.order.id, amountMinor: decimalToMinor(reservation.payment.amount.toString(), reservation.payment.currency), currency: reservation.payment.currency,
    customer: { id: input.userId, email: input.email }, returnUrl: input.returnUrl, cancelUrl: input.cancelUrl, idempotencyKey: requestKey,
  }) as PaymentV1Output<'createSession'>;
  const payment = await prisma.$transaction(async tx => {
    await lockOrder(tx, input.orderId); await lockPayment(tx, reservation.payment.id);
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
    const current = await tx.payment.findUniqueOrThrow({ where: { id: reservation.payment.id } });
    if (order.status !== 'PENDING' || order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED') throw new ApiError('ORDER_NOT_PAYABLE');
    if (current.status !== 'CREATING') throw new ApiError('PAYMENT_ATTEMPT_OPEN');
    const changed = await tx.payment.updateMany({ where: { id: current.id, status: 'CREATING' }, data: {
      status: 'PENDING', sessionId: session.sessionId, sessionUrl: session.action.type === 'redirect' ? session.action.url : null,
      actionJson: session.action as Prisma.InputJsonValue, claimToken: null, claimedBy: null, leaseUntil: null,
    } });
    if (!changed.count) throw new ApiError('PAYMENT_ATTEMPT_OPEN');
    await createNotification(tx, 'order_confirmation', order.userId, order.customerEmail || input.email, {
      orderId: order.id, instructions: session.action.type === 'instructions' ? session.action.text : '',
    }, { relatedType: 'order', relatedId: order.id, dedupKey: `notification:order_confirmation:${order.id}` });
    return tx.payment.findUniqueOrThrow({ where: { id: current.id } });
  });
  return response(payment);
}
