import { prisma } from '@/config/database';
import { ApiError, knownPrismaOperation } from '@/utils/api-errors';
import { CacheService } from '@/core/cache/service';
import type { Prisma } from '@prisma/client';
import type { InventoryListItem } from './types';
import { emitEvent, type EventTransaction } from '@/infra/events/emit';
import { productSnapshot } from '@/infra/events/snapshots';

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
 * The stock write itself only covers the `product_variants` update. Applying a
 * desired stock level additionally needs the `inventory_adjustments` insert, the
 * product snapshot read and the outbox writes of the `product.updated` event, so the
 * transaction surface is widened explicitly here. The narrow shape is kept for the
 * callers that only move stock around.
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

/**
 * Read surface required to read the stock level of a set of variants.
 *
 * The plain Prisma client and a transaction client both satisfy it, so a caller
 * that holds a transaction reads the stock inside that transaction and observes
 * its own snapshot, while a caller without one keeps using the global client.
 */
export type InventoryStockReadTx = {
  productVariant: {
    findMany(args: any): Promise<any>;
  };
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

/**
 * The milliseconds an inventory transaction may hold its connection.
 *
 * An inventory transaction takes the lock of the stock row, writes the level,
 * writes its ledger row and writes the outbox event, so the timeout is sized
 * for one stock move.
 */
const INVENTORY_WRITE_TRANSACTION_TIMEOUT_MS = 30_000;

/**
 * The milliseconds an inventory transaction waits for a free connection of the pool.
 */
const INVENTORY_WRITE_TRANSACTION_MAX_WAIT_MS = 10_000;

export class InventoryService {
  /**
   * Apply an absolute stock level to a variant and return the stored level.
   *
   * The write goes through the ledgered path, so it is conditional and it
   * leaves a row in the `inventory_adjustments` ledger. A caller that knows the
   * level it edited passes it as `expectedStock`: the write then only lands
   * when the stored level is still the level the caller saw, and a mismatch is
   * reported as a conflict instead of overwriting a concurrent sale.
   *
   * The product cache is invalidated after the transaction resolved, so the
   * admin product list never serves the level the write replaced.
   *
   * @param variantId Variant whose stock level is set
   * @param quantity Desired absolute stock level
   * @param options `expectedStock` guards the write, `userId` records the actor
   */
  static async setStockById(
    variantId: string,
    quantity: number,
    options: { expectedStock?: number; userId?: string } = {}
  ): Promise<number> {
    const stored = await knownPrismaOperation(() => prisma.$transaction(async tx => {
      const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { productId: true } });
      await this.setStock(tx, variantId, quantity, {
        type: 'correction',
        reason: 'admin_stock_set',
        referenceId: variant.productId,
        ...(options.userId ? { userId: options.userId } : {}),
      }, { expectedStock: options.expectedStock });
      // The level that is stored is read inside the transaction, so the answer
      // is the level this write left behind and not the level that was asked for.
      const level = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
      return level.stock;
    }, { maxWait: INVENTORY_WRITE_TRANSACTION_MAX_WAIT_MS, timeout: INVENTORY_WRITE_TRANSACTION_TIMEOUT_MS }), { notFound: 'NOT_FOUND' });

    // The cache is invalidated after the transaction resolved: a rollback keeps
    // the cache correct, and a reader never repopulates the new version with
    // the state the write replaced.
    await CacheService.incrementProductVersion();
    return stored;
  }
  /**
   * Read the stock level of a set of variants.
   *
   * The reader takes the client it reads through. A caller that holds a
   * transaction hands that transaction in and therefore observes the stock of
   * its own snapshot instead of the level the global client happens to see. A
   * caller without a transaction keeps the global client, so the plain call
   * sites read exactly what they read before.
   *
   * @param variantIds Identifiers of the variants
   * @param client Client the stock is read through (the global client by default)
   */
  static async getAvailableStockByVariantIds(
    variantIds: string[],
    client: InventoryStockReadTx = prisma
  ): Promise<Map<string, number>> {
    if (variantIds.length === 0) return new Map();

    const variants = await client.productVariant.findMany({
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

  /**
   * Apply an absolute stock level to a variant.
   *
   * The write is the ledgered one, so it is conditional and it leaves a row in
   * the `inventory_adjustments` ledger. The name is kept for the callers that
   * ask for an absolute level.
   *
   * @param tx Transaction client owned by the caller
   * @param variantId Variant whose stock level is applied
   * @param quantity Desired absolute stock level
   * @param details Ledger details of the applied change
   * @param options `expectedStock` guards the write against a concurrent change
   */
  static async setStock(
    tx: InventoryLedgerTx,
    variantId: string,
    quantity: number,
    details: InventoryAdjustmentDetails = { type: 'correction', reason: 'stock_set' },
    options: { publishProductChange?: boolean; expectedStock?: number } = {}
  ): Promise<void> {
    await this.applyDesiredStock(tx, variantId, quantity, details, options);
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
   * nothing is written, no ledger row is created and no event is published.
   *
   * The change is applied as a conditional increment on the level the change is
   * based on, so the write never absorbs a concurrent change of the level: when
   * the level moved under the write the update lands on no row and the change
   * is reported as a conflict instead of being applied over the concurrent
   * movement.
   *
   * A caller that passes `expectedStock` asks for a compare-and-set: the write
   * only lands when the stored level is still the level the caller saw, and a
   * mismatch is reported as a conflict instead of being retried over the
   * concurrent change.
   *
   * @param tx Transaction client owned by the caller
   * @param variantId Variant whose stock level is applied
   * @param desiredQuantity Desired absolute stock level
   * @param details Ledger details of the applied change
   * @param options `publishProductChange: false` suppresses the outbox event for
   * callers that already publish the wider product change; `expectedStock` is
   * the level the caller saw and guards the write
   */
  static async applyDesiredStock(
    tx: InventoryLedgerTx,
    variantId: string,
    desiredQuantity: number,
    details: InventoryAdjustmentDetails,
    options: { publishProductChange?: boolean; expectedStock?: number } = {}
  ): Promise<void> {
    const normalized = Math.max(0, Math.trunc(Number(desiredQuantity)));
    const expectedStock = options.expectedStock === undefined
      ? undefined
      : Math.max(0, Math.trunc(Number(options.expectedStock)));

    // The base level is read once: it is the level the requested change is
    // based on, and the whole change is derived from it.
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, stock: true, productId: true },
    }) as { id: string; stock: number; productId: string } | null;
    if (!variant) throw new ApiError('NOT_FOUND');

    if (expectedStock !== undefined && variant.stock !== expectedStock) {
      throw new ApiError('CONFLICT');
    }

    const base = variant.stock;
    const delta = normalized - base;
    if (delta === 0) return;

    // The change is applied as a conditional increment on the base level. An
    // absolute write would absorb a concurrent movement of the level, so the
    // level is moved by the delta instead and the base level is part of the
    // predicate: when the level changed under the write the update lands on no
    // row and the conflict is reported instead of the concurrent change being
    // overwritten.
    const updated = await tx.productVariant.updateMany({
      where: { id: variantId, stock: base },
      data: { stock: { increment: delta } },
    });
    if (updated.count === 0) {
      throw new ApiError('CONFLICT');
    }

    await tx.inventoryAdjustment.create({ data: { variantId, quantity: delta, ...details } });
    if (options.publishProductChange !== false) {
      await emitEvent(tx as unknown as EventTransaction, 'product.updated', 1, variant.productId, await productSnapshot(tx as unknown as EventTransaction, variant.productId));
    }
  }

  /**
   * Apply a signed adjustment to the stock level of a variant.
   *
   * A positive adjustment grows the level and is unaffected by the lower bound.
   * A negative adjustment is bounded in the application: the write carries the
   * lower bound in its predicate, so the level never goes below zero and an
   * adjustment that exceeds the available stock is refused with a clean error
   * instead of being rejected by the database. The ledger row is written once,
   * inside the same transaction as the level it belongs to.
   *
   * The product cache is invalidated after the transaction resolved, so a
   * rollback keeps the cache correct.
   */
  static async adjustStock(
    variantId: string,
    quantity: number,
    details: InventoryAdjustmentDetails
  ) {
    if (!Number.isInteger(quantity) || quantity === 0) throw new ApiError('VALIDATION_ERROR');

    const result = await knownPrismaOperation(() => prisma.$transaction(async (tx) => {
      let variant: { id: string; stock: number; productId: string };
      if (quantity < 0) {
        // The variant is read first, so a missing variant keeps its not-found
        // answer in both directions of the adjustment.
        const known = await tx.productVariant.findUniqueOrThrow({
          where: { id: variantId },
          select: { id: true, stock: true, productId: true },
        });
        const updated = await tx.productVariant.updateMany({
          where: { id: variantId, stock: { gte: -quantity } },
          data: { stock: { decrement: -quantity } },
        });
        if (updated.count === 0) throw new ApiError('INSUFFICIENT_STOCK', { availableQuantity: known.stock });
        variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: variantId },
          select: { id: true, stock: true, productId: true },
        });
      } else {
        variant = await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: { increment: quantity } },
          select: { id: true, stock: true, productId: true },
        });
      }
      await tx.inventoryAdjustment.create({ data: { variantId, quantity, ...details } });
      await emitEvent(tx, 'product.updated', 1, variant.productId, await productSnapshot(tx, variant.productId));
      return variant;
    }, { maxWait: INVENTORY_WRITE_TRANSACTION_MAX_WAIT_MS, timeout: INVENTORY_WRITE_TRANSACTION_TIMEOUT_MS }), { notFound: 'NOT_FOUND' });
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
