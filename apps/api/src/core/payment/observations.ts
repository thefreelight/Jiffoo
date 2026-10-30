import { createHash } from 'node:crypto';
import type { PaymentFact, PaymentAccountIdentity } from '@jiffoo/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { emitEvent } from '@/infra/events/emit';
import { decimalToMinor } from '@/core/shared/money';
import { samePaymentAccount, bindObservedPaymentAccount } from './provider-account';
import { lockOrder, lockPayment } from '@/core/shared/locks';
import { recordPaymentSucceeded, recordPaymentFailed, PAYMENT_RECONCILIATION_MAX_ATTEMPTS } from './reconciliation';
import { paymentNow } from './clock';
import { paymentAttemptStatusSets, writePaymentAudit } from './service';
import { CacheService } from '@/core/cache/service';
import type { NotificationTransaction } from '@/core/notifications/service';

const clearLease = { claimToken: null, claimedBy: null, leaseUntil: null };
/**
 * The bounds of the transaction that applies an observed payment fact.
 *
 * The default bounds of Prisma are too small for a payment fact: the fact
 * resolves the installation of the provider, locks the order and the payment
 * and writes the ledger and the outbox of the event. The explicit bounds are
 * the ones the payment webhook uses for the same reason.
 */
const PAYMENT_OBSERVATION_TRANSACTION_MAX_WAIT_MS = 10_000;
const PAYMENT_OBSERVATION_TRANSACTION_TIMEOUT_MS = 30_000;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  return JSON.stringify(value);
}

/** The source of an observation. */
export type PaymentObservationSource = 'query' | 'webhook' | 'creation';

/**
 * The payment a fact belongs to, with the checks that do not need a
 * transaction.
 *
 * The identity of the payment, the evidence of the fact and the binding of
 * the provider account are resolved before the transaction opens: a caller
 * that owns the transaction - the webhook applies the whole payload of one
 * request in one transaction - must not open a second connection for them
 * while its transaction holds the first.
 */
export type PreparedPaymentFact = {
  /** The payment the fact belongs to, with its provider account. */
  identity: any;
  /** The evidence of the fact, without the action of the provider. */
  evidence: Record<string, unknown>;
  /** The hash of the evidence, the identity of the observation. */
  hash: string;
  /** The reason the fact does not match the payment, when it does not. */
  reason: string | null;
};

/**
 * Resolve the payment of a fact and the checks that do not need a
 * transaction.
 *
 * The amount, the currency and the session of the fact are re-derived from
 * the payment row here, and the provider account of the payment is bound to
 * the installation of the provider. A fact that does not match the payment
 * carries the reason of the mismatch, and the reason is recorded with the
 * observation.
 */
export async function preparePaymentFact(
  slug: string,
  fact: PaymentFact,
  source: PaymentObservationSource,
  expectedPaymentId?: string,
  transaction?: NotificationTransaction,
): Promise<PreparedPaymentFact> {
  const identity = await (transaction
    ? transaction.payment.findUnique({ where: expectedPaymentId ? { id: expectedPaymentId } : { idempotencyKey: fact.requestKey }, include: { providerAccount: true } })
    : prisma.payment.findUnique({ where: expectedPaymentId ? { id: expectedPaymentId } : { idempotencyKey: fact.requestKey }, include: { providerAccount: true } }));
  // Persist only validated financial evidence; checkout URLs, raw bodies and credentials are excluded.
  const { action: _action, ...evidence } = fact;
  const hash = createHash('sha256').update(canonical(evidence)).digest('hex');
  let reason: string | null = null;
  if (!identity) reason = 'unknown_request';
  else if (identity.idempotencyKey !== fact.requestKey) reason = 'request_mismatch';
  else if (identity.paymentMethod !== slug || !samePaymentAccount(identity.providerAccount as PaymentAccountIdentity, fact.account)) reason = 'account_mismatch';
  else if (fact.amountMinor !== decimalToMinor(identity.amount.toString(), identity.currency)) reason = 'amount_mismatch';
  else if (fact.currency !== identity.currency) reason = 'currency_mismatch';
  else if (identity.sessionId && fact.sessionId !== identity.sessionId) reason = 'session_mismatch';
  else if (fact.captures.some(capture => capture.requestKey !== fact.requestKey || capture.sessionId !== fact.sessionId
    || !samePaymentAccount(capture.account, fact.account) || capture.currency !== identity.currency
    || capture.amountMinor !== decimalToMinor(identity.amount.toString(), identity.currency))) reason = 'capture_mismatch';
  else if (fact.status === 'succeeded' && !fact.captures.length || fact.captures.length && !fact.sessionId) reason = 'capture_missing';
  if (!reason && identity && !await bindObservedPaymentAccount(slug, identity.providerKey, transaction)) reason = 'account_binding_unavailable';
  return { identity, evidence, hash, reason };
}

/**
 * Apply a prepared fact in a transaction.
 *
 * The payment row is locked and read again inside the transaction, so the
 * checks of the fact are made against the state the payment carries under the
 * lock. The observation is written with the evidence of the fact, a capture
 * is recorded in the ledger, and a payment that still carries no session
 * takes the session of the fact.
 */
export async function applyPreparedPaymentFact(
  slug: string,
  fact: PaymentFact,
  source: PaymentObservationSource,
  claimToken: string | undefined,
  prepared: PreparedPaymentFact,
  transaction: NotificationTransaction,
): Promise<boolean> {
  const { identity, evidence, hash } = prepared;
  let reason = prepared.reason;
  if (identity) { await lockOrder(transaction, identity.orderId); await lockPayment(transaction, identity.id); }
  const locked = identity ? await transaction.payment.findUniqueOrThrow({ where: { id: identity.id } }) : null;
  if (!reason && locked?.sessionId && locked.sessionId !== fact.sessionId) reason = 'session_mismatch';
  if (!reason && locked) for (const capture of [...fact.captures].sort((a, b) => a.providerPaymentId.localeCompare(b.providerPaymentId))) {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${locked.providerKey + ':' + capture.providerPaymentId}, 0))::text`;
    const prior = await transaction.paymentLedger.findUnique({ where: { providerKey_providerPaymentId: { providerKey: locked.providerKey, providerPaymentId: capture.providerPaymentId } } });
    if (prior && prior.paymentId !== locked.id) { reason = 'capture_already_bound'; break; }
  }
  const previous = fact.providerEventId && identity ? await transaction.paymentObservation.findFirst({
    where: { providerKey: identity.providerKey, providerEventId: fact.providerEventId, evidenceHash: { not: hash } },
  }) : null;
  if (previous) reason = 'event_evidence_conflict';
  const observation = await transaction.paymentObservation.upsert({ where: { source_evidenceHash: { source, evidenceHash: hash } }, update: {}, create: {
    paymentId: identity?.id, providerKey: identity?.providerKey, source, requestKey: fact.requestKey, sessionId: fact.sessionId,
    providerEventId: fact.providerEventId, evidenceHash: hash, evidence: evidence as unknown as Prisma.InputJsonValue, verification: 'verified', mismatchReason: reason,
  } });
  if (!identity) return false;
  const payment = await transaction.payment.findUniqueOrThrow({ where: { id: identity.id } });
  if (claimToken && payment.claimToken !== claimToken) return false;
  if (reason) {
    await writePaymentAudit(transaction, { id: `payment-observation:${observation.id}`, actorId: slug, action: 'PAYMENT_OBSERVATION_REVIEW_REQUIRED', targetType: 'payment', targetId: payment.id, summary: { observationId: observation.id, reason } });
    if (source !== 'webhook' && payment.status !== 'SUCCEEDED' && !payment.reviewResolution) await transaction.payment.update({ where: { id: payment.id }, data: { status: 'REQUIRES_REVIEW', failureReason: reason, ...clearLease } });
    return false;
  }
  // Uncertain creation is resolved only by a complete query by request key.
  if ((payment.status === 'UNKNOWN' || payment.status === 'CREATING' && source === 'webhook') && source !== 'query') return false;
  if (source === 'creation' && payment.status !== 'CREATING') return false;
  let updated = false;
  if (fact.sessionId && !payment.sessionId) {
    await transaction.payment.update({ where: { id: payment.id }, data: { sessionId: fact.sessionId, status: payment.status === 'CREATING' ? 'PENDING' : payment.status,
      ...(fact.action ? { actionJson: fact.action as Prisma.InputJsonValue, sessionUrl: fact.action.type === 'redirect' ? fact.action.url : null } : {}) } });
    updated = true;
    // A session that reaches the payment outside the session creation - the
    // reconciliation of an unknown outcome, or the verification of the
    // customer - carries the confirmation of the order with it: the event and
    // the session are written in the same transaction, so a committed session
    // always has its event. The session creation writes the event itself, in
    // the transaction that creates the session.
    if (source !== 'creation' && fact.action) await emitEvent(transaction, 'order.confirmed', 1, payment.orderId, {
      id: payment.orderId, orderId: payment.orderId,
      instructions: fact.action.type === 'instructions' ? fact.action.text : '',
    }, { actorId: slug });
  }
  for (const capture of [...fact.captures].sort((a, b) => a.providerPaymentId.localeCompare(b.providerPaymentId))) {
    const recorded = await recordPaymentSucceeded({ paymentId: payment.id, providerPaymentId: capture.providerPaymentId,
      providerEventId: fact.providerEventId || `${payment.providerKey}:${capture.providerPaymentId}:succeeded`, actorType: 'plugin', actorId: slug,
      metadata: { observationId: observation.id, observedAt: capture.observedAt },
    }, transaction);
    updated = recorded || updated;
  }
  const current = await transaction.payment.findUniqueOrThrow({ where: { id: payment.id } });
  if (!fact.canStillBeCharged && fact.requestClosed && source === 'query' && !current.reviewResolution) {
    await transaction.payment.update({ where: { id: current.id }, data: { closureObservationId: observation.id, closedAt: new Date(fact.observedAt) } });
  }
  if (!fact.captures.length && paymentAttemptStatusSets().observableStatuses.includes(current.status)) {
    const closed = !fact.canStillBeCharged && fact.requestClosed && source === 'query';
    const terminal = closed;
    if (terminal && fact.status === 'failed') {
      const recorded = await recordPaymentFailed({ paymentId: payment.id,
        providerEventId: fact.providerEventId || payment.providerKey + ':' + fact.requestKey + ':failed', actorType: 'plugin', actorId: slug }, transaction);
      updated = recorded || updated;
    }
    const status = terminal ? fact.status === 'failed' ? 'FAILED' : fact.status === 'cancelled' ? 'CANCELLED' : 'EXPIRED'
      : fact.sessionId ? 'PENDING' : 'UNKNOWN';
    if (current.status !== status) { await transaction.payment.update({ where: { id: current.id }, data: { status, failureReason: null, ...clearLease,
      nextReconcileAt: new Date((await paymentNow(transaction)).getTime() + 60_000) } }); updated = true; }
  }
  // The reconciliation attempt budget belongs to the background reconciler,
  // which is the only caller that holds a reconciliation claim. A query
  // without that claim - the customer facing verification endpoint - must
  // neither spend, reset nor escalate that budget, so a polling storefront
  // cannot extend the reconciler's budget and cannot push a payment into a
  // human review. Such a query may still resolve the payment from the
  // provider evidence it carries.
  if (source === 'query' && claimToken) {
    const settled = await transaction.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (settled.status === 'UNKNOWN') {
      if (settled.attempts >= PAYMENT_RECONCILIATION_MAX_ATTEMPTS) {
        await transaction.payment.update({ where: { id: payment.id }, data: { status: 'REQUIRES_REVIEW', failureReason: 'query_budget_exhausted', ...clearLease } });
        await writePaymentAudit(transaction, { actorId: 'system', action: 'PAYMENT_REVIEW_REQUIRED', targetType: 'payment', targetId: payment.id, summary: { reason: 'query_budget_exhausted' } });
      }
    } else await transaction.payment.update({ where: { id: payment.id }, data: { attempts: 0 } });
  }
  return updated;
}

/**
 * Apply one observed payment fact.
 *
 * The fact is applied in a transaction of the caller when the caller owns one:
 * the webhook applies the whole payload of one request in a single
 * transaction, so a failure in a later event rolls back the events that came
 * before it. Without a transaction of the caller the observation opens its own.
 *
 * @param transaction The transaction of the caller, when the caller owns one
 */
export async function observePaymentFact(
  slug: string,
  fact: PaymentFact,
  source: PaymentObservationSource,
  claimToken?: string,
  expectedPaymentId?: string,
  transaction?: NotificationTransaction,
): Promise<boolean> {
  const prepared = await preparePaymentFact(slug, fact, source, expectedPaymentId, transaction);
  const applied = transaction
    ? await applyPreparedPaymentFact(slug, fact, source, claimToken, prepared, transaction)
    : await prisma.$transaction(tx => applyPreparedPaymentFact(slug, fact, source, claimToken, prepared, tx),
      { maxWait: PAYMENT_OBSERVATION_TRANSACTION_MAX_WAIT_MS, timeout: PAYMENT_OBSERVATION_TRANSACTION_TIMEOUT_MS });
  // The cached admin order list is stale after the write, so its version is
  // bumped here: after the transaction that wrote the order resolved, so a
  // rollback keeps the cache correct, and before a reader can repopulate it
  // with the state that the write replaced. A caller that owns the
  // transaction owns the bump, because only the outermost transaction knows
  // when the order became visible.
  if (!transaction && applied) await CacheService.incrementOrderVersion({
    // The context names the payment and the order of the bump, so a lost
    // bump can be traced back to the write that needed it.
    scope: 'payment.observation', reference: prepared.identity?.orderId ?? prepared.identity?.id ?? expectedPaymentId ?? 'unknown',
  });
  return applied;
}
