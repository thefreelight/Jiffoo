import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';

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
  adminAuditEvent: {
    create(args: any): Promise<any>;
  };
};

/** Latest payment of an order plus whether a refund is still required. */
export type OrderPaymentSummary = {
  payment: { id: string; sessionId: string | null; actionJson: unknown; status: string } | null;
  refundRequired: boolean;
};

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
      where: { orderId, status: { in: ['CREATING', 'PENDING'] } },
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
   * Create the refund, the refund ledger entry and the REFUNDED payment ledger
   * entry of an accepted capture.
   *
   * The operation is idempotent on the idempotency key: an existing key for the
   * same capture returns the existing refund, a key that points at another
   * capture is a PAYMENT_IDEMPOTENCY_CONFLICT and an already completed refund
   * for the capture returns without a second effect.
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
    actorId: string;
    actorType: string;
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

    const keyed = await tx.refund.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (keyed && keyed.paymentLedgerId !== capture.id) throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
    if (keyed) return { refundId: keyed.id, created: false };

    const completed = await tx.refund.findFirst({ where: { paymentLedgerId: capture.id, status: 'COMPLETED' } });
    if (completed) return { refundId: completed.id, created: false };

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
   * The operation is idempotent on the idempotency key and on the capture: a
   * second resolution of the same capture returns the existing refund without a
   * second effect.
   */
  static async resolveRefundRequiredPayment(tx: PaymentWriteTx, input: {
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

    const keyed = await tx.refund.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (keyed && keyed.paymentLedgerId !== success.id) throw new ApiError('PAYMENT_IDEMPOTENCY_CONFLICT');
    if (keyed) return { refundId: keyed.id, created: false };

    const completed = await tx.refund.findFirst({ where: { paymentLedgerId: success.id, status: 'COMPLETED' } });
    if (completed) return { refundId: completed.id, created: false };

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

    await tx.adminAuditEvent.create({
      data: {
        actorId: input.actorId,
        action: 'PAYMENT_REFUND_REQUIRED_RESOLVED',
        targetType: 'payment',
        targetId: payment.id,
        summary: { refundId: refund.id, providerPaymentId: success.providerPaymentId, reference: input.reference },
      },
    });

    return { refundId: refund.id, created: true };
  }
}
