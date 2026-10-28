import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { runOrderPlacement } from '@/core/order/pipeline';
import { CreateOrderSchema } from '@/core/order/types';
import { systemSettingsService } from '@/core/settings/service';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { getDefaultInstance } from '@/core/extensions/registry';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import {
  createTestProduct,
  deleteAllTestCarts,
  deleteAllTestOrders,
  deleteAllTestProducts,
} from '../helpers/fixtures';
import { checkoutTotal } from '../helpers/checkout-total';
import { restoreBuiltinRows, snapshotPluginRows } from '../helpers/plugin-db-snapshot';

/**
 * The amount of an order is money, and money is not a binary float.
 *
 * The prices 79.99 and 19.99 do not sum exactly in IEEE-754, so a placement
 * that adds them as doubles ends up with 99.97999999999999 and cannot convert
 * that amount into minor units. The basket is valid, so the placement has to
 * place it.
 */
describe('the precision of the amount of an order', () => {
  let app: FastifyInstance;
  let userId: string;
  let userToken: string;
  let firstProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let secondProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let builtinRows: Awaited<ReturnType<typeof snapshotPluginRows>>;
  let currencyBefore: string;

  const builtinSlugs = ['free-shipping', 'manual-payment', 'zero-tax'];

  const shippingAddress = {
    firstName: 'Precision',
    lastName: 'Buyer',
    phone: '+1-555-0104',
    addressLine1: '125 Test St',
    city: 'Test City',
    state: 'CA',
    postalCode: '94016',
    country: 'US',
  };

  beforeAll(async () => {
    builtinRows = await snapshotPluginRows(builtinSlugs);
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    for (const slug of builtinSlugs) {
      const instance = await getDefaultInstance(slug);
      if (instance && !instance.enabled) {
        await PluginManagementService.updateInstance(instance.id, { enabled: true });
      }
    }
    app = await createTestApp();
    const buyer = await createUserWithToken();
    userId = buyer.user.id;
    userToken = buyer.token;
    firstProduct = await createTestProduct({ name: 'Order Precision Test Product', price: 79.99, stock: 50 });
    secondProduct = await createTestProduct({ name: 'Order Precision Second Product', price: 19.99, stock: 50 });
    currencyBefore = await systemSettingsService.getShopCurrency();
    await systemSettingsService.setSetting('localization.currency', 'USD');
  });

  afterAll(async () => {
    await systemSettingsService.setSetting('localization.currency', currencyBefore);
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await restoreBuiltinRows(builtinRows, builtinSlugs);
    await app.close();
  });

  it('places a basket whose prices do not sum exactly in a binary float', async () => {
    const items = [
      { productId: firstProduct.id, variantId: firstProduct.variants[0].id, quantity: 1 },
      { productId: secondProduct.id, variantId: secondProduct.variants[0].id, quantity: 1 },
    ];
    const expectedTotal = await checkoutTotal(app, userToken, items, shippingAddress, 'free-shipping:free');
    expect(expectedTotal).toBe('99.98');

    const data = CreateOrderSchema.parse({
      items,
      shippingAddress,
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      expectedTotal,
      idempotencyKey: randomUUID(),
    });

    const placed = await runOrderPlacement(userId, data);
    expect(placed.replayed).toBe(false);
    const orderId = placed.order.id as string;

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(Number(order.subtotalAmount)).toBe(99.98);
    expect(Number(order.totalAmount)).toBe(99.98);

    const lines = await prisma.orderItem.findMany({ where: { orderId }, orderBy: { unitPrice: 'asc' } });
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => Number(line.unitPrice))).toEqual([19.99, 79.99]);
    // The tax of a line is the tax of that line, and the builtin zero tax
    // provider answers zero for every line.
    expect(lines.map((line) => Number(line.taxAmount))).toEqual([0, 0]);
  });

  it('places a line of three of them and keeps the exact total of the line', async () => {
    const items = [{ productId: firstProduct.id, variantId: firstProduct.variants[0].id, quantity: 3 }];
    const expectedTotal = await checkoutTotal(app, userToken, items, shippingAddress, 'free-shipping:free');
    expect(expectedTotal).toBe('239.97');

    const data = CreateOrderSchema.parse({
      items,
      shippingAddress,
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      expectedTotal,
      idempotencyKey: randomUUID(),
    });

    const placed = await runOrderPlacement(userId, data);
    expect(placed.replayed).toBe(false);
    const orderId = placed.order.id as string;

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(Number(order.subtotalAmount)).toBe(239.97);
    expect(Number(order.totalAmount)).toBe(239.97);

    const lines = await prisma.orderItem.findMany({ where: { orderId } });
    expect(lines).toHaveLength(1);
    expect(Number(lines[0].unitPrice)).toBe(79.99);
    expect(lines[0].quantity).toBe(3);
    expect(Number(lines[0].lineTotal)).toBe(239.97);
  });
});
