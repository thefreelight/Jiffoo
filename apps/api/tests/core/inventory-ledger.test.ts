/**
 * Inventory ledger behaviour — WP-F5 W2 (phase 2).
 *
 * The stock movement of an order is recorded in the `inventory_adjustments`
 * ledger: placing an order takes stock out of the sellable level (a negative
 * quantity) and cancelling the order puts it back (a positive quantity). The
 * test drives the real order flow against the test database and reads the
 * ledger rows back, so it proves that the rows are really written instead of
 * only proving that a method was called.
 *
 * Only the plugin contract boundaries are replaced. The inventory module, the
 * order module and the database stay real.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

vi.mock('@/core/checkout/service', () => ({
  CheckoutService: { quoteItems: vi.fn() },
}));

vi.mock('@/core/extensions/registry', () => ({
  declaresContract: vi.fn(),
  getAllPluginPackages: vi.fn(),
  getDefaultInstance: vi.fn(),
  listProviders: vi.fn(),
  resolveSingleProvider: vi.fn(),
}));

vi.mock('@/core/extensions/runtime/plugin-runtime', () => ({
  callContract: vi.fn(),
}));

import { prisma } from '@/config/database';
import { systemSettingsService } from '@/core/settings/service';
import { OrderService } from '@/core/order/service';
import { InventoryService } from '@/core/inventory/service';
import { CacheService } from '@/core/cache/service';
import { CheckoutService } from '@/core/checkout/service';
import { resolveSingleProvider } from '@/core/extensions/registry';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { createTestProduct } from '../helpers/fixtures';

const SHIPPING_OPTION_ID = 'free-shipping:free';
const PAYMENT_METHOD = 'manual-payment';
const UNIT_PRICE = 25;

/**
 * The application Prisma client is an extended client (`prisma.$extends(...)`).
 * Its own property descriptors report `undefined`, so `vi.spyOn` refuses to
 * patch it. Overriding the property directly intercepts the call the product
 * code makes on the client and restores the previous value afterwards.
 */
function overridePrismaMethod(target: object, key: string, implementation: (...args: any[]) => any): () => void {
  const original = (target as Record<string, unknown>)[key];
  Object.defineProperty(target, key, { value: implementation, writable: true, configurable: true, enumerable: true });
  return () => { Object.defineProperty(target, key, { value: original, writable: true, configurable: true, enumerable: true }); };
}

describe('inventory ledger', () => {
  let currency = 'USD';
  let productId: string;
  let variantId: string;
  let userId: string;
  let orderId: string | null = null;

  const stockOf = async (id: string): Promise<number> => {
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id }, select: { stock: true } });
    return variant.stock;
  };

  const ledgerRows = async (id: string) =>
    prisma.inventoryAdjustment.findMany({ where: { variantId: id }, orderBy: { createdAt: 'asc' } });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    currency = await systemSettingsService.getShopCurrency();
    const product = await createTestProduct({ price: UNIT_PRICE, stock: 10 });
    productId = product.id;
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id } });
    variantId = variant.id;
    const user = await prisma.user.create({
      data: {
        email: `ledger-${uuidv4()}@example.com`,
        username: `ledger-${uuidv4()}`,
        password: 'not-used-by-this-test',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (orderId) {
      await prisma.order.deleteMany({ where: { id: orderId } });
    }
    await prisma.inventoryAdjustment.deleteMany({ where: { variantId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  beforeEach(() => {
    vi.mocked(CheckoutService.quoteItems).mockResolvedValue({
      currency,
      subtotal: UNIT_PRICE * 2,
      shippingOptions: [{
        id: SHIPPING_OPTION_ID,
        providerSlug: 'free-shipping',
        label: 'Free shipping',
        amount: 0,
        amountMinor: 0,
      }],
      paymentMethods: [{
        providerSlug: PAYMENT_METHOD,
        displayName: 'Manual payment',
        requiresManualConfirmation: true,
      }],
    } as never);
    vi.mocked(resolveSingleProvider).mockResolvedValue(null);
    vi.mocked(callContract).mockResolvedValue({
      unpaidTimeoutMinutes: 30,
      supportedCurrencies: [currency],
    } as never);
  });

  it('records a negative ledger row for the stock an order takes', async () => {
    const created = await OrderService.createOrder(userId, {
      items: [{ productId, variantId, quantity: 2 }],
      shippingAddress: {
        firstName: 'Ledger',
        lastName: 'Tester',
        phone: '+1-555-0101',
        addressLine1: '123 Test St',
        city: 'Test City',
        state: 'CA',
        postalCode: '94016',
        country: 'US',
      },
      currency,
      shippingOptionId: SHIPPING_OPTION_ID,
      paymentMethod: PAYMENT_METHOD,
      expectedTotal: String(UNIT_PRICE * 2),
      idempotencyKey: `ledger-${uuidv4()}`,
    });
    orderId = created.order.id;

    const rows = await ledgerRows(variantId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      variantId,
      quantity: -2,
      type: 'sale',
      reason: 'order_placed',
      referenceId: created.order.id,
      userId,
    });
    expect(rows[0].metadata).toEqual({ orderNumber: created.order.orderNumber });
    expect(await stockOf(variantId)).toBe(8);
  });

  it('records a positive ledger row for the stock a cancelled order returns', async () => {
    expect(orderId).not.toBeNull();
    await OrderService.cancelOrder(orderId as string, userId, 'ledger test');

    const rows = await ledgerRows(variantId);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      variantId,
      quantity: 2,
      type: 'return',
      reason: 'order_cancelled',
      referenceId: orderId,
      userId,
    });
    expect(await stockOf(variantId)).toBe(10);
  });

  it('refuses a decrement that exceeds the available stock and writes no ledger row', async () => {
    const rowsBefore = await ledgerRows(variantId);
    const stockBefore = await stockOf(variantId);

    await expect(prisma.$transaction(async (tx) => {
      await InventoryService.decrementStock(tx, variantId, stockBefore + 1, {
        type: 'sale',
        reason: 'order_placed',
      });
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(await ledgerRows(variantId)).toHaveLength(rowsBefore.length);
    expect(await stockOf(variantId)).toBe(stockBefore);
  });

  it('keeps the optimistic lock: one of two concurrent decrements wins and only one ledger row is written', async () => {
    const rowsBefore = await ledgerRows(variantId);
    const stockBefore = await stockOf(variantId);
    const quantity = Math.floor(stockBefore / 2) + 1;

    const attempt = () => prisma.$transaction(async (tx) => {
      await InventoryService.decrementStock(tx, variantId, quantity, {
        type: 'sale',
        reason: 'order_placed',
      });
    });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter(result => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'BAD_REQUEST' });

    const rows = await ledgerRows(variantId);
    expect(rows).toHaveLength(rowsBefore.length + 1);
    expect(rows[rows.length - 1]).toMatchObject({ variantId, quantity: -quantity, type: 'sale' });
    expect(await stockOf(variantId)).toBe(stockBefore - quantity);
  });

  it('keeps desired stock, its ledger and its outbox event transactional without accessing the cache', async () => {
    const cache = vi.spyOn(CacheService, 'incrementProductVersion').mockResolvedValue(1);
    const stockBefore = await stockOf(variantId);
    const rowsBefore = await ledgerRows(variantId);
    const eventWhere = { aggregateId: productId, type: 'product.updated' };
    const eventsBefore = await prisma.eventRecord.count({ where: eventWhere });
    const rollback = new Error('Abort desired stock transaction');

    await expect(prisma.$transaction(async (tx) => {
      await InventoryService.applyDesiredStock(tx, variantId, stockBefore + 3, {
        type: 'correction', reason: 'cache_boundary_test',
      });
      expect(await tx.inventoryAdjustment.count({ where: { variantId } })).toBe(rowsBefore.length + 1);
      expect(await tx.eventRecord.count({ where: eventWhere })).toBe(eventsBefore + 1);
      expect(cache).not.toHaveBeenCalled();
      throw rollback;
    })).rejects.toBe(rollback);

    expect(await stockOf(variantId)).toBe(stockBefore);
    expect(await ledgerRows(variantId)).toHaveLength(rowsBefore.length);
    expect(await prisma.eventRecord.count({ where: eventWhere })).toBe(eventsBefore);
    expect(cache).not.toHaveBeenCalled();

    await prisma.$transaction(async (tx) => {
      await InventoryService.applyDesiredStock(tx, variantId, stockBefore + 3, {
        type: 'correction', reason: 'cache_boundary_test',
      });
      expect(cache).not.toHaveBeenCalled();
    });
    expect(await stockOf(variantId)).toBe(stockBefore + 3);
    expect(await ledgerRows(variantId)).toHaveLength(rowsBefore.length + 1);
    expect(await prisma.eventRecord.count({ where: eventWhere })).toBe(eventsBefore + 1);
    expect(cache).not.toHaveBeenCalled();
  });

  it('invalidates the cache only after an adjustment and its ledger have committed', async () => {
    const stockBefore = await stockOf(variantId);
    const rowsBefore = await ledgerRows(variantId);
    const transaction = prisma.$transaction.bind(prisma);
    const cache = vi.spyOn(CacheService, 'incrementProductVersion').mockImplementation(async () => {
      expect(await stockOf(variantId)).toBe(stockBefore + 2);
      expect(await ledgerRows(variantId)).toHaveLength(rowsBefore.length + 1);
      return 1;
    });
    const restoreTransaction = overridePrismaMethod(prisma, '$transaction', async (
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>
    ) => {
      restoreTransaction(); // only the next call is intercepted
      return transaction(async (tx) => {
        const result = await callback(tx);
        expect(cache).not.toHaveBeenCalled();
        return result;
      });
    });

    try {
      const result = await InventoryService.adjustStock(variantId, 2, {
        type: 'correction', reason: 'cache_boundary_test',
      });

      expect(result.stock).toBe(stockBefore + 2);
      expect(cache).toHaveBeenCalledTimes(1);
      const rows = await ledgerRows(variantId);
      expect(rows[rows.length - 1]).toMatchObject({ variantId, quantity: 2, type: 'correction' });
    } finally {
      restoreTransaction();
    }
  });

  it('does not invalidate the cache when an adjustment transaction rolls back after its callback', async () => {
    const stockBefore = await stockOf(variantId);
    const rowsBefore = await ledgerRows(variantId);
    const eventWhere = { aggregateId: productId, type: 'product.updated' };
    const eventsBefore = await prisma.eventRecord.count({ where: eventWhere });
    const transaction = prisma.$transaction.bind(prisma);
    const cache = vi.spyOn(CacheService, 'incrementProductVersion').mockResolvedValue(1);
    const rollback = new Error('Abort adjustment before commit');
    const restoreTransaction = overridePrismaMethod(prisma, '$transaction', async (
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>
    ) => {
      restoreTransaction(); // only the next call is intercepted
      return transaction(async (tx) => {
        await callback(tx);
        expect(await tx.inventoryAdjustment.count({ where: { variantId } })).toBe(rowsBefore.length + 1);
        expect(await tx.eventRecord.count({ where: eventWhere })).toBe(eventsBefore + 1);
        expect(cache).not.toHaveBeenCalled();
        throw rollback;
      });
    });

    try {
      await expect(InventoryService.adjustStock(variantId, 2, {
        type: 'correction', reason: 'cache_boundary_test',
      })).rejects.toBe(rollback);

      expect(await stockOf(variantId)).toBe(stockBefore);
      expect(await ledgerRows(variantId)).toHaveLength(rowsBefore.length);
      expect(await prisma.eventRecord.count({ where: eventWhere })).toBe(eventsBefore);
      expect(cache).not.toHaveBeenCalled();
    } finally {
      restoreTransaction();
    }
  });
});
