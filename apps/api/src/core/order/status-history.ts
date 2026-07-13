import type { OrderPaymentStatus, OrderStatus } from '@prisma/client';

export type OrderStatusHistoryInput = {
  orderId: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  fromPaymentStatus?: OrderPaymentStatus | null;
  toPaymentStatus?: OrderPaymentStatus | null;
  reason?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Structural client type: callers pass transaction clients from both the base
 * PrismaClient and the $extends'd client, whose nominal types are incompatible.
 */
export type OrderStatusHistoryWriter = {
  orderStatusHistory: {
    create(args: { data: unknown }): Promise<unknown>;
  };
};

export async function recordOrderStatusHistory(
  tx: OrderStatusHistoryWriter,
  input: OrderStatusHistoryInput
): Promise<void> {
  await tx.orderStatusHistory.create({
    data: {
      orderId: input.orderId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      fromPaymentStatus: input.fromPaymentStatus ?? null,
      toPaymentStatus: input.toPaymentStatus ?? null,
      reason: input.reason ?? null,
      actorType: input.actorType ?? null,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
