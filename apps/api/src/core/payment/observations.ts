import { createHash } from 'node:crypto';
import type { PaymentFact, PaymentAccountIdentity } from '@jiffoo/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { decimalToMinor } from './minor-units';
import { samePaymentAccount, bindObservedPaymentAccount } from './provider-account';
import { lockOrder, lockPayment } from './locks';
import { recordPaymentSucceeded, recordPaymentFailed, PAYMENT_RECONCILIATION_MAX_ATTEMPTS } from './reconciliation';
import { paymentNow } from './clock';

const clearLease = { claimToken: null, claimedBy: null, leaseUntil: null };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  return JSON.stringify(value);
}
export async function observePaymentFact(slug: string, fact: PaymentFact, source: 'query' | 'webhook' | 'creation', claimToken?: string, expectedPaymentId?: string): Promise<boolean> {
  const identity = await prisma.payment.findUnique({ where: expectedPaymentId ? { id: expectedPaymentId } : { idempotencyKey: fact.requestKey }, include: { providerAccount: true } });
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
  if (!reason && identity && !await bindObservedPaymentAccount(slug, identity.providerKey)) reason = 'account_binding_unavailable';
  return prisma.$transaction(async tx => {
    if (identity) { await lockOrder(tx, identity.orderId); await lockPayment(tx, identity.id); }
    const locked = identity ? await tx.payment.findUniqueOrThrow({ where: { id: identity.id } }) : null;
    if (!reason && locked?.sessionId && locked.sessionId !== fact.sessionId) reason = 'session_mismatch';
    if (!reason && locked) for (const capture of [...fact.captures].sort((a, b) => a.providerPaymentId.localeCompare(b.providerPaymentId))) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${locked.providerKey + ':' + capture.providerPaymentId}, 0))::text`;
      const prior = await tx.paymentLedger.findUnique({ where: { providerKey_providerPaymentId: { providerKey: locked.providerKey, providerPaymentId: capture.providerPaymentId } } });
      if (prior && prior.paymentId !== locked.id) { reason = 'capture_already_bound'; break; }
    }
    const previous = fact.providerEventId && identity ? await tx.paymentObservation.findFirst({
      where: { providerKey: identity.providerKey, providerEventId: fact.providerEventId, evidenceHash: { not: hash } },
    }) : null;
    if (previous) reason = 'event_evidence_conflict';
    const observation = await tx.paymentObservation.upsert({ where: { source_evidenceHash: { source, evidenceHash: hash } }, update: {}, create: {
      paymentId: identity?.id, providerKey: identity?.providerKey, source, requestKey: fact.requestKey, sessionId: fact.sessionId,
      providerEventId: fact.providerEventId, evidenceHash: hash, evidence: evidence as unknown as Prisma.InputJsonValue, verification: 'verified', mismatchReason: reason,
    } });
    if (!identity) return false;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: identity.id } });
    if (claimToken && payment.claimToken !== claimToken) return false;
    if (reason) {
      await tx.adminAuditEvent.upsert({ where: { id: `payment-observation:${observation.id}` }, update: {}, create: {
        id: `payment-observation:${observation.id}`, actorId: slug, action: 'PAYMENT_OBSERVATION_REVIEW_REQUIRED', targetType: 'payment', targetId: payment.id, summary: { observationId: observation.id, reason },
      } });
      if (source !== 'webhook' && payment.status !== 'SUCCEEDED') await tx.payment.update({ where: { id: payment.id }, data: { status: 'REQUIRES_REVIEW', failureReason: reason, ...clearLease } });
      return false;
    }
    // Uncertain creation is resolved only by a complete query by request key.
    if ((payment.status === 'UNKNOWN' || payment.status === 'CREATING' && source === 'webhook') && source !== 'query') return false;
    if (source === 'creation' && payment.status !== 'CREATING') return false;
    let updated = false;
    if (fact.sessionId && !payment.sessionId) {
      await tx.payment.update({ where: { id: payment.id }, data: { sessionId: fact.sessionId, status: payment.status === 'CREATING' ? 'PENDING' : payment.status,
        ...(fact.action ? { actionJson: fact.action as Prisma.InputJsonValue, sessionUrl: fact.action.type === 'redirect' ? fact.action.url : null } : {}) } });
      updated = true;
    }
    for (const capture of [...fact.captures].sort((a, b) => a.providerPaymentId.localeCompare(b.providerPaymentId))) {
      updated = await recordPaymentSucceeded({ paymentId: payment.id, providerPaymentId: capture.providerPaymentId,
        providerEventId: fact.providerEventId || `${payment.providerKey}:${capture.providerPaymentId}:succeeded`, actorType: 'plugin', actorId: slug,
        metadata: { observationId: observation.id, observedAt: capture.observedAt },
      }, tx) || updated;
    }
    const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (!fact.canStillBeCharged && fact.requestClosed && source === 'query') {
      await tx.payment.update({ where: { id: current.id }, data: { closureObservationId: observation.id, closedAt: new Date(fact.observedAt) } });
    }
    if (!fact.captures.length && ['CREATING', 'PENDING', 'UNKNOWN', 'REQUIRES_REVIEW'].includes(current.status)) {
      const closed = !fact.canStillBeCharged && fact.requestClosed && source === 'query';
      const terminal = closed;
      if (terminal && fact.status === 'failed') updated = await recordPaymentFailed({ paymentId: payment.id,
        providerEventId: fact.providerEventId || payment.providerKey + ':' + fact.requestKey + ':failed', actorType: 'plugin', actorId: slug }, tx) || updated;
      const status = terminal ? fact.status === 'failed' ? 'FAILED' : fact.status === 'cancelled' ? 'CANCELLED' : 'EXPIRED'
        : fact.sessionId ? 'PENDING' : 'UNKNOWN';
      if (current.status !== status) { await tx.payment.update({ where: { id: current.id }, data: { status, failureReason: null, ...clearLease,
        nextReconcileAt: new Date((await paymentNow(tx)).getTime() + 60_000) } }); updated = true; }
    }
    if (source === 'query') {
      const settled = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (settled.status === 'UNKNOWN') {
        if (settled.attempts >= PAYMENT_RECONCILIATION_MAX_ATTEMPTS) {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'REQUIRES_REVIEW', failureReason: 'query_budget_exhausted', ...clearLease } });
          await tx.adminAuditEvent.create({ data: { actorId: 'system', action: 'PAYMENT_REVIEW_REQUIRED', targetType: 'payment', targetId: payment.id, summary: { reason: 'query_budget_exhausted' } } });
        }
      } else await tx.payment.update({ where: { id: payment.id }, data: { attempts: 0 } });
    }
    return updated;
  });
}
