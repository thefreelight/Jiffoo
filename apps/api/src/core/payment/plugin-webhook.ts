import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { OrderStatus, PaymentStatus } from '@/core/order/types';
import { recordOrderStatusHistory } from '@/core/order/status-history';
import { emitOrderPaidEvent } from './order-paid-event';
import { OutboxService } from '@/infra/outbox';

type NormalizedPluginWebhook = {
  received?: boolean;
  handled?: boolean;
  providerEventId?: string | null;
  sessionId?: string | null;
  normalizedStatus?: string;
};

export async function applyNormalizedPluginWebhook(
  pluginSlug: string,
  result: NormalizedPluginWebhook,
): Promise<boolean> {
  if (!result.received || !result.handled || !result.sessionId) return false;
  const normalizedStatus = String(result.normalizedStatus || '').toLowerCase();
  if (!['succeeded', 'failed', 'cancelled', 'canceled', 'expired'].includes(normalizedStatus)) return false;

  const payment = await prisma.payment.findFirst({
    where: { sessionId: result.sessionId, paymentMethod: pluginSlug },
    include: { order: { select: { status: true, paymentStatus: true } } },
  });
  if (!payment) return false;

  const succeeded = normalizedStatus === 'succeeded';
  const providerEventId = result.providerEventId || `${pluginSlug}:${result.sessionId}:${normalizedStatus}`;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.paymentLedger.findUnique({ where: { providerEventId } });
    if (existing) return false;

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: succeeded ? 'SUCCEEDED' : 'FAILED',
        providerEventId,
      },
    });
    await tx.paymentLedger.create({
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        eventType: succeeded ? 'SUCCEEDED' : 'FAILED',
        amount: payment.amount,
        currency: payment.currency,
        provider: pluginSlug,
        providerEventId,
        metadata: (payment.metadata || {}) as Prisma.InputJsonValue,
      },
    });
    const updatedOrder = await tx.order.update({
      where: { id: payment.orderId },
      data: succeeded
        ? { status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID }
        : { paymentStatus: PaymentStatus.FAILED },
    });
    await recordOrderStatusHistory(tx, {
      orderId: payment.orderId,
      fromStatus: payment.order.status,
      toStatus: updatedOrder.status,
      fromPaymentStatus: payment.order.paymentStatus,
      toPaymentStatus: updatedOrder.paymentStatus,
      reason: succeeded ? 'plugin_webhook_succeeded' : 'plugin_webhook_failed',
      actorType: 'plugin',
      actorId: pluginSlug,
      metadata: (payment.metadata || {}) as Record<string, unknown>,
    });

    const eventType = succeeded ? 'payment.succeeded' : 'payment.failed';
    if (succeeded && payment.order.paymentStatus !== PaymentStatus.PAID) {
      await emitOrderPaidEvent(tx, payment.orderId, {
        paymentId: updatedPayment.id,
        paymentMethod: pluginSlug,
        sessionId: updatedPayment.sessionId,
        providerEventId,
        metadata: (payment.metadata || {}) as Record<string, unknown>,
      });
    }
    await OutboxService.emit(tx, eventType, payment.id, {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: Number(payment.amount),
      currency: payment.currency,
      metadata: payment.metadata || {},
    }, { actorId: pluginSlug });
    return true;
  });
}
