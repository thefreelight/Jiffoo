import { prisma } from '@/config/database';
import { ApiError, type ErrorCode } from '@/utils/api-errors';
import { AuditService, type AuditTx } from '@/core/audit/service';
import { PaymentAttemptStatus } from '@prisma/client';

/**
 * Payment Service
 *
 * The payment module owns the payment tables (`payments`, `payment_ledgers`,
 * `refunds`, `refund_ledgers`). Every other module expresses a payment side
 * effect through this service instead of writing those tables itself.
 *
 * Transaction surface required by the payment service. Both the plain Prisma
 * client and a transaction client satisfy it, so the caller passes its own
 * transaction client straight through.
 */
export type PaymentWriteTx = {
  payment: {
    findUnique(args: any): Promise<any>;
    findFirst(args: any): Promise<any>;
    update(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
  };
  paymentLedger: {
    findUnique(args: any): Promise<any>;
    findFirst(args: any): Promise<any>;
    create(args: any): Promise<any>;
  };
  refund: {
    findUnique(args: any): Promise<any>;
    findFirst(args: any): Promise<any>;
    create(args: any): Promise<any>;
  };
  refundLedger: {
    create(args: any): Promise<any>;
  };
};

/**
 * The transaction surface of a refund that also records an audit event: the
 * payment tables plus the audit write outlet.
 */
export type PaymentAuditTx = PaymentWriteTx & AuditTx;

/** Latest payment of an order plus whether a refund is still required. */
export type OrderPaymentSummary = {
  payment: { id: string; sessionId: string | null; actionJson: unknown; status: string } | null;
  refundRequired: boolean;
};

/**
 * The payment attempt status vocabulary of the payment module.
 *
 * The payment attempt status is stored in the payments table, so a new attempt
 * status needs a Prisma enum change and the matching migration. The tables
 * below collect the statuses that already exist, so that the decision of
 * every call site is written in one place: a new status has to be added to
 * each table, and the tables are exhaustive, so the compiler asks for the
 * missing decision instead of letting a status fall through silently.
 */
export function paymentAttemptStatusSets() {
  return {
    /** The payment attempt status vocabulary, in the stable order of the Prisma enum. */
    values: Object.values(PaymentAttemptStatus),

    /**
     * The error code of a replayed attempt, that is the attempt of an already
     * known idempotency key. Only a pending attempt replays; every other
     * status raises its own error code.
     */
    replayErrorCodes: {
      UNKNOWN: 'PAYMENT_OUTCOME_UNKNOWN',
      REQUIRES_REVIEW: 'PAYMENT_REQUIRES_REVIEW',
      CREATING: 'PAYMENT_ATTEMPT_OPEN',
      PENDING: null,
      SUCCEEDED: 'PAYMENT_IDEMPOTENCY_CONFLICT',
      FAILED: 'PAYMENT_IDEMPOTENCY_CONFLICT',
      CANCELLED: 'PAYMENT_IDEMPOTENCY_CONFLICT',
      EXPIRED: 'PAYMENT_IDEMPOTENCY_CONFLICT',
    } as Record<PaymentAttemptStatus, ErrorCode | null>,

    /**
     * The error code of the previous attempt of an order, raised before the
     * closure of that attempt is checked.
     */
    previousAttemptErrorCodes: {
      UNKNOWN: 'PAYMENT_OUTCOME_UNKNOWN',
      REQUIRES_REVIEW: 'PAYMENT_REQUIRES_REVIEW',
      CREATING: 'PAYMENT_ATTEMPT_OPEN',
      PENDING: null,
      SUCCEEDED: null,
      FAILED: null,
      CANCELLED: null,
      EXPIRED: null,
    } as Record<PaymentAttemptStatus, ErrorCode | null>,

    /**
     * The error code of the previous attempt of an order, raised once the
     * closure of that attempt is confirmed.
     */
    closedPreviousAttemptErrorCodes: {
      UNKNOWN: null,
      REQUIRES_REVIEW: null,
      CREATING: null,
      PENDING: 'PAYMENT_ATTEMPT_OPEN',
      SUCCEEDED: null,
      FAILED: null,
      CANCELLED: null,
      EXPIRED: null,
    } as Record<PaymentAttemptStatus, ErrorCode | null>,

    /** The statuses of an attempt that an admin may close as not charged. */
    adminClosedStatuses: ['FAILED'] as PaymentAttemptStatus[],

    /** The statuses of an attempt that the observation path may still resolve. */
    observableStatuses: ['CREATING', 'PENDING', 'UNKNOWN', 'REQUIRES_REVIEW'] as PaymentAttemptStatus[],

    /** The statuses of an attempt that the reconciliation lease may claim. */
    leasableStatuses: ['CREATING', 'PENDING', 'UNKNOWN', 'SUCCEEDED', 'CANCELLED'] as PaymentAttemptStatus[],

    /** The statuses of an attempt that may be cancelled with its order. */
    cancellableStatuses: ['CREATING', 'PENDING'] as PaymentAttemptStatus[],
  };
}

export class PaymentService {
  /**
   * Cancel the order's CREATING/PENDING payments.
   *
   * The payment module owns the allow-list of cancellable payment states, so
   * the order module asks for the side effect instead of writing the payment
   * table itself.
   */
  static async cancelPendingForOrder(tx: PaymentWriteTx, orderId: string): Promise<number> {
    const cancelled = await tx.payment.updateMany({
      where: { orderId, status: { in: paymentAttemptStatusSets().cancellableStatuses } },
      data: { status: 'CANCELLED', claimToken: null, claimedBy: null, leaseUntil: null },
    });
    return cancelled.count;
  }

  /**
   * Read projection of the order's payment state.
   *
   * The order module consumes this instead of reading the payment tables.
   */
  static async getOrderPaymentSummary(orderId: string): Promise<OrderPaymentSummary> {
    const payment = await prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, sessionId: true, actionJson: true, status: true },
    });
    const refundRequired = await prisma.paymentLedger.count({
      where: { orderId, eventType: 'SUCCEEDED', refundRequired: true, refunds: { none: { status: 'COMPLETED' } } },
    }) > 0;
    return {
      payment: payment
        ? { id: payment.id, sessionId: payment.sessionId, actionJson: payment.actionJson, status: payment.status }
        : null,
      refundRequired,
    };
  }

  /**
   * The refund that already covers a capture.
   *
   * The idempotency key wins: a key that points at another capture is a
   * PAYMENT_IDEMPOTENCY_CONFLICT, a key that points at this capture returns
   * its refund. A capture that already carries a completed refund accepts
   * only the key of that refund: every other key is a
   * PAYMENT_IDEMPOTENCY_CONFLICT, because a second refund of the same
   * capture would leave the reference of the second attempt out of the audit
   * trail.
   */
  private static async findExistingRefund(tx: PaymentWriteTx, idempotencyKey: string, captureId: string): Promise<string | null> {
    const keyed = await tx.refund.findUnique({ where: { idempotencyKey } });
    if (keyed && keyed.paymentLedgerId !== captureId) throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
    if (keyed) return keyed.id;

    const completed = await tx.refund.findFirst({ where: { paymentLedgerId: captureId, status: 'COMPLETED' } });
    if (!completed) return null;
    if (completed.idempotencyKey !== idempotencyKey) throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
    return completed.id;
  }

  /**
   * Create the refund, the refund ledger entry and the REFUNDED payment ledger
   * entry of an accepted capture.
   *
   * The operation is idempotent on the idempotency key: an existing key for the
   * same capture returns the existing refund, a key that points at another
   * capture is a PAYMENT_IDEMPOTENCY_CONFLICT and a capture that already
   * carries a completed refund raises the same conflict for every other key.
   */
  static async refundOrder(tx: PaymentWriteTx, input: {
    orderId: string;
    paymentId: string;
    paymentLedgerId?: string;
    amount: string;
    currency: string;
    provider: string;
    reason?: string | null;
    reference: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ refundId: string; created: boolean }> {
    const capture = await tx.paymentLedger.findFirst({
      where: {
        paymentId: input.paymentId,
        eventType: 'SUCCEEDED',
        refundRequired: false,
        ...(input.paymentLedgerId ? { id: input.paymentLedgerId } : {}),
      },
    });
    if (!capture) throw new ApiError('VALIDATION_ERROR');

    const existing = await PaymentService.findExistingRefund(tx, input.idempotencyKey, capture.id);
    if (existing) return { refundId: existing, created: false };

    const refund = await tx.refund.create({
      data: {
        paymentId: input.paymentId,
        paymentLedgerId: capture.id,
        orderId: input.orderId,
        amount: input.amount,
        currency: input.currency,
        status: 'COMPLETED',
        reason: input.reason,
        reference: input.reference,
        provider: input.provider.toUpperCase(),
        idempotencyKey: input.idempotencyKey,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });

    await tx.refundLedger.create({
      data: {
        refundId: refund.id,
        paymentId: input.paymentId,
        orderId: input.orderId,
        eventType: 'SUCCEEDED',
        amount: input.amount,
        currency: input.currency,
        provider: input.provider,
        idempotencyKey: input.idempotencyKey,
      },
    });

    await tx.paymentLedger.create({
      data: {
        paymentId: input.paymentId,
        orderId: input.orderId,
        eventType: 'REFUNDED',
        amount: input.amount,
        currency: input.currency,
        provider: input.provider,
        providerEventId: `refund:${refund.id}`,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return { refundId: refund.id, created: true };
  }

  /**
   * Resolve a capture that requires a refund into a completed refund.
   *
   * The operation is idempotent on the idempotency key: a second resolution of
   * the same capture with the same key returns the existing refund without a
   * second effect, and every other key is a PAYMENT_IDEMPOTENCY_CONFLICT.
   */
  static async resolveRefundRequiredPayment(tx: PaymentAuditTx, input: {
    orderId: string;
    paymentId: string;
    providerPaymentId: string;
    reference: string;
    idempotencyKey: string;
    actorId: string;
  }): Promise<{ refundId: string | null; created: boolean }> {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment || payment.orderId !== input.orderId) throw new ApiError('NOT_FOUND');

    const success = await tx.paymentLedger.findFirst({
      where: {
        paymentId: payment.id,
        providerPaymentId: input.providerPaymentId,
        eventType: 'SUCCEEDED',
        refundRequired: true,
      },
    });
    if (!success) throw new ApiError('VALIDATION_ERROR');

    const existing = await PaymentService.findExistingRefund(tx, input.idempotencyKey, success.id);
    if (existing) return { refundId: existing, created: false };

    const refund = await tx.refund.create({
      data: {
        orderId: input.orderId,
        paymentId: payment.id,
        paymentLedgerId: success.id,
        amount: success.amount,
        currency: success.currency,
        status: 'COMPLETED',
        reference: input.reference,
        reason: success.refundReason,
        provider: payment.paymentMethod,
        idempotencyKey: input.idempotencyKey,
        metadata: { actorId: input.actorId, actorType: 'admin', refundRequiredResolution: true },
      },
    });

    await tx.refundLedger.create({
      data: {
        refundId: refund.id,
        paymentId: payment.id,
        orderId: input.orderId,
        eventType: 'SUCCEEDED',
        amount: success.amount,
        currency: success.currency,
        provider: payment.paymentMethod,
        idempotencyKey: input.idempotencyKey,
        metadata: { actorId: input.actorId, actorType: 'admin' },
      },
    });

    await tx.paymentLedger.create({
      data: {
        paymentId: payment.id,
        orderId: input.orderId,
        eventType: 'REFUNDED',
        amount: success.amount,
        currency: success.currency,
        provider: payment.paymentMethod,
        providerEventId: `refund:${refund.id}`,
        idempotencyKey: input.idempotencyKey,
        actorType: 'admin',
        manualReference: input.reference,
        metadata: { actorId: input.actorId, refundRequiredResolution: true },
      },
    });

    await AuditService.write(tx, {
      actorId: input.actorId,
      action: 'PAYMENT_REFUND_REQUIRED_RESOLVED',
      targetType: 'payment',
      targetId: payment.id,
      summary: { refundId: refund.id, providerPaymentId: success.providerPaymentId, reference: input.reference },
    });

    return { refundId: refund.id, created: true };
  }
}
