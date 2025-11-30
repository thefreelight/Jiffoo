import { prisma } from '@/config/database';

/**
 * 库存服务 - 处理库存预留和确认
 *
 * 🆕 支持变体级库存检查和预留
 * - 如果提供 variantId，使用变体的 baseStock
 * - 如果只提供 productId，使用商品的 stock（向后兼容）
 */
export class InventoryService {
  /**
   * 获取商品的可用库存（实际库存 - 活跃预留）
   * 向后兼容：只检查商品级库存
   */
  static async getAvailableStock(
    productId: string,
    tenantId: number,
    tx?: any
  ): Promise<number> {
    const client = tx || prisma;

    const product = await client.product.findFirst({
      where: { id: productId, tenantId }
    });

    if (!product) return 0;

    // 计算活跃的预留数量（未过期且状态为ACTIVE）
    // 只计算没有 variantId 的预留（商品级预留）
    const reservations = await client.inventoryReservation.aggregate({
      where: {
        productId,
        variantId: null, // 只计算商品级预留
        tenantId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() }
      },
      _sum: { quantity: true }
    });

    const reservedQuantity = reservations._sum.quantity || 0;
    const availableStock = product.stock - reservedQuantity;

    return Math.max(0, availableStock);
  }

  /**
   * 🆕 获取变体的可用库存（变体库存 - 活跃预留）
   */
  static async getVariantAvailableStock(
    variantId: string,
    tenantId: number,
    tx?: any
  ): Promise<number> {
    const client = tx || prisma;

    const variant = await client.productVariant.findFirst({
      where: { id: variantId, tenantId, isActive: true }
    });

    if (!variant) return 0;

    // 计算活跃的预留数量（未过期且状态为ACTIVE）
    const reservations = await client.inventoryReservation.aggregate({
      where: {
        variantId,
        tenantId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() }
      },
      _sum: { quantity: true }
    });

    const reservedQuantity = reservations._sum.quantity || 0;
    const availableStock = variant.baseStock - reservedQuantity;

    return Math.max(0, availableStock);
  }

  /**
   * 批量检查商品库存是否充足
   * 向后兼容：只检查商品级库存
   */
  static async checkStockAvailability(
    items: Array<{ productId: string; quantity: number }>,
    tenantId: number,
    tx?: any
  ): Promise<{ available: boolean; insufficientItems: Array<{ productId: string; requested: number; available: number }> }> {
    const insufficientItems: Array<{ productId: string; requested: number; available: number }> = [];

    for (const item of items) {
      const availableStock = await this.getAvailableStock(item.productId, tenantId, tx);
      if (availableStock < item.quantity) {
        insufficientItems.push({
          productId: item.productId,
          requested: item.quantity,
          available: availableStock
        });
      }
    }

    return {
      available: insufficientItems.length === 0,
      insufficientItems
    };
  }

  /**
   * 🆕 批量检查变体库存是否充足
   */
  static async checkVariantStockAvailability(
    items: Array<{ productId: string; variantId: string; quantity: number }>,
    tenantId: number,
    tx?: any
  ): Promise<{
    available: boolean;
    insufficientItems: Array<{ productId: string; variantId: string; requested: number; available: number }>
  }> {
    const insufficientItems: Array<{ productId: string; variantId: string; requested: number; available: number }> = [];

    for (const item of items) {
      const availableStock = await this.getVariantAvailableStock(item.variantId, tenantId, tx);
      if (availableStock < item.quantity) {
        insufficientItems.push({
          productId: item.productId,
          variantId: item.variantId,
          requested: item.quantity,
          available: availableStock
        });
      }
    }

    return {
      available: insufficientItems.length === 0,
      insufficientItems
    };
  }

  /**
   * 创建库存预留
   * 向后兼容：只创建商品级预留
   * @param tx - 可选的Prisma事务客户端，用于在事务中创建预留
   */
  static async createReservations(
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
    tenantId: number,
    expiresAt: Date,
    tx?: any
  ): Promise<void> {
    const client = tx || prisma;

    const reservations = items.map(item => ({
      orderId,
      productId: item.productId,
      variantId: null, // 商品级预留
      quantity: item.quantity,
      tenantId,
      expiresAt,
      status: 'ACTIVE'
    }));

    await client.inventoryReservation.createMany({
      data: reservations
    });
  }

  /**
   * 🆕 创建变体级库存预留
   * @param tx - 可选的Prisma事务客户端，用于在事务中创建预留
   */
  static async createVariantReservations(
    orderId: string,
    items: Array<{ productId: string; variantId: string; quantity: number }>,
    tenantId: number,
    expiresAt: Date,
    tx?: any
  ): Promise<void> {
    const client = tx || prisma;

    const reservations = items.map(item => ({
      orderId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      tenantId,
      expiresAt,
      status: 'ACTIVE'
    }));

    await client.inventoryReservation.createMany({
      data: reservations
    });
  }
  
  /**
   * 确认库存预留（支付成功后调用）
   * 扣减实际库存并标记预留为已确认
   * 🆕 支持变体级库存扣减
   */
  static async confirmReservations(orderId: string): Promise<void> {
    const reservations = await prisma.inventoryReservation.findMany({
      where: { orderId, status: 'ACTIVE' }
    });

    for (const reservation of reservations) {
      if (reservation.variantId) {
        // 🆕 变体级预留：扣减变体库存
        await prisma.productVariant.update({
          where: { id: reservation.variantId },
          data: { baseStock: { decrement: reservation.quantity } }
        });
      } else {
        // 商品级预留：扣减商品库存（向后兼容）
        await prisma.product.update({
          where: { id: reservation.productId, tenantId: reservation.tenantId },
          data: { stock: { decrement: reservation.quantity } }
        });
      }

      // 标记预留为已确认
      await prisma.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: 'CONFIRMED' }
      });
    }
  }
  
  /**
   * 释放库存预留（订单取消或过期时调用）
   */
  static async releaseReservations(orderId: string): Promise<void> {
    await prisma.inventoryReservation.updateMany({
      where: { orderId, status: 'ACTIVE' },
      data: { status: 'RELEASED' }
    });
  }
  
  /**
   * 批量释放过期的库存预留（定时任务调用）
   */
  static async releaseExpiredReservations(): Promise<number> {
    const now = new Date();
    
    const result = await prisma.inventoryReservation.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now }
      },
      data: {
        status: 'RELEASED'
      }
    });
    
    return result.count;
  }
}

