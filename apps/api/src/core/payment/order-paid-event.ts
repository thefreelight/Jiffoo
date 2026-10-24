import { emitEvent } from '@/infra/events/emit';
import { OrderService } from '@/core/order/service';

type EmitOrderPaidInput = {
  paymentId?: string;
  paymentMethod?: string;
  paymentIntentId?: string | null;
  sessionId?: string | null;
  providerEventId?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string;
};

/**
 * Emit the order.paid event.
 *
 * The payload body is produced by the order module, which owns the order table
 * and the catalog snapshot captured with every order item.
 */
export async function emitOrderPaidEvent(
  tx: any,
  orderId: string,
  input: EmitOrderPaidInput = {},
) {
  const order = await OrderService.getOrderPaidPayload(tx, orderId);

  if (!order) {
    return null;
  }

  const payload = {
    orderId: order.id,
    userId: order.userId,
    order,
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
