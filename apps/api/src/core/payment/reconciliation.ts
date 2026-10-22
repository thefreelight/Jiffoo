import { prisma } from '@/config/database';
import { SharedProtectionUnavailable } from '@/infra/shared-protection';
import { OrderService } from '@/core/order/service';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { emitOrderPaidEvent } from './order-paid-event';
import { emitEvent } from '@/infra/events/emit';
import { type NotificationTransaction } from '@/core/notifications/service';
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
  manualReference?: string; claimToken?: string; reviewConfirmation?: boolean;
};


export async function recordPaymentSucceeded(input: RecordPaymentSucceededInput, transaction?: NotificationTransaction): Promise<boolean> {
  const identity = await (transaction || prisma).payment.findUnique({ where: { id: input.paymentId }, select: { orderId: true } });
  if (!identity) return false;
  const reference = input.manualReference?.trim();
  if (input.actorType === 'admin' && !reference) throw new ApiError('PAYMENT_REFERENCE_REQUIRED');
  try {
    const run = async (tx: NotificationTransaction) => {
      await lockOrder(tx, identity.orderId); await lockPayment(tx, input.paymentId);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
      if (input.reviewConfirmation && payment.status !== 'REQUIRES_REVIEW') throw new ApiError('PAYMENT_REVIEW_ALREADY_RESOLVED');
      if (input.claimToken && payment.claimToken !== input.claimToken) return false;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${payment.providerKey + ':' + input.providerPaymentId}, 0))::text`;
      const captured = await tx.paymentLedger.findUnique({ where: { providerKey_providerPaymentId: { providerKey: payment.providerKey, providerPaymentId: input.providerPaymentId } } });
      if (captured) {
        if (input.reviewConfirmation && captured.paymentId === payment.id) {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED', ...clearLease } });
          return true;
        }
        if (captured.paymentId !== payment.id) {
          if (input.reviewConfirmation) throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
          if (payment.reviewResolution) return false;
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'REQUIRES_REVIEW', failureReason: 'capture_already_bound', ...clearLease } });
          await tx.adminAuditEvent.create({ data: { actorId: input.actorId || 'system', action: 'PAYMENT_REVIEW_REQUIRED', targetType: 'payment', targetId: payment.id, summary: { reason: 'capture_already_bound', providerPaymentId: input.providerPaymentId } } });
        }
        return false;
      }
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, ...(input.claimToken ? { claimToken: input.claimToken } : {}) },
        data: { status: 'SUCCEEDED', paymentIntentId: input.paymentIntentId || payment.paymentIntentId, providerEventId: input.providerEventId, ...clearLease },
      });
      if (!changed.count) return false;
      // The order module owns the order state machine and records the outcome.
      const decision = await OrderService.applyPaymentSucceeded(tx, {
        orderId: identity.orderId,
        reason: input.reason,
        actorType: input.actorType || 'system',
        actorId: input.actorId,
        metadata: { ...input.metadata, ...(reference ? { manualReference: reference } : {}) },
      });
      if (payment.reviewResolution === 'NOT_CHARGED') {
        await tx.adminAuditEvent.create({ data: { actorId: 'system', action: 'PAYMENT_REVIEW_CONTRADICTED',
          targetType: 'payment', targetId: payment.id,
          summary: { paymentId: payment.id, orderId: identity.orderId, providerPaymentId: input.providerPaymentId,
            reviewReference: payment.reviewReference, refundRequired: decision.refundRequired },
        } });
      }
      await tx.paymentLedger.create({ data: {
        paymentId: payment.id, orderId: identity.orderId, eventType: 'SUCCEEDED', amount: payment.amount, currency: payment.currency,
        provider: payment.paymentMethod, providerEventId: input.providerEventId, metadata: input.metadata as Prisma.InputJsonValue | undefined,
        providerKey: payment.providerKey, providerPaymentId: input.providerPaymentId,
        actorType: input.actorType || 'system', manualReference: reference, refundRequired: decision.refundRequired,
        refundReason: decision.refundReason, createdAt: await paymentNow(tx),
      } });
      if (!decision.refundRequired) {
        const paid = await emitOrderPaidEvent(tx, identity.orderId, {
          paymentId: payment.id, paymentMethod: payment.paymentMethod, paymentIntentId: input.paymentIntentId || payment.paymentIntentId,
          sessionId: payment.sessionId, providerEventId: input.providerEventId, metadata: (payment.metadata || {}) as Record<string, unknown>, actorId: input.actorId,
        });
        await emitEvent(tx, 'payment.succeeded', 1, payment.id, {
          paymentId: payment.id, orderId: identity.orderId, userId: paid?.userId ?? '', amount: Number(payment.amount), currency: payment.currency, metadata: payment.metadata || {},
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
      const projection = await OrderService.getOrderProjection(tx, identity.orderId);
      if (!projection) throw new ApiError('NOT_FOUND');
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
      if (['SUCCEEDED','FAILED','CANCELLED','EXPIRED'].includes(payment.status) || input.claimToken && payment.claimToken !== input.claimToken) return false;
      if (await tx.paymentLedger.findFirst({ where: { paymentId: payment.id, providerEventId: input.providerEventId, eventType: 'FAILED' } })) return false;
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, status: { notIn: ['SUCCEEDED','FAILED','CANCELLED','EXPIRED'] }, ...(input.claimToken ? { claimToken: input.claimToken } : {}) },
        data: { status: 'FAILED', providerEventId: input.providerEventId, ...clearLease },
      });
      if (!changed.count) return false;
      await tx.paymentLedger.create({ data: {
        paymentId: payment.id, orderId: identity.orderId, eventType: 'FAILED', amount: payment.amount, currency: payment.currency,
        provider: payment.paymentMethod, providerEventId: input.providerEventId, actorType: input.actorType || 'system', createdAt: await paymentNow(tx),
      } });
      // The order module owns the order state machine and records the outcome.
      await OrderService.applyPaymentFailed(tx, {
        orderId: identity.orderId, actorType: input.actorType || 'system', actorId: input.actorId,
      });
      await emitEvent(tx, 'payment.failed', 1, payment.id, { paymentId: payment.id, orderId: identity.orderId, userId: projection.userId, amount: Number(payment.amount), currency: payment.currency, metadata: payment.metadata || {} }, { actorId: input.actorId });
      return true;
    };
    return transaction ? await run(transaction) : await prisma.$transaction(run);
  } catch (error) { if (isUniqueConstraintError(error)) return false; throw error; }
}


/**
 * Close a payment attempt that an administrator confirmed was not charged.
 * The payment module owns the payment table, so the resolution is applied here.
 */
export async function recordPaymentNotCharged(
  input: { paymentId: string; actorId: string; reference: string },
  transaction: NotificationTransaction,
): Promise<void> {
  await transaction.payment.update({ where: { id: input.paymentId }, data: {
    status: 'FAILED', failureReason: 'admin_confirmed_not_charged', reviewResolution: 'NOT_CHARGED',
    reviewResolvedAt: new Date(), reviewResolvedBy: input.actorId, reviewReference: input.reference,
    claimToken: null, claimedBy: null, leaseUntil: null,
  } });
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
