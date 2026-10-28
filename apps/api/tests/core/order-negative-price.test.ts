/**
 * A price that is not a price is refused by the placement.
 *
 * A negative price makes the amount of the line negative, and the amount of
 * an order is never negative. The placement has to refuse the price itself:
 * the customer gets a validation failure that names the product, and no
 * order row is written with a negative line.
 *
 * The administration refuses the same price on the way in, so a negative
 * price never reaches the catalog.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { runOrderPlacement } from '@/core/order/pipeline';
import { CreateOrderSchema } from '@/core/order/types';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { getDefaultInstance } from '@/core/extensions/registry';
import { systemSettingsService } from '@/core/settings/service';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import {
  createTestProduct,
  deleteAllTestCarts,
  deleteAllTestOrders,
  deleteAllTestProducts,
} from '../helpers/fixtures';
import { restoreBuiltinRows, snapshotPluginRows } from '../helpers/plugin-db-snapshot';

describe('a price that is not a price', () => {
  let app: FastifyInstance;
  let userId: string;
  let userToken: string;
  let adminToken: string;
  let negativeProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let positiveProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let builtinRows: Awaited<ReturnType<typeof snapshotPluginRows>>;
  let currencyBefore: string;

  // The builtin plugins the placement needs: the shipping provider of the
  // quote, the payment provider and the tax provider.
  const builtinSlugs = ['free-shipping', 'manual-payment', 'zero-tax'];

  const shippingAddress = {
    firstName: 'Negative',
    lastName: 'Price',
    phone: '+1-555-0105',
    addressLine1: '126 Test St',
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
    const admin = await createAdminWithToken();
    adminToken = admin.token;
    negativeProduct = await createTestProduct({ name: 'Negative Price Test Product', price: -10, stock: 50 });
    positiveProduct = await createTestProduct({ name: 'Positive Price Test Product', price: 20, stock: 50 });
    currencyBefore = await systemSettingsService.getShopCurrency();
    await systemSettingsService.setSetting('localization.currency', 'USD');
  });

  afterAll(async () => {
    await systemSettingsService.setSetting('localization.currency', currencyBefore);
    // The orders are deleted before the carts and the products, so the lines
    // of an order never keep a variant of a deleted product alive.
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await restoreBuiltinRows(builtinRows, builtinSlugs);
    await app.close();
  });

  it('refuses the placement of a line with a negative price with a validation failure', async () => {
    const items = [{ productId: negativeProduct.id, variantId: negativeProduct.variants[0].id, quantity: 1 }];
    const data = CreateOrderSchema.parse({
      items,
      shippingAddress,
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      // The expected total of a request is never negative, so the request
      // carries the neutral total: the price of the line is what is refused.
      expectedTotal: '0.00',
      idempotencyKey: randomUUID(),
    });

    await expect(runOrderPlacement(userId, data)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
  });

  it('answers the request of a line with a negative price with the validation error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items: [{ productId: negativeProduct.id, variantId: negativeProduct.variants[0].id, quantity: 1 }],
        shippingAddress,
        shippingOptionId: 'free-shipping:free',
        paymentMethod: 'manual-payment',
        expectedTotal: '0.00',
        idempotencyKey: randomUUID(),
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.statusCode).not.toBe(500);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
  });

  it('refuses the placement when a positive line compensates the negative one', async () => {
    const items = [
      { productId: negativeProduct.id, variantId: negativeProduct.variants[0].id, quantity: 1 },
      { productId: positiveProduct.id, variantId: positiveProduct.variants[0].id, quantity: 1 },
    ];
    const data = CreateOrderSchema.parse({
      items,
      shippingAddress,
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      // The total of the order is positive, so the request reaches the write
      // of the order: the negative price has to be refused before that write.
      expectedTotal: '10.00',
      idempotencyKey: randomUUID(),
    });

    await expect(runOrderPlacement(userId, data)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
  });

  it('refuses a variant with a negative price in the administration', async () => {
    const headers = { authorization: `Bearer ${adminToken}` };
    // The same payload with a price that is a price is accepted, so the
    // rejection below is the price and not the shape of the payload.
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/products/',
      headers,
      payload: {
        name: 'Admin Price Test Product',
        variants: [{ name: 'Base Variant', salePrice: 5, stock: 10 }],
      },
    });
    expect([200, 201]).toContain(accepted.statusCode);

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/products/',
      headers,
      payload: {
        name: 'Negative Price Admin Test Product',
        variants: [{ name: 'Base Variant', salePrice: -5, stock: 10 }],
      },
    });

    expect(created.statusCode).toBe(400);
    expect(created.statusCode).not.toBe(500);
    expect(created.json().error.code).toBe('VALIDATION_ERROR');

    const legacy = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/products/',
      headers,
      payload: {
        name: 'Negative Price Legacy Admin Test Product',
        variants: [{ name: 'Base Variant', basePrice: -5, stock: 10 }],
      },
    });

    expect(legacy.statusCode).toBe(400);
    expect(legacy.json().error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.product.count({ where: { name: { in: ['Negative Price Admin Test Product', 'Negative Price Legacy Admin Test Product'] } } })).toBe(0);
  });
});
