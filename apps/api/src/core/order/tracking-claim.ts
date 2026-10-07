import { Prisma } from '@prisma/client';
import { ApiError, type ErrorCode } from '@/utils/api-errors';
import { prisma } from '@/config/database';

export class TrackingClaimError extends ApiError {
  constructor(_statusCode: 404 | 409, code: ErrorCode, _message: string) {
    super(code);
  }
}

export async function claimOrderPurchase(id: string, userId: string): Promise<{ claimed: boolean }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Serialize the status read with cancellation/refund updates on this order.
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE`;
      const order = await tx.order.findFirst({ where: { id, userId }, select: { status: true } });
      if (!order) throw new TrackingClaimError(404, 'NOT_FOUND', 'Order not found');
      if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
        throw new TrackingClaimError(409, 'PURCHASE_TRACKING_UNAVAILABLE', 'Cancelled or refunded orders cannot claim purchase tracking');
      }
      await tx.orderPurchaseClaim.create({ data: { orderId: id } });
      return { claimed: true };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { claimed: false };
    }
    throw error;
  }
}
