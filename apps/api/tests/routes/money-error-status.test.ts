/**
 * The money error contract of the order placement and the checkout quote.
 *
 * A bad amount is a validation failure of the request, not an internal error:
 * the order placement and the checkout quote answer it with the validation
 * error of the repository. The money module keeps its own diagnostic, the
 * reason and the detail of the amount it could not convert, and stays free of
 * HTTP semantics.
 *
 * These tests pin that contract change (500 -> 400) on the two main flows
 * that convert amounts.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { getDefaultInstance } from '@/core/extensions/registry';
import { systemSettingsService } from '@/core/settings/service';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import {
  createCartWithItems,
  createTestProduct,
  deleteAllTestCarts,
  deleteAllTestProducts,
} from '../helpers/fixtures';
import { restoreBuiltinRows, snapshotPluginRows } from '../helpers/plugin-db-snapshot';

describe('the money error contract of the order and the checkout quote', () => {
  let app: FastifyInstance;
  let user: { id: string };
  let token: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testVariantId: string;
  let builtinRows: Awaited<ReturnType<typeof snapshotPluginRows>>;
  let currencyBefore: string;

  // The builtin plugins the flows need: the shipping provider of the quote,
  // the payment provider and the tax provider.
  const builtinSlugs = ['free-shipping', 'manual-payment', 'zero-tax'];

  const shippingAddress = {
    firstName: 'Money',
    lastName: 'Error',
    phone: '+1-555-0103',
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
      if (instance && !instance.enabled) await PluginManagementService.updateInstance(instance.id, { enabled: true });
    }
    app = await createTestApp();
    const buyer = await createUserWithToken();
    user = buyer.user;
    token = buyer.token;
    // A price of two decimals: the amount of a line of three of them is not
    // representable in the minor units of the currency.
    testProduct = await createTestProduct({ name: 'Money Error Test Product', price: 79.99, stock: 50 });
    testVariantId = testProduct.variants[0].id;
    await createCartWithItems(user, [testProduct]);
    currencyBefore = await systemSettingsService.getShopCurrency();
  });

  afterAll(async () => {
    await systemSettingsService.setSetting('localization.currency', currencyBefore);
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await restoreBuiltinRows(builtinRows, builtinSlugs);
    await app.close();
  });

  it('answers a bad amount of the checkout quote with the validation error', async () => {
    // A currency without decimals cannot carry the price of the cart.
    await systemSettingsService.setSetting('localization.currency', 'JPY');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/checkout/quote',
      headers: { authorization: `Bearer ${token}` },
      payload: { shippingAddress },
    });
    expect(response.statusCode).toBe(400);
    expect(response.statusCode).toBeLessThan(500);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(response.json().error.code).not.toBe('INTERNAL_SERVER_ERROR');
    await systemSettingsService.setSetting('localization.currency', currencyBefore);
  });

  it('answers a bad amount of the order placement with the validation error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 3 }],
        shippingAddress,
        shippingOptionId: 'free-shipping:free',
        paymentMethod: 'manual-payment',
        expectedTotal: '239.97',
        idempotencyKey: randomUUID(),
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.statusCode).toBeLessThan(500);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(response.json().error.code).not.toBe('INTERNAL_SERVER_ERROR');
  });
});
