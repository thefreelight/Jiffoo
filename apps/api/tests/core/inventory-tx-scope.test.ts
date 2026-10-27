/**
 * Transaction scope of the stock the sellable catalogue reports.
 *
 * The inventory module owns `product_variants.stock` and exposes it through its
 * public stock reader. The product module owns the catalogue projection, so the
 * projection must report the stock of the client it reads through: a catalogue
 * read inside a transaction has to observe the stock of that transaction, not
 * the level the global client happens to see.
 *
 * The test drives the real inventory and product modules against the test
 * database. It opens a transaction, takes stock out of the sellable level
 * through the public stock writer and then reads the catalogue projection of
 * the same product through the same transaction.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { prisma } from '@/config/database';
import { InventoryService } from '@/core/inventory/service';
import { ProductService } from '@/core/product/service';
import { createTestProduct } from '../helpers/fixtures';

const INITIAL_STOCK = 10;
const DECREMENT = 3;

describe('inventory transaction scope', () => {
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    const product = await createTestProduct({ price: 25, stock: INITIAL_STOCK });
    productId = product.id;
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id } });
    variantId = variant.id;
  });

  afterAll(async () => {
    await prisma.inventoryAdjustment.deleteMany({ where: { variantId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  });

  it('reports the stock of the caller transaction in the catalogue projection', async () => {
    const observed = await prisma.$transaction(async (tx) => {
      await InventoryService.decrementStock(tx, variantId, DECREMENT, {
        type: 'sale',
        reason: 'tx_scope_test',
      });

      const catalog = await ProductService.getSellableCatalog(tx, [productId]);
      const projected = catalog.get(productId)?.variants.find((variant) => variant.id === variantId)?.stock;

      // The global client cannot see the uncommitted write of the transaction,
      // so it still reports the level that was committed before it.
      const outside = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { stock: true },
      });

      return { projected, outside: outside?.stock };
    });

    expect(observed.projected).toBe(INITIAL_STOCK - DECREMENT);
    expect(observed.outside).toBe(INITIAL_STOCK);
  });

  it('reports the committed stock on the plain read path', async () => {
    const committed = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    });

    const catalog = await ProductService.getSellableCatalog(prisma, [productId]);
    const projected = catalog.get(productId)?.variants.find((variant) => variant.id === variantId)?.stock;

    expect(projected).toBe(committed.stock);
  });
});
