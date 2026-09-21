import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import type { InventoryListItem } from './types';

export type InventoryStockTx = {
  productVariant: {
    update(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
  };
};

export class InventoryService {
  static async getAvailableStockByVariantIds(variantIds: string[]): Promise<Map<string, number>> {
    if (variantIds.length === 0) return new Map();

    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, stock: true },
    });
    return new Map(variants.map((variant) => [variant.id, variant.stock]));
  }

  static async getVariantIdsByAvailability(options: {
    minAvailable?: number;
    maxAvailable?: number;
    onlyActiveVariants?: boolean;
  }): Promise<string[]> {
    const { minAvailable, maxAvailable, onlyActiveVariants } = options;
    if (minAvailable === undefined && maxAvailable === undefined) return [];

    const variants = await prisma.productVariant.findMany({
      where: {
        ...(onlyActiveVariants ? { isActive: true } : {}),
        stock: {
          ...(minAvailable !== undefined ? { gte: minAvailable } : {}),
          ...(maxAvailable !== undefined ? { lte: maxAvailable } : {}),
        },
      },
      select: { id: true },
    });
    return variants.map((variant) => variant.id);
  }

  static async decrementStock(tx: InventoryStockTx, variantId: string, quantity: number): Promise<void> {
    const result = await tx.productVariant.updateMany({
      where: { id: variantId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (result.count === 0) throw new Error('Insufficient stock');
  }

  static async incrementStock(tx: InventoryStockTx, variantId: string, quantity: number): Promise<void> {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: { increment: quantity } },
    });
  }

  static async setStock(tx: InventoryStockTx, variantId: string, quantity: number): Promise<void> {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: Math.max(0, Math.trunc(quantity)) },
    });
  }

  static async adjustStock(
    variantId: string,
    quantity: number,
    details: { type: string; reason?: string; notes?: string; userId?: string; referenceId?: string; metadata?: unknown }
  ) {
    if (!Number.isInteger(quantity) || quantity === 0) throw new Error('Quantity must be a non-zero integer');

    return prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: { increment: quantity } },
        select: { id: true, stock: true },
      });
      await tx.inventoryAdjustment.create({ data: { variantId, quantity, ...details } });
      await CacheService.incrementProductVersion();
      return variant;
    });
  }

  static async listStock(page = 1, limit = 20): Promise<{ items: InventoryListItem[]; page: number; limit: number; total: number; totalPages: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [items, total] = await Promise.all([
      prisma.productVariant.findMany({
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        select: { id: true, name: true, skuCode: true, stock: true, product: { select: { id: true, name: true } } },
        orderBy: [{ product: { name: 'asc' } }, { sortOrder: 'asc' }],
      }),
      prisma.productVariant.count(),
    ]);
    return { items, page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) };
  }
}
