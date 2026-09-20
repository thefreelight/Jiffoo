import { prisma } from '@/config/database';
import { ExternalOrderService } from '@/core/external-orders/service';
import { OrderStatus, PaymentStatus } from '@/core/order/types';
import { recordOrderStatusHistory } from '@/core/order/status-history';
import { callPaymentPlugin } from '@/core/payment/plugin-gateway';
import { emitOrderPaidEvent } from '@/core/payment/order-paid-event';
import { OutboxService } from '@/infra/outbox';
import { OrderPaymentStatus as PrismaOrderPaymentStatus, OrderStatus as PrismaOrderStatus, Prisma } from '@prisma/client';

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

function normalizeMethodKey(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export type RecordPaymentSucceededInput = {
  paymentId: string;
  providerEventId: string;
  paymentIntentId?: string | null;
  reason?: string;
  actorType?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
};

export async function recordPaymentSucceeded(input: RecordPaymentSucceededInput): Promise<boolean> {
  const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment || payment.status === 'SUCCEEDED') {
    return false;
  }

  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    select: { status: true, paymentStatus: true },
  });
  if (!order) {
    return false;
  }

  let didUpdate = false;
  try {
    await prisma.$transaction(async (tx) => {
      const ledger = await tx.paymentLedger.findUnique({
        where: { providerEventId: input.providerEventId },
      });
      if (ledger) {
        return;
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          paymentIntentId: input.paymentIntentId || payment.paymentIntentId || null,
          providerEventId: input.providerEventId,
        },
      });

      await tx.paymentLedger.create({
        data: {
          paymentId: updatedPayment.id,
          orderId: payment.orderId,
          eventType: 'SUCCEEDED',
          amount: updatedPayment.amount,
          currency: updatedPayment.currency,
          provider: updatedPayment.paymentMethod,
          providerEventId: input.providerEventId,
          metadata: input.metadata,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.PROCESSING,
        },
      });

      await recordOrderStatusHistory(tx, {
        orderId: updatedOrder.id,
        fromStatus: order.status as PrismaOrderStatus,
        toStatus: updatedOrder.status as PrismaOrderStatus,
        fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
        toPaymentStatus: updatedOrder.paymentStatus as PrismaOrderPaymentStatus,
        reason: input.reason || 'payment_succeeded',
        actorType: input.actorType || 'system',
        actorId: input.actorId,
        metadata: input.metadata,
      });

      await emitOrderPaidEvent(tx, payment.orderId, {
        paymentId: updatedPayment.id,
        paymentMethod: updatedPayment.paymentMethod,
        paymentIntentId: updatedPayment.paymentIntentId,
        sessionId: updatedPayment.sessionId,
        providerEventId: input.providerEventId,
        metadata: (updatedPayment.metadata || {}) as Record<string, unknown>,
        actorId: input.actorId,
      });

      await OutboxService.emit(tx, 'payment.succeeded', updatedPayment.id, {
        paymentId: updatedPayment.id,
        orderId: payment.orderId,
        userId: (updatedPayment.metadata as Record<string, unknown> | null)?.userId,
        amount: Number(updatedPayment.amount),
        currency: updatedPayment.currency,
        metadata: updatedPayment.metadata || {},
      }, { actorId: input.actorId });

      didUpdate = true;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return false;
    }
    throw error;
  }

  if (didUpdate) {
    await ExternalOrderService.processPaidOrder(payment.orderId).catch((error) => {
      console.error('Failed to process paid external orders:', error);
    });
  }
  return didUpdate;
}

export async function syncPaymentFromPlugin(sessionId: string): Promise<boolean> {
  const payment = await prisma.payment.findFirst({ where: { sessionId } });
  if (!payment || !payment.paymentMethod) {
    return false;
  }

  if (normalizeMethodKey(payment.paymentMethod) === 'manual') {
    return false;
  }

  if (payment.status === 'SUCCEEDED') {
    await ExternalOrderService.processPaidOrder(payment.orderId).catch((error) => {
      console.error('Failed to process paid external orders:', error);
    });
    return false;
  }

  if (payment.status === 'FAILED') {
    return false;
  }

  const verifyResult = await callPaymentPlugin({
    pluginSlug: payment.paymentMethod,
    path: '/api/payments/verify-session?installation=default',
    body: { sessionId },
    retryOptions: { retries: 1, minDelayMs: 200, maxDelayMs: 1500 },
  });

  if (!verifyResult.ok) {
    return false;
  }

  const rawData = verifyResult.payload?.data ?? verifyResult.payload;
  const data = (typeof rawData === 'object' && rawData ? rawData : {}) as Record<string, unknown>;
  const status = normalizeMethodKey(data?.status || data?.paymentStatus || '');
  const providerEventId = (data?.eventId as string) || sessionId;

  if (payment.providerEventId && payment.providerEventId === providerEventId) {
    return false;
  }

  const existingLedger = await prisma.paymentLedger.findUnique({
    where: { providerEventId },
  });
  if (existingLedger) {
    return false;
  }

  if (['paid', 'succeeded', 'success', 'completed'].includes(status)) {
    return recordPaymentSucceeded({
      paymentId: payment.id,
      providerEventId,
      paymentIntentId: (data?.paymentIntentId as string) || null,
    });
  }

  if (['failed', 'canceled', 'cancelled', 'expired'].includes(status)) {
    const order = await prisma.order.findUnique({
      where: { id: payment.orderId },
      select: { status: true, paymentStatus: true },
    });
    let didUpdate = false;
    try {
      await prisma.$transaction(async (tx) => {
        const ledger = await tx.paymentLedger.findUnique({
          where: { providerEventId },
        });
        if (ledger) {
          return;
        }

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            providerEventId,
          },
        });

        await tx.paymentLedger.create({
          data: {
            paymentId: updatedPayment.id,
            orderId: payment.orderId,
            eventType: 'FAILED',
            amount: updatedPayment.amount,
            currency: updatedPayment.currency,
            provider: updatedPayment.paymentMethod,
            providerEventId,
          },
        });

        const updatedOrder = await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: PaymentStatus.FAILED },
        });

        if (order) {
          await recordOrderStatusHistory(tx, {
            orderId: updatedOrder.id,
            fromStatus: order.status as PrismaOrderStatus,
            toStatus: updatedOrder.status as PrismaOrderStatus,
            fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
            toPaymentStatus: updatedOrder.paymentStatus as PrismaOrderPaymentStatus,
            reason: 'payment_failed',
            actorType: 'system',
          });
        }


        await OutboxService.emit(tx, 'payment.failed', updatedPayment.id, {
          paymentId: updatedPayment.id,
          orderId: payment.orderId,
          userId: (updatedPayment.metadata as Record<string, unknown> | null)?.userId,
          amount: Number(updatedPayment.amount),
          currency: updatedPayment.currency,
          metadata: updatedPayment.metadata || {},
        });

        didUpdate = true;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return false;
      }
      throw error;
    }
    return didUpdate;
  }

  return false;
}

export type PaymentReconciliationOptions = {
  limit?: number;
  maxAgeMinutes?: number;
  minAgeMinutes?: number;
};

export type PaymentReconciliationResult = {
  scanned: number;
  updated: number;
  failed: number;
};

export async function reconcilePendingPayments(
  options: PaymentReconciliationOptions = {}
): Promise<PaymentReconciliationResult> {
  const limit = options.limit ?? 100;
  const maxAgeMinutes = options.maxAgeMinutes ?? 60 * 24 * 7;
  const minAgeMinutes = options.minAgeMinutes ?? 2;

  const now = Date.now();
  const createdAt: Prisma.DateTimeFilter = {};
  if (maxAgeMinutes > 0) {
    createdAt.gte = new Date(now - maxAgeMinutes * 60 * 1000);
  }
  if (minAgeMinutes > 0) {
    createdAt.lte = new Date(now - minAgeMinutes * 60 * 1000);
  }

  const where: Prisma.PaymentWhereInput = {
    status: 'PENDING',
    sessionId: { not: null },
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { sessionId: true, paymentMethod: true },
  });

  let updated = 0;
  let failed = 0;

  for (const payment of payments) {
    if (!payment.sessionId || normalizeMethodKey(payment.paymentMethod) === 'manual') {
      continue;
    }
    try {
      const didUpdate = await syncPaymentFromPlugin(payment.sessionId);
      if (didUpdate) {
        updated += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    scanned: payments.length,
    updated,
    failed,
  };
}
