import { createHash } from 'node:crypto';
import { prisma } from '@/config/database';
import { SharedProtectionUnavailable } from '@/infra/shared-protection';
import { OrderStatus, PaymentStatus } from '@/core/order/types';
import { recordOrderStatusHistory } from '@/core/order/status-history';
import { assertOrderTransition } from '@/core/order/transition';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { emitOrderPaidEvent } from './order-paid-event';
import { emitEvent } from '@/infra/events/emit';
import { createNotification } from '@/core/notifications/service';
import { Prisma } from '@prisma/client';
import { ApiError } from '@/utils/api-errors';
import { lockOrder, lockPayment } from './locks';
import { paymentNow, PAYMENT_SESSION_LIFETIME_MS } from './clock';
import { claimPaymentReconciliations, paymentLeaseAllowsQuery, releasePaymentReconciliation, type PaymentLeaseClient } from './lease';
import { coreProcessIdentity } from '@/infra/core-process-identity';

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
const clearLease = { claimToken: null, claimedBy: null, leaseUntil: null };
export type RecordPaymentSucceededInput = {
  paymentId: string; providerEventId: string; paymentIntentId?: string | null;
  reason?: string; actorType?: string; actorId?: string; metadata?: Record<string, unknown>;
  manualReference?: string; claimToken?: string;
};

export async function recordUnknownPaymentSession(sessionId: string, provider = 'unknown', providerEventId = '', source = 'sync'): Promise<void> {
  const id = 'payment-review:' + createHash('sha256').update(JSON.stringify([provider, sessionId, providerEventId, source])).digest('hex');
  await prisma.adminAuditEvent.upsert({ where: { id }, update: {}, create: {
    id, actorId: provider, action: 'PAYMENT_SESSION_REVIEW_REQUIRED', targetType: 'payment-session', targetId: sessionId,
    summary: { reason: 'unknown-session', sessionId, provider, providerEventId, source },
  } });
}

export async function recordPaymentSucceeded(input: RecordPaymentSucceededInput): Promise<boolean> {
  const identity = await prisma.payment.findUnique({ where: { id: input.paymentId }, select: { orderId: true } });
  if (!identity) return false;
  const reference = input.manualReference?.trim();
  if (input.actorType === 'admin' && !reference) throw new ApiError('PAYMENT_REFERENCE_REQUIRED');
  try {
    return await prisma.$transaction(async tx => {
      await lockOrder(tx, identity.orderId); await lockPayment(tx, input.paymentId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: identity.orderId } });
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
      if (payment.status === 'SUCCEEDED' || input.claimToken && payment.claimToken !== input.claimToken) return false;
      if (await tx.paymentLedger.findUnique({ where: { providerEventId: input.providerEventId } })) return false;
      const firstPaid = order.status === OrderStatus.PENDING && order.paymentStatus !== PaymentStatus.PAID && order.paymentStatus !== PaymentStatus.REFUNDED;
      if (firstPaid) assertOrderTransition(order.status, OrderStatus.PROCESSING, order.paymentStatus);
      const refundRequired = !firstPaid;
      const refundReason = refundRequired ? order.status === OrderStatus.CANCELLED ? 'cancelled_order_payment' : 'additional_successful_payment' : null;
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: 'SUCCEEDED' }, ...(input.claimToken ? { claimToken: input.claimToken } : {}) },
        data: { status: 'SUCCEEDED', paymentIntentId: input.paymentIntentId || payment.paymentIntentId, providerEventId: input.providerEventId, ...clearLease },
      });
      if (!changed.count) return false;
      await tx.paymentLedger.create({ data: {
        paymentId: payment.id, orderId: order.id, eventType: 'SUCCEEDED', amount: payment.amount, currency: payment.currency,
        provider: payment.paymentMethod, providerEventId: input.providerEventId, metadata: input.metadata as Prisma.InputJsonValue | undefined,
        actorType: input.actorType || 'system', manualReference: reference, refundRequired, refundReason,
      } });
      let updatedOrder = order;
      if (firstPaid) updatedOrder = await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID } });
      else if (order.status === OrderStatus.CANCELLED && order.paymentStatus !== PaymentStatus.REFUNDED)
        updatedOrder = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.PAID } });
      await recordOrderStatusHistory(tx, {
        orderId: order.id, fromStatus: order.status, toStatus: updatedOrder.status,
        fromPaymentStatus: order.paymentStatus, toPaymentStatus: updatedOrder.paymentStatus,
        reason: refundRequired ? order.status === OrderStatus.CANCELLED ? 'refund_required_after_cancelled_order_payment' : 'refund_required_after_additional_payment'
          : input.reason || 'payment_succeeded', actorType: input.actorType || 'system', actorId: input.actorId,
        metadata: { ...input.metadata, ...(reference ? { manualReference: reference } : {}), refundRequired },
      });
      if (firstPaid) {
        const recipient = await tx.user.findUniqueOrThrow({ where: { id: order.userId }, select: { email: true } });
        await createNotification(tx, 'payment_received', order.userId, order.customerEmail || recipient.email, { orderId: order.id }, { relatedType: 'order', relatedId: order.id });
        await emitOrderPaidEvent(tx, order.id, {
          paymentId: payment.id, paymentMethod: payment.paymentMethod, paymentIntentId: input.paymentIntentId || payment.paymentIntentId,
          sessionId: payment.sessionId, providerEventId: input.providerEventId, metadata: (payment.metadata || {}) as Record<string, unknown>, actorId: input.actorId,
        });
        await emitEvent(tx, 'payment.succeeded', 1, payment.id, {
          paymentId: payment.id, orderId: order.id, userId: order.userId, amount: Number(payment.amount), currency: payment.currency, metadata: payment.metadata || {},
        }, { actorId: input.actorId });
      }
      return true;
    });
  } catch (error) { if (isUniqueConstraintError(error)) return false; throw error; }
}

export async function recordPaymentFailed(input: { paymentId: string; providerEventId: string; actorType?: string; actorId?: string; claimToken?: string }): Promise<boolean> {
  const identity = await prisma.payment.findUnique({ where: { id: input.paymentId }, select: { orderId: true } });
  if (!identity) return false;
  try {
    return await prisma.$transaction(async tx => {
      await lockOrder(tx, identity.orderId); await lockPayment(tx, input.paymentId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: identity.orderId } });
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
      if (['SUCCEEDED','FAILED','EXPIRED'].includes(payment.status) || input.claimToken && payment.claimToken !== input.claimToken) return false;
      if (await tx.paymentLedger.findUnique({ where: { providerEventId: input.providerEventId } })) return false;
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, status: { notIn: ['SUCCEEDED','FAILED','EXPIRED'] }, ...(input.claimToken ? { claimToken: input.claimToken } : {}) },
        data: { status: 'FAILED', providerEventId: input.providerEventId, ...clearLease },
      });
      if (!changed.count) return false;
      await tx.paymentLedger.create({ data: {
        paymentId: payment.id, orderId: order.id, eventType: 'FAILED', amount: payment.amount, currency: payment.currency,
        provider: payment.paymentMethod, providerEventId: input.providerEventId, actorType: input.actorType || 'system',
      } });
      if (order.paymentStatus !== PaymentStatus.PAID && order.paymentStatus !== PaymentStatus.REFUNDED) {
        const updated = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.FAILED } });
        await recordOrderStatusHistory(tx, {
          orderId: order.id, fromStatus: order.status, toStatus: updated.status, fromPaymentStatus: order.paymentStatus,
          toPaymentStatus: updated.paymentStatus, reason: 'payment_failed', actorType: input.actorType || 'system', actorId: input.actorId,
        });
      }
      await emitEvent(tx, 'payment.failed', 1, payment.id, { paymentId: payment.id, orderId: order.id, userId: order.userId, amount: Number(payment.amount), currency: payment.currency, metadata: payment.metadata || {} }, { actorId: input.actorId });
      return true;
    });
  } catch (error) { if (isUniqueConstraintError(error)) return false; throw error; }
}

export async function syncPaymentFromPlugin(sessionId: string, claimToken?: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({ where: { sessionId } });
  if (!payment) { await recordUnknownPaymentSession(sessionId); return false; }
  if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED' || claimToken && payment.claimToken !== claimToken) return false;
  let data: { status: string; providerEventId?: string };
  try { data = await callContract(payment.paymentMethod, 'payment', 1, 'getSessionStatus', { sessionId }) as typeof data; }
  catch (error) { if (error instanceof SharedProtectionUnavailable) throw error; return false; }
  const status = data.status;
  const providerEventId = data.providerEventId || sessionId;
  if (status === 'succeeded')
    return recordPaymentSucceeded({ paymentId: payment.id, providerEventId, claimToken });
  if (status === 'failed' || status === 'cancelled')
    return recordPaymentFailed({ paymentId: payment.id, providerEventId, claimToken });
  return false;
}

export type PaymentReconciliationOptions = { limit?: number; maxAgeMinutes?: number; minAgeMinutes?: number };
export type PaymentReconciliationResult = { scanned: number; updated: number; failed: number; skipped: number };
const client: PaymentLeaseClient = { query: async (sql, values = []) => ({ rows: await prisma.$queryRawUnsafe<any[]>(sql, ...values) }) };
export async function expireUnreturnedPaymentSession(paymentId: string, claimToken: string): Promise<boolean> {
  const identity = await prisma.payment.findUnique({ where: { id: paymentId }, select: { orderId: true } });
  if (!identity) return false;
  return prisma.$transaction(async tx => {
    await lockOrder(tx, identity.orderId); await lockPayment(tx, paymentId);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== 'CREATING' || payment.sessionId || payment.claimToken !== claimToken) return false;
    if ((await paymentNow(tx)).getTime() < payment.createdAt.getTime() + PAYMENT_SESSION_LIFETIME_MS) return false;
    return (await tx.payment.updateMany({
      where: { id: payment.id, status: 'CREATING', sessionId: null, claimToken },
      data: { status: 'EXPIRED', failureReason: 'session_creation_expired', ...clearLease },
    })).count === 1;
  });
}
export async function reconcilePendingPayments(options: PaymentReconciliationOptions = {}): Promise<PaymentReconciliationResult> {
  const payments = await prisma.$transaction(async tx => claimPaymentReconciliations({
    query: async (sql, values = []) => ({ rows: await tx.$queryRawUnsafe<any[]>(sql, ...values) }),
  }, coreProcessIdentity.instanceId, options));
  const result = { scanned: payments.length, updated: 0, failed: 0, skipped: 0 };
  let stopBatch = false;
  for (const payment of payments) {
    try {
      if (stopBatch || !await paymentLeaseAllowsQuery(client, payment)) { stopBatch = true; result.skipped++; continue; }
      if (payment.status === 'CREATING') {
        if (await expireUnreturnedPaymentSession(payment.id, payment.claimToken!)) result.updated++;
        continue;
      }
      const instance = await prisma.pluginInstallation.findUnique({ where: { pluginSlug_instanceKey: { pluginSlug: payment.paymentMethod, instanceKey: 'default' } }, include: { plugin: { select: { deletedAt: true } } } });
      if (instance && (!instance.enabled || instance.deletedAt || instance.plugin.deletedAt)) { result.skipped++; continue; }
      if (await syncPaymentFromPlugin(payment.sessionId!, payment.claimToken!)) result.updated++;
    } catch (error) { if (error instanceof SharedProtectionUnavailable) result.skipped++; else result.failed++; }
    finally { await releasePaymentReconciliation(client, payment, stopBatch ? 0 : 60_000); }
  }
  return result;
}
