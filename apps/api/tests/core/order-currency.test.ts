/**
 * The currency of an order.
 *
 * The order and its lines store the currency their amounts are in, and the
 * payment of the order is charged in the currency of the order. The store
 * decides the currency, so a store that is not in USD must not fall back to
 * the default of the schema.
 */
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

describe('the currency of an order', () => {
  let app: FastifyInstance;
  let userId: string;
  let userToken: string;
  let firstProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let secondProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let builtinRows: Awaited<ReturnType<typeof snapshotPluginRows>>;
  let currencyBefore: string;

  // The builtin plugins the placement needs: the shipping provider of the
  // quote, the payment provider and the tax provider.
  const builtinSlugs = ['free-shipping', 'manual-payment', 'zero-tax'];

  const shippingAddress = {
    firstName: 'Currency',
    lastName: 'Buyer',
    phone: '+1-555-0103',
    addressLine1: '125 Test St',
    city: 'Test City',
    state: 'CA',
    postalCode: '94016',
    country: 'US',
  };

  beforeAll(async () => {
    // The builtin plugins are shared with the other test files of the shard:
    // their rows are captured before the sync and restored afterwards.
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
    firstProduct = await createTestProduct({ name: 'Order Currency Test Product', price: 79.99, stock: 50 });
    secondProduct = await createTestProduct({ name: 'Order Currency Second Product', price: 19.99, stock: 50 });
    currencyBefore = await systemSettingsService.getShopCurrency();
  });

  afterAll(async () => {
    // The currency of the store is restored, so the next test file of the
    // shard reads the currency it expects.
    await systemSettingsService.setSetting('localization.currency', currencyBefore);
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await restoreBuiltinRows(builtinRows, builtinSlugs);
    await app.close();
  });

  it('stores the currency of the store on the order and on every line', async () => {
    await systemSettingsService.setSetting('localization.currency', 'EUR');
    const items = [
      { productId: firstProduct.id, variantId: firstProduct.variants[0].id, quantity: 1 },
      { productId: secondProduct.id, variantId: secondProduct.variants[0].id, quantity: 2 },
    ];
    const expectedTotal = await checkoutTotal(app, userToken, items, shippingAddress, 'free-shipping:free');
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
    expect(placed.order.currency).toBe('EUR');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.currency).toBe('EUR');

    const lines = await prisma.orderItem.findMany({ where: { orderId } });
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.currency)).toEqual(['EUR', 'EUR']);
  });

  it('refuses a request that names a currency the store does not use', async () => {
    await systemSettingsService.setSetting('localization.currency', 'EUR');
    const buyer = await createUserWithToken();
    const items = [
      { productId: firstProduct.id, variantId: firstProduct.variants[0].id, quantity: 1 },
    ];
    const expectedTotal = await checkoutTotal(app, buyer.token, items, shippingAddress, 'free-shipping:free');
    const data = CreateOrderSchema.parse({
      items,
      shippingAddress,
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      expectedTotal,
      idempotencyKey: randomUUID(),
      currency: 'USD',
    });

    // The currency of the request is an assertion: the store is in EUR, so a
    // request that asks for USD is refused instead of being answered with an
    // order in a currency the customer did not ask for.
    await expect(runOrderPlacement(buyer.user.id, data)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await prisma.order.count({ where: { userId: buyer.user.id } })).toBe(0);
  });
});
