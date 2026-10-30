import { randomUUID } from 'node:crypto';
import { Prisma, type Payment } from '@prisma/client';
import { PLUGIN_CONTRACT_VERSIONS, type PaymentFact, type PaymentV2Output } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { ApiError, type ErrorCode } from '@/utils/api-errors';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { redactPluginFailure } from '@/core/extensions/runtime/failure';
import { emitEvent, type EventTransaction } from '@/infra/events/emit';
import { OrderService } from '@/core/order/service';
import { OrderStatus, PaymentStatus } from '@/core/order/policy';
import { lockOrder, lockPayment } from '@/core/shared/locks';
import { paymentNow, PAYMENT_SESSION_LIFETIME_MS } from './clock';
import { decimalToMinor } from '@/core/shared/money';
import { observePaymentReservationForTest } from './session-test-control';
import { bindPaymentProviderAccount } from './provider-account';
import { observePaymentFact } from './observations';
import { paymentAttemptStatusSets, writePaymentAudit } from './service';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/unified-logger';

type SessionInput = { orderId: string; userId: string; email: string; pluginSlug: string; idempotencyKey?: string; returnUrl: string; cancelUrl: string };

/**
 * The payment status to API error table.
 *
 * The table is built inside a function so the module keeps no container at
 * module scope. It is exhaustive over the payment attempt statuses: a new
 * payment state has to be mapped here, so that a new error bearing status
 * cannot silently fall through to the missing session field check of
 * `response`. A status that is mapped to no error code falls through to that
 * check, as it does today.
 */
function paymentStatusErrorCodes(): Record<Payment['status'], ErrorCode | null> {
  return {
    UNKNOWN: 'PAYMENT_OUTCOME_UNKNOWN',
    REQUIRES_REVIEW: 'PAYMENT_REQUIRES_REVIEW',
    CREATING: null,
    PENDING: null,
    SUCCEEDED: null,
    FAILED: 'PAYMENT_IDEMPOTENCY_CONFLICT',
    CANCELLED: 'ORDER_NOT_PAYABLE',
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
 * The payload of the order confirmation event of a created payment session.
 *
 * The event carries the order and the instructions of the confirmation. The
 * recipient and the order number are resolved by the subscriber through the
 * order projection, so the event stays free of the fields an order written
 * directly into the database may not have.
 */
function orderConfirmationEvent(confirmation: { orderId: string; instructions: string }) {
  return {
    id: confirmation.orderId, orderId: confirmation.orderId, instructions: confirmation.instructions,
  };
}

/**
 * Write the missing order confirmation event of a committed session.
 *
 * A session that was committed without its confirmation event - a session of
 * an older release, or a write that failed between the session and its event -
 * has no confirmation for the customer. The replay of the session writes the
 * missing event, so the subscriber delivers the confirmation. The event
 * carries no dedup key: a second payable session of the same order writes a
 * second event, and the notification of the subscriber is deduplicated by its
 * own key.
 */
async function repairOrderConfirmationEvent(tx: EventTransaction, input: { orderId: string; payment: Payment; userId: string }) {
  if (!input.payment.sessionId || !input.payment.actionJson) return;
  const recorded = await tx.eventRecord.findFirst({ where: { type: 'order.confirmed', aggregateId: input.orderId } });
  if (recorded) return;
  const action = input.payment.actionJson as NonNullable<PaymentV2Output<'createSession'>['action']>;
  await emitEvent(tx, 'order.confirmed', 1, input.orderId, orderConfirmationEvent({
    orderId: input.orderId, instructions: action?.type === 'instructions' ? action.text : '',
  }), { actorId: input.userId });
}

/**
 * The failure codes of a contract call that are raised before the request
 * leaves the Core.
 *
 * A call that fails with one of these codes never reached the provider: the
 * plugin is missing, disabled, paused for maintenance, not signed, its package
 * is not available, or its circuit breaker is open. Every other failure may
 * have reached the provider, so the outcome of the session stays unknown.
 */
const failureCodesBeforeDispatch = new Set<ErrorCode>([
  'PLUGIN_NOT_FOUND', 'PLUGIN_DISABLED', 'PLUGIN_MAINTENANCE', 'PLUGIN_CIRCUIT_OPEN',
  'PLUGIN_REINSTALL_REQUIRED', 'PLUGIN_TEST_SIGNING_DISABLED',
  'PLUGIN_PACKAGE_UNAVAILABLE', 'PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT', 'PLUGIN_PACKAGE_CORRUPT',
]);

/**
 * Describe a failed session creation.
 *
 * The code of the failure, the dispatch and the sanitized message are the
 * record of the failure. The message is redacted against the configuration of
 * the plugin, so a secret of the plugin never reaches the log or the audit.
 */
async function describeSessionCreationFailure(slug: string, error: unknown): Promise<{
  code: ErrorCode; dispatch: 'not_sent' | 'outcome_unknown'; message: string;
}> {
  const code = error instanceof ApiError ? error.code : 'CONTRACT_CALL_FAILED';
  const message = await redactPluginFailure(slug, error);
  return { code, dispatch: failureCodesBeforeDispatch.has(code) ? 'not_sent' : 'outcome_unknown', message };
}

/**
 * The bounds of the transaction that applies the fact of the provider and
 * writes the confirmation event.
 *
 * The transaction resolves the installation of the provider, locks the order
 * and the payment, writes the observation, the payment state and the event of
 * the confirmation. The bounds are the ones the payment observation uses for
 * the same reason.
 */
const PAYMENT_SESSION_TRANSACTION_MAX_WAIT_MS = 10_000;
const PAYMENT_SESSION_TRANSACTION_TIMEOUT_MS = 30_000;

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
    if (order.paymentStatus === PaymentStatus.PAID || order.paymentStatus === PaymentStatus.REFUNDED) throw new ApiError('ORDER_ALREADY_PAID');
    if (order.status !== OrderStatus.PENDING) throw new ApiError('ORDER_NOT_PAYABLE');
    if (order.paymentMethod !== input.pluginSlug) throw new ApiError('PAYMENT_METHOD_MISMATCH');
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: requestKey } });
    if (existing) {
      if (existing.orderId !== order.id || existing.paymentMethod !== input.pluginSlug || existing.providerKey !== account.providerKey) throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
      const replayError = paymentAttemptStatusSets().replayErrorCodes[existing.status];
      if (replayError) throw new ApiError(replayError);
      // A committed session without its confirmation event is repaired by the
      // replay, so the customer receives the confirmation of the session.
      await repairOrderConfirmationEvent(tx, { orderId: order.id, payment: existing, userId: input.userId });
      return { payment: existing, order, owner: false };
    }
    const previous = await tx.payment.findFirst({ where: { orderId: order.id }, orderBy: { attemptNumber: 'desc' } });
    if (previous) {
      const sets = paymentAttemptStatusSets();
      const previousError = sets.previousAttemptErrorCodes[previous.status];
      if (previousError) throw new ApiError(previousError);
      const adminClosed = sets.adminClosedStatuses.includes(previous.status) && previous.reviewResolution === 'NOT_CHARGED';
      if ((!previous.closureObservationId || !previous.closedAt) && !adminClosed) throw new ApiError('PAYMENT_SESSION_STILL_CHARGEABLE');
      const closedError = sets.closedPreviousAttemptErrorCodes[previous.status];
      if (closedError) throw new ApiError(closedError);
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
  } catch (error) {
    // The failure of the contract call is recorded, not swallowed: the code,
    // the dispatch and the sanitized message are written to the audit trail
    // and to the structured log, next to the state of the payment.
    const failure = await describeSessionCreationFailure(input.pluginSlug, error);
    await prisma.$transaction(async tx => {
      await lockOrder(tx, input.orderId); await lockPayment(tx, reservation.payment.id);
      await tx.payment.updateMany({ where: { id: reservation.payment.id, status: 'CREATING' }, data: {
        status: 'UNKNOWN',
        // A request that never left the Core has no outcome to wait for; a
        // request that may have reached the provider has an unknown outcome.
        failureReason: failure.dispatch === 'not_sent' ? 'creation_not_sent' : 'creation_outcome_unknown',
        claimToken: null, claimedBy: null, leaseUntil: null,
      } });
      await writePaymentAudit(tx, {
        actorId: input.pluginSlug, action: 'PAYMENT_SESSION_CREATION_FAILED',
        targetType: 'payment', targetId: reservation.payment.id,
        summary: { pluginSlug: input.pluginSlug, errorCode: failure.code, dispatch: failure.dispatch, message: failure.message },
      });
    });
    LoggerService.logPayment('payment-session-creation-failed', input.orderId, undefined, {
      pluginSlug: input.pluginSlug, paymentId: reservation.payment.id, errorCode: failure.code, dispatch: failure.dispatch, message: failure.message,
    });
    throw new ApiError('PAYMENT_OUTCOME_UNKNOWN');
  }
  // The fact of the provider and the confirmation event are applied in one
  // transaction: a committed session always has its event, and a transaction
  // that fails leaves neither the session nor the event behind.
  let factApplied = false;
  const payment = await prisma.$transaction(async tx => {
    await lockOrder(tx, input.orderId); await lockPayment(tx, reservation.payment.id);
    factApplied = await observePaymentFact(input.pluginSlug, fact, 'creation', undefined, reservation.payment.id, tx);
    const current = await tx.payment.findUniqueOrThrow({ where: { id: reservation.payment.id } });
    if (current.status === 'CREATING') {
      await tx.payment.update({ where: { id: current.id }, data: { status: 'REQUIRES_REVIEW', failureReason: 'creation_fact_mismatch' } });
      throw new ApiError('PAYMENT_REQUIRES_REVIEW');
    }
    // The order confirmation notification is a side effect of the session: the
    // event is written inside this transaction, so the event and the payment
    // state stay atomic, and the core subscriber writes the notification row
    // after the commit. A failing notification can therefore never roll back
    // the payment session. The recipient and the order number are resolved by
    // the subscriber through the order projection, so the event carries the
    // order and the instructions only.
    if (current.sessionId && current.actionJson) await emitEvent(tx, 'order.confirmed', 1, input.orderId,
      orderConfirmationEvent({
        orderId: input.orderId,
        instructions: fact.action?.type === 'instructions' ? fact.action.text : '',
      }), { actorId: input.userId });
    return current;
  }, { maxWait: PAYMENT_SESSION_TRANSACTION_MAX_WAIT_MS, timeout: PAYMENT_SESSION_TRANSACTION_TIMEOUT_MS });
  // The transaction of the caller owns the bump of the cached order version:
  // the observation does not bump it while it runs inside a transaction of the
  // caller. The context names the order of the bump, so a lost bump can be
  // traced back to the session that needed it.
  if (factApplied) await CacheService.incrementOrderVersion({ scope: 'payment.session', reference: input.orderId });
  return response(payment);
}
