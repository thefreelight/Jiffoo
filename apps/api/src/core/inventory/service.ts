import { prisma } from '@/config/database';
import { ApiError, knownPrismaOperation } from '@/utils/api-errors';
import { CacheService } from '@/core/cache/service';
import type { Prisma } from '@prisma/client';
import type { InventoryListItem } from './types';
import { emitEvent, type EventTransaction } from '@/infra/events/emit';
import { productSnapshot } from '@/infra/events/snapshots';

export type InventoryStockTx = {
  productVariant: {
    update(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
  };
};

/**
 * Transaction shape required by a stock move that is recorded in the ledger.
 *
 * The members are named one by one: the stock move writes the `product_variants`
 * stock level and the `inventory_adjustments` ledger row inside the caller's
 * transaction, and both writes use the same variant and the same quantity.
 */
export type InventoryLedgerStockTx = {
  productVariant: {
    update(args: {
      where: { id: string };
      data: { stock: { increment: number } };
    }): Promise<{ id: string }>;
    updateMany(args: {
      where: { id: string; stock: { gte: number } };
      data: { stock: { decrement: number } };
    }): Promise<{ count: number }>;
  };
  inventoryAdjustment: {
    create(args: {
      data: {
        variantId: string;
        quantity: number;
        type: string;
        reason?: string;
        notes?: string;
        userId?: string;
        referenceId?: string;
        metadata?: Prisma.InputJsonValue;
      };
    }): Promise<{ id: string; variantId: string; quantity: number; type: string }>;
  };
};

/**
 * Transaction shape required by the ledger aware stock write.
 *
 * `InventoryStockTx` only covers the `product_variants` write itself. Applying a
 * desired stock level additionally needs the `inventory_adjustments` insert, the
 * product snapshot read and the outbox writes of the `product.updated` event, so the
 * transaction surface is widened explicitly here. The narrow shape is kept for the
 * existing callers that only move stock around.
 */
export type InventoryLedgerTx = {
  productVariant: {
    findUnique(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
  };
  inventoryAdjustment: {
    create(args: any): Promise<any>;
  };
  $queryRaw: (...args: any[]) => Promise<any>;
};

/** Details recorded next to every inventory ledger row. */
export type InventoryAdjustmentDetails = {
  type: string;
  reason?: string;
  notes?: string;
  userId?: string;
  referenceId?: string;
  metadata?: Prisma.InputJsonValue;
};

export class InventoryService {
  static async setStockById(variantId: string, quantity: number): Promise<void> {
    await knownPrismaOperation(() => prisma.$transaction(async tx => {
      const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { productId: true } });
      await this.setStock(tx, variantId, quantity);
      await emitEvent(tx, 'product.updated', 1, variant.productId, await productSnapshot(tx, variant.productId));
    }), { notFound: 'NOT_FOUND' });
  }
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

  /**
   * Take stock out of the sellable level and record the movement in the ledger.
   *
   * The stock write itself is unchanged: the same conditional update with the same
   * optimistic lock predicate and the same error when the level is not sufficient.
   * The ledger row is an additional side effect of the move, written in the
   * caller's transaction, with the same columns and the same signed quantity
   * convention as the other ledger paths: a stock decrease is a negative quantity.
   *
   * @param tx Transaction client owned by the caller
   * @param variantId Variant whose stock level is decreased
   * @param quantity Amount taken out of the sellable level
   * @param details Ledger details of the movement
   */
  static async decrementStock(tx: InventoryLedgerStockTx, variantId: string, quantity: number, details: InventoryAdjustmentDetails): Promise<void> {
    const result = await tx.productVariant.updateMany({
      where: { id: variantId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (result.count === 0) throw new ApiError('BAD_REQUEST');
    await tx.inventoryAdjustment.create({ data: { variantId, quantity: -quantity, ...details } });
  }

  /**
   * Put stock back into the sellable level and record the movement in the ledger.
   *
   * The stock write itself is unchanged: the same absolute update on the same
   * column. The ledger row is an additional side effect of the move, written in
   * the caller's transaction, with the same columns and the same signed quantity
   * convention as the other ledger paths: a stock increase is a positive quantity.
   *
   * @param tx Transaction client owned by the caller
   * @param variantId Variant whose stock level is increased
   * @param quantity Amount put back into the sellable level
   * @param details Ledger details of the movement
   */
  static async incrementStock(tx: InventoryLedgerStockTx, variantId: string, quantity: number, details: InventoryAdjustmentDetails): Promise<void> {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: { increment: quantity } },
    });
    await tx.inventoryAdjustment.create({ data: { variantId, quantity, ...details } });
  }

  static async setStock(tx: InventoryStockTx, variantId: string, quantity: number): Promise<void> {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: Math.max(0, Math.trunc(quantity)) },
    });
  }

  /**
   * Apply an absolute desired stock level inside the caller's transaction.
   *
   * The inventory module owns `product_variants.stock`, so a caller that only knows
   * the desired level (for example the admin product editor) must not write the
   * column itself. The level is normalised like `setStock` does, the change is
   * recorded in the `inventory_adjustments` ledger, the `product.updated` event is
   * written to the transactional outbox with the product snapshot. The caller
   * must invalidate the product cache only after its transaction commits.
   *
   * The write is idempotent: when the desired level already matches the stored one
   * nothing is written, no ledger row is created and no event is published. The
   * conditional update carries the expected prior level, so a concurrent stock
   * change is detected instead of being overwritten.
   *
   * @param tx Transaction client owned by the caller
   * @param variantId Variant whose stock level is applied
   * @param desiredQuantity Desired absolute stock level
   * @param details Ledger details of the applied change
   * @param options `publishProductChange: false` suppresses the outbox event for
   * callers that already publish the wider product change
   */
  static async applyDesiredStock(
    tx: InventoryLedgerTx,
    variantId: string,
    desiredQuantity: number,
    details: InventoryAdjustmentDetails,
    options: { publishProductChange?: boolean } = {}
  ): Promise<void> {
    const normalized = Math.max(0, Math.trunc(Number(desiredQuantity)));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, stock: true, productId: true },
      }) as { id: string; stock: number; productId: string } | null;
      if (!variant) throw new ApiError('NOT_FOUND');

      const delta = normalized - variant.stock;
      if (delta === 0) return;

      const updated = await tx.productVariant.updateMany({
        where: { id: variantId, stock: variant.stock },
        data: { stock: normalized },
      });
      if (updated.count === 0) continue;

      await tx.inventoryAdjustment.create({ data: { variantId, quantity: delta, ...details } });
      if (options.publishProductChange !== false) {
        await emitEvent(tx as unknown as EventTransaction, 'product.updated', 1, variant.productId, await productSnapshot(tx as unknown as EventTransaction, variant.productId));
      }
      return;
    }

    throw new ApiError('CONFLICT');
  }

  static async adjustStock(
    variantId: string,
    quantity: number,
    details: InventoryAdjustmentDetails
  ) {
    if (!Number.isInteger(quantity) || quantity === 0) throw new ApiError('VALIDATION_ERROR');

    const result = await knownPrismaOperation(() => prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: { increment: quantity } },
        select: { id: true, stock: true, productId: true },
      });
      await tx.inventoryAdjustment.create({ data: { variantId, quantity, ...details } });
      await emitEvent(tx, 'product.updated', 1, variant.productId, await productSnapshot(tx, variant.productId));
      return variant;
    }), { notFound: 'NOT_FOUND' });
    await CacheService.incrementProductVersion();
    return result;
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
