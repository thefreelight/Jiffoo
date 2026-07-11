import { OutboxService } from '@/infra/outbox';

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

type EmitOrderPaidInput = {
  paymentId?: string;
  paymentMethod?: string;
  paymentIntentId?: string | null;
  sessionId?: string | null;
  providerEventId?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string;
};

export async function emitOrderPaidEvent(
  tx: any,
  orderId: string,
  input: EmitOrderPaidInput = {},
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              typeData: true,
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              skuCode: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  const payload = {
    event: 'order.paid',
    orderId: order.id,
    userId: order.userId,
    order: {
      id: order.id,
      userId: order.userId,
      customerEmail: order.customerEmail,
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.product?.name,
        variantName: item.variant?.name,
        skuCode: item.variant?.skuCode,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        fulfillmentData: parseJsonRecord(item.fulfillmentData),
        productTypeData: parseJsonRecord(item.product?.typeData),
      })),
    },
    payment: {
      paymentId: input.paymentId,
      paymentMethod: input.paymentMethod,
      paymentIntentId: input.paymentIntentId,
      sessionId: input.sessionId,
      providerEventId: input.providerEventId,
    },
    metadata: input.metadata || {},
  };

  await OutboxService.emit(tx, 'order.paid', order.id, payload, {
    actorId: input.actorId || order.userId,
  });

  return payload;
}
