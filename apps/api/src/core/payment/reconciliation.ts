import { prisma } from '@/config/database';
import { SharedProtectionUnavailable } from '@/infra/shared-protection';
import { OrderStatus, PaymentStatus } from '@/core/order/types';
import { recordOrderStatusHistory } from '@/core/order/status-history';
import { assertOrderTransition } from '@/core/order/transition';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { emitOrderPaidEvent } from './order-paid-event';
import { emitEvent } from '@/infra/events/emit';
import { createNotification, type NotificationTransaction } from '@/core/notifications/service';
import { Prisma } from '@prisma/client';
import { ApiError } from '@/utils/api-errors';
import { lockOrder, lockPayment } from './locks';
import { paymentNow, PAYMENT_SESSION_LIFETIME_MS } from './clock';
import { decimalToMinor } from './minor-units';
import { claimPaymentReconciliations, paymentLeaseAllowsQuery, releasePaymentReconciliation, type PaymentLeaseClient } from './lease';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import type { PaymentFact } from '@jiffoo/shared';
import { observePaymentFact } from './observations';

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
const clearLease = { claimToken: null, claimedBy: null, leaseUntil: null };
export type RecordPaymentSucceededInput = {
  paymentId: string; providerEventId: string; paymentIntentId?: string | null;
  providerPaymentId: string;
  reason?: string; actorType?: string; actorId?: string; metadata?: Record<string, unknown>;
  manualReference?: string; claimToken?: string;
};


export async function recordPaymentSucceeded(input: RecordPaymentSucceededInput, transaction?: NotificationTransaction): Promise<boolean> {
  const identity = await (transaction || prisma).payment.findUnique({ where: { id: input.paymentId }, select: { orderId: true } });
  if (!identity) return false;
  const reference = input.manualReference?.trim();
  if (input.actorType === 'admin' && !reference) throw new ApiError('PAYMENT_REFERENCE_REQUIRED');
  try {
    const run = async (tx: NotificationTransaction) => {
      await lockOrder(tx, identity.orderId); await lockPayment(tx, input.paymentId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: identity.orderId } });
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
      if (input.claimToken && payment.claimToken !== input.claimToken) return false;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${payment.providerKey + ':' + input.providerPaymentId}, 0))::text`;
      const captured = await tx.paymentLedger.findUnique({ where: { providerKey_providerPaymentId: { providerKey: payment.providerKey, providerPaymentId: input.providerPaymentId } } });
      if (captured) {
        if (captured.paymentId !== payment.id) {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'REQUIRES_REVIEW', failureReason: 'capture_already_bound', ...clearLease } });
          await tx.adminAuditEvent.create({ data: { actorId: input.actorId || 'system', action: 'PAYMENT_REVIEW_REQUIRED', targetType: 'payment', targetId: payment.id, summary: { reason: 'capture_already_bound', providerPaymentId: input.providerPaymentId } } });
        }
        return false;
      }
      const firstPaid = order.status === OrderStatus.PENDING && order.paymentStatus !== PaymentStatus.PAID && order.paymentStatus !== PaymentStatus.REFUNDED;
      if (firstPaid) assertOrderTransition(order.status, OrderStatus.PROCESSING, order.paymentStatus);
      const refundRequired = !firstPaid;
      const refundReason = refundRequired ? order.status === OrderStatus.CANCELLED ? 'cancelled_order_payment' : 'additional_successful_payment' : null;
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, ...(input.claimToken ? { claimToken: input.claimToken } : {}) },
        data: { status: 'SUCCEEDED', paymentIntentId: input.paymentIntentId || payment.paymentIntentId, providerEventId: input.providerEventId, ...clearLease },
      });
      if (!changed.count) return false;
      await tx.paymentLedger.create({ data: {
        paymentId: payment.id, orderId: order.id, eventType: 'SUCCEEDED', amount: payment.amount, currency: payment.currency,
        provider: payment.paymentMethod, providerEventId: input.providerEventId, metadata: input.metadata as Prisma.InputJsonValue | undefined,
        providerKey: payment.providerKey, providerPaymentId: input.providerPaymentId,
        actorType: input.actorType || 'system', manualReference: reference, refundRequired, refundReason, createdAt: await paymentNow(tx),
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
    };
    return transaction ? await run(transaction) : await prisma.$transaction(run);
  } catch (error) { if (isUniqueConstraintError(error)) return false; throw error; }
}

export async function recordPaymentFailed(input: { paymentId: string; providerEventId: string; actorType?: string; actorId?: string; claimToken?: string }, transaction?: NotificationTransaction): Promise<boolean> {
  const identity = await (transaction || prisma).payment.findUnique({ where: { id: input.paymentId }, select: { orderId: true } });
  if (!identity) return false;
  try {
    const run = async (tx: NotificationTransaction) => {
      await lockOrder(tx, identity.orderId); await lockPayment(tx, input.paymentId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: identity.orderId } });
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
      if (['SUCCEEDED','FAILED','CANCELLED','EXPIRED'].includes(payment.status) || input.claimToken && payment.claimToken !== input.claimToken) return false;
      if (await tx.paymentLedger.findFirst({ where: { paymentId: payment.id, providerEventId: input.providerEventId, eventType: 'FAILED' } })) return false;
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, status: { notIn: ['SUCCEEDED','FAILED','CANCELLED','EXPIRED'] }, ...(input.claimToken ? { claimToken: input.claimToken } : {}) },
        data: { status: 'FAILED', providerEventId: input.providerEventId, ...clearLease },
      });
      if (!changed.count) return false;
      await tx.paymentLedger.create({ data: {
        paymentId: payment.id, orderId: order.id, eventType: 'FAILED', amount: payment.amount, currency: payment.currency,
        provider: payment.paymentMethod, providerEventId: input.providerEventId, actorType: input.actorType || 'system', createdAt: await paymentNow(tx),
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
    };
    return transaction ? await run(transaction) : await prisma.$transaction(run);
  } catch (error) { if (isUniqueConstraintError(error)) return false; throw error; }
}


export async function queryPaymentByRequestKey(paymentId: string, claimToken?: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { providerAccount: true } });
  if (!payment || claimToken && payment.claimToken !== claimToken) return false;
  const account = { namespace: payment.providerAccount.namespace, merchantAccount: payment.providerAccount.merchantAccount,
    environment: payment.providerAccount.environment as 'live' | 'test' };
  const captures = await prisma.paymentLedger.findMany({ where: { paymentId, eventType: 'SUCCEEDED' } });
  const fact = await callContract(payment.paymentMethod, 'payment', 2, 'queryByRequestKey', { requestKey: payment.idempotencyKey!, account,
    request: { orderId: payment.orderId, amountMinor: decimalToMinor(payment.amount.toString(), payment.currency), currency: payment.currency,
      createdAt: payment.createdAt.toISOString(), expiresAt: new Date(payment.createdAt.getTime() + PAYMENT_SESSION_LIFETIME_MS).toISOString(),
      knownCaptures: captures.map(capture => ({ account, requestKey: payment.idempotencyKey!, sessionId: payment.sessionId!, providerPaymentId: capture.providerPaymentId!,
        amountMinor: decimalToMinor(capture.amount.toString(), capture.currency), currency: capture.currency, observedAt: capture.createdAt.toISOString() })),
    },
  }) as PaymentFact;
  return observePaymentFact(payment.paymentMethod, fact, 'query', claimToken, payment.id);
}

export type PaymentReconciliationOptions = { limit?: number; minAgeMinutes?: number };
export type PaymentReconciliationResult = { scanned: number; updated: number; failed: number; skipped: number };
const client: PaymentLeaseClient = { query: async (sql, values = []) => ({ rows: await prisma.$queryRawUnsafe<any[]>(sql, ...values) }) };
export const PAYMENT_RECONCILIATION_MAX_ATTEMPTS = 10;
export async function reconcilePendingPayments(options: PaymentReconciliationOptions = {}): Promise<PaymentReconciliationResult> {
  const payments = await prisma.$transaction(async tx => claimPaymentReconciliations({
    query: async (sql, values = []) => ({ rows: await tx.$queryRawUnsafe<any[]>(sql, ...values) }),
  }, coreProcessIdentity.instanceId, options));
  const result = { scanned: payments.length, updated: 0, failed: 0, skipped: 0 };
  let stopBatch = false;
  for (const payment of payments) {
    try {
      if (stopBatch || !await paymentLeaseAllowsQuery(client, payment)) { stopBatch = true; result.skipped++; continue; }
      const instance = await prisma.pluginInstallation.findUnique({ where: { pluginSlug_instanceKey: { pluginSlug: payment.paymentMethod, instanceKey: 'default' } }, include: { plugin: { select: { deletedAt: true } } } });
      if (instance && (!instance.enabled || instance.deletedAt || instance.plugin.deletedAt)) { result.skipped++; continue; }
      if (await queryPaymentByRequestKey(payment.id, payment.claimToken!)) result.updated++;
    } catch (error) {
      if (error instanceof SharedProtectionUnavailable) result.skipped++; else result.failed++;
      if (!(error instanceof SharedProtectionUnavailable)) await prisma.$transaction(async tx => {
        await lockOrder(tx, payment.orderId); await lockPayment(tx, payment.id);
        const changed = await tx.payment.updateMany({ where: { id: payment.id, claimToken: payment.claimToken,
          status: { in: ['CREATING', 'PENDING', 'UNKNOWN', 'SUCCEEDED', 'CANCELLED'] } }, data: {
          status: payment.attempts >= PAYMENT_RECONCILIATION_MAX_ATTEMPTS ? 'REQUIRES_REVIEW'
            : payment.status === 'SUCCEEDED' || payment.status === 'CANCELLED' ? payment.status : 'UNKNOWN', ...clearLease,
          nextReconcileAt: new Date((await paymentNow(tx)).getTime() + 60_000), failureReason: 'request_query_unavailable',
        } });
        if (changed.count && payment.attempts >= PAYMENT_RECONCILIATION_MAX_ATTEMPTS) await tx.adminAuditEvent.create({ data: {
          actorId: 'system', action: 'PAYMENT_REVIEW_REQUIRED', targetType: 'payment', targetId: payment.id, summary: { reason: 'query_budget_exhausted' },
        } });
      });
    }
    finally { await releasePaymentReconciliation(client, payment, stopBatch ? 0 : 60_000); }
  }
  return result;
}
