// @ts-nocheck
import type { Prisma, OrderPaymentStatus, OrderStatus } from '@prisma/client';

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

export async function recordOrderStatusHistory(
  tx: Prisma.TransactionClient,
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
