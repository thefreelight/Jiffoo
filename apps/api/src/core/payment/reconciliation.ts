import { prisma } from '@/config/database';
import { SharedProtectionUnavailable } from '@/infra/shared-protection';
import { OrderService } from '@/core/order/service';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { getDefaultInstallationRowWithPackage } from '@/core/extensions/registry';
import { emitOrderPaidEvent } from './order-paid-event';
import { emitEvent } from '@/infra/events/emit';
import { type NotificationTransaction } from '@/core/notifications/service';
import { Prisma } from '@prisma/client';
import { PLUGIN_CONTRACT_VERSIONS } from '@jiffoo/shared';
import { ApiError } from '@/utils/api-errors';
import { lockOrder, lockPayment } from '@/core/shared/locks';
import { paymentNow, PAYMENT_SESSION_LIFETIME_MS } from './clock';
import { decimalToMinor } from '@/core/shared/money';
import { AuditService } from '@/core/audit/service';
import { claimPaymentReconciliations, paymentLeaseAllowsQuery, releasePaymentReconciliation, type PaymentLeaseClient } from './lease';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import type { PaymentFact } from '@jiffoo/shared';
import { observePaymentFact } from './observations';

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * The unique constraints of the payment ledger.
 *
 * The fields are the columns of a schema level unique, the index names are
 * the names of the constraints of the database. The names of the indexes that
 * the migrations of the payment convergence dropped
 * (`payment_ledger_providerEventId_key`,
 * `payment_ledger_one_success_per_payment`) stay in the list: a deployment
 * that still carries them reports a replayed capture with them.
 */
const PAYMENT_LEDGER_UNIQUE_FIELDS = new Set(['providerKey', 'providerPaymentId', 'idempotencyKey', 'providerEventId']);
const PAYMENT_LEDGER_UNIQUE_INDEXES = new Set([
  'payment_ledger_providerKey_providerPaymentId_key',
  'payment_ledger_idempotencyKey_key',
  'payment_ledger_providerEventId_key',
  'payment_ledger_one_success_per_payment',
  'payment_ledger_one_accepted_capture_per_order',
]);

/**
 * The unique constraints of the outbox event that the same transaction writes.
 */
const EVENT_RECORD_UNIQUE_FIELDS = new Set(['dedupKey']);
const EVENT_RECORD_UNIQUE_INDEXES = new Set(['event_records_dedupKey_key']);

/**
 * The models that record a payment fact. A unique violation of any other
 * model is a defect of another domain and is never an applied fact.
 */
const APPLIED_PAYMENT_FACT_MODELS = new Set(['PaymentLedger', 'EventRecord']);

/**
 * The union of the index names, for a violation that does not name its model.
 */
const APPLIED_PAYMENT_FACT_UNIQUE_INDEXES = new Set([...PAYMENT_LEDGER_UNIQUE_INDEXES, ...EVENT_RECORD_UNIQUE_INDEXES]);

/**
 * The placeholder that the engine reports instead of the target of a
 * violation. It is not a name of a constraint, so it is read as an absent
 * target.
 */
const UNAVAILABLE_UNIQUE_TARGET = '(not available)';

/**
 * The names of the target of a unique violation.
 *
 * The target is the list of the columns of a schema level unique, or the name
 * of the constraint of the database. An absent target - a missing value, an
 * empty name or the placeholder of an engine that does not report the target
 * - yields no names at all, so the caller falls back to the model of the
 * violation.
 */
function uniqueTargetNames(target: unknown): string[] {
  const raw = Array.isArray(target) ? target : [target];
  const names = raw
    .filter((name): name is string => typeof name === 'string')
    .map(name => name.trim())
    .filter(name => name.length > 0);
  if (names.some(name => name.toLowerCase() === UNAVAILABLE_UNIQUE_TARGET)) return [];
  return names;
}

/**
 * True when the unique violation of the transaction means that the payment
 * fact was already applied by an earlier transaction.
 *
 * Only the unique conflicts that really mean "this payment fact was already
 * applied" are converted into a false result: the capture keys of the payment
 * ledger and the dedup key of the outbox event. Every other unique violation
 * is a defect - a new constraint, another outbox row, a future index - and it
 * is rethrown unchanged, so the webhook fails loudly and the provider retries
 * instead of the payment being reported as applied while nothing was
 * recorded.
 *
 * The model of the violation scopes the target: a violation of the payment
 * ledger is accepted only when it names a column or an index of the ledger, a
 * violation of the outbox only when it names the dedup key, and a violation
 * of every other model is rejected, not even when it names a column that the
 * ledger uses for its own key. Without a model only the name of a constraint
 * identifies the conflict.
 *
 * The engine of this deployment reports no target at all for a violation of a
 * schema level unique, so the model of the violation is the only signal that
 * is left on that path, and only the two models that record a payment fact
 * are accepted there.
 *
 * A violation of the payment ledger without a target is ambiguous: the
 * constraint that fired cannot be told apart from the capture keys of the
 * ledger. The caller decides that case explicitly with the semantic
 * re-check, which asks the ledger itself.
 *
 * The check stays outside the transaction callback: a failed statement aborts
 * the PostgreSQL transaction, so the violation can only be classified after
 * the transaction rolled back.
 */
export function isAppliedPaymentFactConflict(error: unknown): boolean {
  if (!isUniqueConstraintError(error)) return false;
  const meta = (error.meta ?? {}) as { modelName?: unknown; target?: unknown };
  const model = typeof meta.modelName === 'string' ? meta.modelName : null;
  const names = uniqueTargetNames(meta.target);
  if (!names.length) {
    // Without a target the model of the violation is the only signal that is
    // left, and only the two models that record a payment fact are accepted.
    return model !== null && APPLIED_PAYMENT_FACT_MODELS.has(model);
  }
  if (model === 'PaymentLedger') return names.every(name => PAYMENT_LEDGER_UNIQUE_FIELDS.has(name) || PAYMENT_LEDGER_UNIQUE_INDEXES.has(name));
  if (model === 'EventRecord') return names.every(name => EVENT_RECORD_UNIQUE_FIELDS.has(name) || EVENT_RECORD_UNIQUE_INDEXES.has(name));
  // A violation of another model is never an applied payment fact, not even
  // when it names a column that the ledger uses for its own key.
  if (model !== null) return false;
  // Without a model only the name of a constraint identifies the conflict.
  return names.every(name => APPLIED_PAYMENT_FACT_UNIQUE_INDEXES.has(name));
}

/**
 * True when the unique violation of the payment ledger is ambiguous.
 *
 * The engine of this deployment reports no target for a unique violation, so
 * the constraint that fired cannot be told apart from the capture keys of the
 * ledger: it may be the capture key of this capture, the partial index that
 * keeps one accepted capture per order, or any other constraint of the
 * ledger. The ledger itself decides that case, with the semantic re-check.
 *
 * A violation with a target is not ambiguous: the target names the
 * constraint, and the classification of the violation is the existing one.
 */
export function isAmbiguousLedgerConflict(error: unknown): boolean {
  if (!isUniqueConstraintError(error)) return false;
  const meta = (error.meta ?? {}) as { modelName?: unknown; target?: unknown };
  if (meta.modelName !== 'PaymentLedger') return false;
  return uniqueTargetNames(meta.target).length === 0;
}

/**
 * The semantic re-check of an ambiguous unique violation of the payment
 * ledger.
 *
 * The ledger decides the case outside the transaction, because the
 * transaction rolled back before the violation was classified:
 * - a row for this capture - the provider key of the payment and the
 *   provider payment id of the capture - means that the capture was already
 *   recorded, so the fact was already applied;
 * - an accepted capture of the same order - event type SUCCEEDED and no
 *   refund required - means that the order is already paid and the fact is
 *   not applicable to it any more.
 *
 * A violation of any other constraint says nothing about the payment fact,
 * so the caller rethrows it and the provider retries. A failed lookup is no
 * decision either: the caller rethrows the original violation.
 *
 * The provider key of the payment and its order id are read from the payment
 * row here, after the rollback: the values of the aborted transaction are
 * not the state of the database.
 */
async function isPaymentFactAlreadyApplied(paymentId: string, providerPaymentId?: string | null): Promise<boolean> {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { providerKey: true, orderId: true } });
    if (!payment) return false;
    if (providerPaymentId) {
      const capture = await prisma.paymentLedger.findFirst({ where: { providerKey: payment.providerKey, providerPaymentId, eventType: 'SUCCEEDED' } });
      if (capture) return true;
    }
    const accepted = await prisma.paymentLedger.findFirst({ where: { orderId: payment.orderId, eventType: 'SUCCEEDED', refundRequired: false } });
    return !!accepted;
  } catch {
    // The lookup failed, so the violation cannot be classified: the caller
    // rethrows the original violation.
    return false;
  }
}
const clearLease = { claimToken: null, claimedBy: null, leaseUntil: null };
/**
 * The bounds of the transactions of the payment path.
 *
 * The default bounds of Prisma are too small for a payment fact: the
 * transaction takes the advisory locks of the order and of the payment,
 * reads the capture of the provider and writes the ledger, the outbox and
 * the order state machine. The explicit bounds are the ones the payment
 * webhook uses for the same reason.
 */
const PAYMENT_TRANSACTION_MAX_WAIT_MS = 10_000;
const PAYMENT_TRANSACTION_TIMEOUT_MS = 30_000;
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
          await AuditService.write(tx, { actorId: input.actorId || 'system', action: 'PAYMENT_REVIEW_REQUIRED', targetType: 'payment', targetId: payment.id, summary: { reason: 'capture_already_bound', providerPaymentId: input.providerPaymentId } });
        }
        return false;
      }
      // The payment row keeps the forensic evidence of the capture that was
      // accepted. A payment that is already SUCCEEDED is never given the
      // event id of another capture, and a payment that already carries a
      // payment intent keeps it: a second, genuinely different capture is
      // recorded in the ledger and flagged for a refund, but it never
      // overwrites the evidence of the first capture. A payment that is not
      // SUCCEEDED yet takes the event id of the capture, so a late capture
      // still moves a CANCELLED or EXPIRED payment to SUCCEEDED.
      const alreadyCaptured = payment.status === 'SUCCEEDED';
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, ...(input.claimToken ? { claimToken: input.claimToken } : {}) },
        data: {
          status: 'SUCCEEDED',
          paymentIntentId: alreadyCaptured && payment.paymentIntentId ? payment.paymentIntentId : input.paymentIntentId || payment.paymentIntentId,
          providerEventId: alreadyCaptured ? payment.providerEventId : input.providerEventId,
          ...clearLease,
        },
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
        await AuditService.write(tx, { actorId: 'system', action: 'PAYMENT_REVIEW_CONTRADICTED',
          targetType: 'payment', targetId: payment.id,
          summary: { paymentId: payment.id, orderId: identity.orderId, providerPaymentId: input.providerPaymentId,
            reviewReference: payment.reviewReference, refundRequired: decision.refundRequired },
        });
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
        // A paid order always has an order row; a missing one is a real error and
        // must not degrade into a payload without a user.
        if (!paid) throw new ApiError('NOT_FOUND');
        await emitEvent(tx, 'payment.succeeded', 1, payment.id, {
          paymentId: payment.id, orderId: identity.orderId, userId: paid.userId, amount: Number(payment.amount), currency: payment.currency, metadata: payment.metadata || {},
        }, { actorId: input.actorId });
      }
      return true;
    };
    // The caller keeps the ownership of its transaction: a unique violation
    // is not classified inside it, because catching it there would leave
    // that transaction aborted and its next statement would fail with
    // "current transaction is aborted". The violation propagates, the
    // transaction of the caller rolls back cleanly and the provider retries.
    if (transaction) return await run(transaction);
    // The transaction of this call owns its failure: it rolled back cleanly,
    // so the violation is classified here. Only the unique conflicts that
    // mean "this payment fact was already applied" become a false result,
    // every other unique violation is rethrown, so the webhook fails loudly
    // and the provider retries.
    return await prisma.$transaction(run, { maxWait: PAYMENT_TRANSACTION_MAX_WAIT_MS, timeout: PAYMENT_TRANSACTION_TIMEOUT_MS });
  } catch (error) {
    // A caller that owns a transaction is not classified here: the violation
    // propagates and rolls the transaction of the caller back cleanly.
    if (transaction) throw error;
    // The engine reports no target for a unique violation of the ledger, so
    // the constraint that fired is unknown. The ledger decides the case
    // explicitly, outside the transaction: a row for this capture means that
    // the capture was already recorded, an accepted capture of the order
    // means that the fact is not applicable to that order, and every other
    // constraint says nothing about the payment fact, so the violation is
    // rethrown and the provider retries.
    if (isAmbiguousLedgerConflict(error)) {
      if (await isPaymentFactAlreadyApplied(input.paymentId, input.providerPaymentId)) return false;
      throw error;
    }
    if (isAppliedPaymentFactConflict(error)) return false;
    throw error;
  }
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
    // The caller keeps the ownership of its transaction: a unique violation
    // is not classified inside it, because catching it there would leave
    // that transaction aborted and its next statement would fail with
    // "current transaction is aborted". The violation propagates, the
    // transaction of the caller rolls back cleanly and the provider retries.
    if (transaction) return await run(transaction);
    // The transaction of this call owns its failure: it rolled back cleanly,
    // so the violation is classified here. Only the unique conflicts that
    // mean "this payment fact was already applied" become a false result,
    // every other unique violation is rethrown, so the webhook fails loudly
    // and the provider retries.
    return await prisma.$transaction(run, { maxWait: PAYMENT_TRANSACTION_MAX_WAIT_MS, timeout: PAYMENT_TRANSACTION_TIMEOUT_MS });
  } catch (error) {
    // A caller that owns a transaction is not classified here: the violation
    // propagates and rolls the transaction of the caller back cleanly.
    if (transaction) throw error;
    // The engine reports no target for a unique violation of the ledger, so
    // the constraint that fired is unknown. The ledger decides the case
    // explicitly, outside the transaction: an accepted capture of the order
    // means that the fact is not applicable to that order, and every other
    // constraint says nothing about the payment fact, so the violation is
    // rethrown and the provider retries.
    if (isAmbiguousLedgerConflict(error)) {
      if (await isPaymentFactAlreadyApplied(input.paymentId)) return false;
      throw error;
    }
    if (isAppliedPaymentFactConflict(error)) return false;
    throw error;
  }
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
  const fact = await callContract(payment.paymentMethod, 'payment', PLUGIN_CONTRACT_VERSIONS.payment, 'queryByRequestKey', { requestKey: payment.idempotencyKey!, account,
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
  }, coreProcessIdentity.instanceId, options), { maxWait: PAYMENT_TRANSACTION_MAX_WAIT_MS, timeout: PAYMENT_TRANSACTION_TIMEOUT_MS });
  const result = { scanned: payments.length, updated: 0, failed: 0, skipped: 0 };
  let stopBatch = false;
  for (const payment of payments) {
    try {
      if (stopBatch || !await paymentLeaseAllowsQuery(client, payment)) { stopBatch = true; result.skipped++; continue; }
      const instance = await getDefaultInstallationRowWithPackage(payment.paymentMethod);
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
        if (changed.count && payment.attempts >= PAYMENT_RECONCILIATION_MAX_ATTEMPTS) await AuditService.write(tx, {
          actorId: 'system', action: 'PAYMENT_REVIEW_REQUIRED', targetType: 'payment', targetId: payment.id, summary: { reason: 'query_budget_exhausted' },
        });
      }, { maxWait: PAYMENT_TRANSACTION_MAX_WAIT_MS, timeout: PAYMENT_TRANSACTION_TIMEOUT_MS });
    }
    finally { await releasePaymentReconciliation(client, payment, stopBatch ? 0 : 60_000); }
  }
  return result;
}
