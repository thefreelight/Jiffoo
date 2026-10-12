import { emitEvent } from '@/infra/events/emit';
import { readCatalogSnapshot, snapshotProductName } from '@/core/order/catalog-snapshot';

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
      items: true,
      user: { select: { locale: true } },
    },
  });

  if (!order) {
    return null;
  }

  const payload = {
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
        productName: snapshotProductName(readCatalogSnapshot(item.catalogSnapshot), order.user?.locale),
        variantName: readCatalogSnapshot(item.catalogSnapshot).variantName,
        skuCode: readCatalogSnapshot(item.catalogSnapshot).skuCode ?? undefined,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        fulfillmentData: parseJsonRecord(item.fulfillmentData),
        productTypeData: parseJsonRecord(readCatalogSnapshot(item.catalogSnapshot).productTypeData),
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

  await emitEvent(tx, 'order.paid', 1, order.id, payload, {
    actorId: input.actorId || order.userId,
  });

  return payload;
}
