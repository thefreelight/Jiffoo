/**
 * Orders Endpoints Tests
 * 
 * Coverage:
 * - POST /api/v1/orders/
 * - GET /api/v1/orders/
 * - GET /api/v1/orders/:id
 * - POST /api/v1/orders/:id/cancel
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import {
  createTestProduct,
  deleteAllTestProducts,
  deleteAllTestOrders,
  deleteAllTestCarts,
} from '../helpers/fixtures';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { prisma } from '@/config/database';
import { decimalToMinor } from '@/core/payment/minor-units';
import { checkoutPaymentFixtureSource, installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { OrderService } from '@/core/order/service';
import { applyNormalizedPluginWebhook } from '@/core/payment/plugin-webhook';

describe('Orders Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let adminUserId: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testVariantId: string;
  const validShippingAddress = {
    firstName: 'Test',
    lastName: 'User',
    phone: '+1-555-0101',
    addressLine1: '123 Test St',
    city: 'Test City',
    state: 'CA',
    postalCode: '94016',
    country: 'US',
  };
  const checkoutSelection = {
    shippingOptionId: 'free-shipping:free',
    paymentMethod: 'manual-payment',
  };
  const fixtureSlugs: string[] = [];

  const fixtureOptions = () => ({ app, adminToken, adminUserId });

  async function installFixture(
    slug: string,
    category: 'shipping' | 'tax' | 'payment',
    source: string,
  ): Promise<void> {
    fixtureSlugs.push(slug);
    await installFixturePlugin(fixtureOptions(), slug, category, [{ name: category, version: 1 }], source);
  }

  async function resetFixtures(): Promise<void> {
    const zeroTax = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: 'zero-tax', instanceKey: 'default' } },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/extensions/plugin/zero-tax/instances/${zeroTax.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { enabled: true },
    });
    while (fixtureSlugs.length) await removeFixturePlugin(fixtureOptions(), fixtureSlugs.pop()!);
  }

  async function createCheckoutOrder(paymentMethod = 'manual-payment'): Promise<string> {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` },
      payload: { items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 1 }], shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free', paymentMethod },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data.id as string;
  }

  async function createCheckoutSession(orderId: string, paymentMethod: string): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/api/v1/payments/create-session', headers: { authorization: `Bearer ${userToken}` }, payload: { orderId, paymentMethod, idempotencyKey: `timeout:${orderId}` } });
    expect(response.statusCode).toBe(200);
    return response.json().data.sessionId as string;
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    const { token, user } = await createUserWithToken();
    userToken = token;
    userId = user.id;
    const admin = await createAdminWithToken();
    adminToken = admin.token;
    adminUserId = admin.user.id;

    testProduct = await createTestProduct({
      name: 'Order Test Product',
      price: 79.99,
      stock: 100,
    });
    testVariantId = testProduct.variants[0].id;

  });

  afterAll(async () => {
    await resetFixtures();
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  describe('POST /api/v1/orders/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty items array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [],
        },
      });

      // Empty items should fail validation
      expect([400, 422]).toContain(response.statusCode);
    });

    it('should create order with valid items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 2 },
          ],
          shippingAddress: validShippingAddress,
          ...checkoutSelection,
        },
      });

      expect([200, 201]).toContain(response.statusCode);

      if (response.statusCode === 200 || response.statusCode === 201) {
        const body = response.json();
        expect(body.data).toHaveProperty('id');
      }
    });

    it('should return 400/404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: fakeProductId, variantId: uuidv4(), quantity: 1 },
          ],
        },
      });

      expect([400, 404]).toContain(response.statusCode);
    });

    it('should support shipping address', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
          shippingAddress: validShippingAddress,
          ...checkoutSelection,
        },
      });

      expect([200, 201]).toContain(response.statusCode);
    });

  });

  describe('POST /api/v1/checkout/quote', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'DELETE',
        url: '/api/v1/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
      });
    });

    it('aggregates builtin and enabled shipping providers with builtin manual payment', async () => {
      await installFixture('checkout-shipping-fixture', 'shipping', "module.exports = { register(ctx) { ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [{ id: 'standard', label: 'Fixture shipping', amountMinor: 500, estimatedDays: { min: 2, max: 4 } }] }) }); } };");
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/checkout/quote',
          headers: { authorization: `Bearer ${userToken}` },
          payload: { shippingAddress: validShippingAddress },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data).toMatchObject({
          shippingOptions: expect.arrayContaining([
            expect.objectContaining({ id: 'free-shipping:free', amount: '0.00' }),
            expect.objectContaining({ id: 'checkout-shipping-fixture:standard', amount: '5.00' }),
          ]),
          paymentMethods: expect.arrayContaining([expect.objectContaining({ providerSlug: 'manual-payment', requiresManualConfirmation: true })]),
        });
      } finally {
        await resetFixtures();
      }
    });

    it('enabling an installed tax plugin replaces zero-tax through the Admin endpoint', async () => {
      await installFixture('checkout-replacement-tax', 'tax', "module.exports = { register(ctx) { ctx.contracts.implement('tax', 1, { calculate: (input) => ({ pricesIncludeTax: false, lines: input.lines.map((line) => ({ lineId: line.lineId, taxMinor: 0 })), shippingTaxMinor: 0, totalTaxMinor: 0 }) }); } };");
      try {
        const zeroTax = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: 'zero-tax', instanceKey: 'default' } } });
        const replacement = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: 'checkout-replacement-tax', instanceKey: 'default' } } });
        expect(zeroTax.enabled).toBe(false);
        expect(replacement.enabled).toBe(true);
      } finally { await resetFixtures(); }
    });

    it('keeps a builtin disabled by Admin replacement after a second startup sync', async () => {
      expect((await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: 'zero-tax', instanceKey: 'default' } } })).enabled).toBe(true);
      await installFixture('checkout-restart-tax', 'tax', "module.exports = { register(ctx) { ctx.contracts.implement('tax', 1, { calculate: (input) => ({ pricesIncludeTax: false, lines: input.lines.map((line) => ({ lineId: line.lineId, taxMinor: 0 })), shippingTaxMinor: 0, totalTaxMinor: 0 }) }); } };");
      try {
        await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
        expect((await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: 'zero-tax', instanceKey: 'default' } } })).enabled).toBe(false);
      } finally { await resetFixtures(); }
    });

    it('returns tax and total for a selected shipping option', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout/quote',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({ tax: '0.00', taxInclusive: false, total: '79.99' });
    });

    it('checkout quote and order creation produce identical totals for the same items and selections', async () => {
      const quoteResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout/quote',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free' },
      });
      expect(quoteResponse.statusCode).toBe(200);
      const quote = quoteResponse.json().data as { subtotal: string; tax: string; taxInclusive: boolean; total: string };

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 1 }],
          shippingAddress: validShippingAddress,
          ...checkoutSelection,
        },
      });
      expect(orderResponse.statusCode).toBe(201);
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderResponse.json().data.id },
        include: { items: true },
      });

      expect(decimalToMinor(order.subtotalAmount.toString(), order.currency)).toBe(decimalToMinor(quote.subtotal, quoteResponse.json().data.currency));
      expect(decimalToMinor(order.shippingAmount.toString(), order.currency)).toBe(0);
      expect(decimalToMinor(order.taxAmount.toString(), order.currency)).toBe(decimalToMinor(quote.tax, quoteResponse.json().data.currency));
      expect(decimalToMinor(order.items[0].taxAmount.toString(), order.currency)).toBe(0);
      expect(order.taxInclusive).toBe(quote.taxInclusive);
      expect(decimalToMinor(order.totalAmount.toString(), order.currency)).toBe(decimalToMinor(quote.total, quoteResponse.json().data.currency));
    });

    it('stores exclusive tax, shipping, payment method, and manual-payment expiry from contracts', async () => {
      await installFixture('checkout-exclusive-tax', 'tax', "module.exports = { register(ctx) { ctx.contracts.implement('tax', 1, { calculate: (input) => { const lines = input.lines.map((line) => ({ lineId: line.lineId, taxMinor: Math.round(line.amountMinor * 0.1) })); const shippingTaxMinor = Math.round(input.shippingAmountMinor * 0.1); return { pricesIncludeTax: false, lines, shippingTaxMinor, totalTaxMinor: lines.reduce((total, line) => total + line.taxMinor, shippingTaxMinor) }; } }); } };");
      await installFixture('checkout-paid-shipping', 'shipping', "module.exports = { register(ctx) { ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [{ id: 'standard', label: 'Paid shipping', amountMinor: 500 }] }) }); } };");
      const before = Date.now();
      try {
        const quoteResponse = await app.inject({ method: 'POST', url: '/api/v1/checkout/quote', headers: { authorization: `Bearer ${userToken}` }, payload: { shippingAddress: validShippingAddress, shippingOptionId: 'checkout-paid-shipping:standard' } });
        expect(quoteResponse.statusCode).toBe(200);
        expect(quoteResponse.json().data).toMatchObject({ subtotal: '79.99', tax: '8.50', taxInclusive: false, total: '93.49' });
        const response = await app.inject({ method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` }, payload: { items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 1 }], shippingAddress: validShippingAddress, shippingOptionId: 'checkout-paid-shipping:standard', paymentMethod: 'manual-payment' } });
        expect(response.statusCode).toBe(201);
        expect(response.json().data).toMatchObject({
          subtotalAmount: 79.99, shippingAmount: 5, taxAmount: 8.5, taxInclusive: false,
          totalAmount: 93.49, paymentMethod: 'manual-payment',
          shippingMethod: { providerSlug: 'checkout-paid-shipping', optionId: 'standard', label: 'Paid shipping', amountMinor: 500 },
          items: [expect.objectContaining({ taxAmount: 8 })],
        });
        expect(new Date(response.json().data.unpaidExpiresAt).getTime()).toBeGreaterThanOrEqual(before + 4320 * 60_000);
        const order = await prisma.order.findUniqueOrThrow({ where: { id: response.json().data.id }, include: { items: true } });
        expect(order.shippingAmount.toString()).toBe('5');
        expect(order.taxAmount.toString()).toBe('8.5');
        expect(order.totalAmount.toString()).toBe('93.49');
        expect(order.items[0].taxAmount.toString()).toBe('8');
        expect(order.shippingMethod).toMatchObject({ providerSlug: 'checkout-paid-shipping', optionId: 'standard', label: 'Paid shipping', amountMinor: 500 });
        expect(order.paymentMethod).toBe('manual-payment');
        expect(order.unpaidExpiresAt!.getTime()).toBeGreaterThanOrEqual(before + 4320 * 60_000);
        expect(order.unpaidExpiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + 4320 * 60_000);
      } finally { await resetFixtures(); }
    });

    it('records inclusive tax without adding it to the total', async () => {
      await installFixture('checkout-inclusive-tax', 'tax', "module.exports = { register(ctx) { ctx.contracts.implement('tax', 1, { calculate: (input) => { const lines = input.lines.map((line) => ({ lineId: line.lineId, taxMinor: 727 })); return { pricesIncludeTax: true, lines, shippingTaxMinor: 45, totalTaxMinor: lines.reduce((total, line) => total + line.taxMinor, 45) }; } }); } };");
      try {
        const response = await app.inject({ method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` }, payload: { items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 1 }], shippingAddress: validShippingAddress, ...checkoutSelection } });
        expect(response.statusCode).toBe(201);
        expect(response.json().data).toMatchObject({ taxInclusive: true, taxAmount: 7.72, totalAmount: 79.99, items: [expect.objectContaining({ taxAmount: 7.27 })] });
        const order = await prisma.order.findUniqueOrThrow({ where: { id: response.json().data.id }, include: { items: true } });
        expect(order.taxInclusive).toBe(true);
        expect(order.taxAmount.toString()).toBe('7.72');
        expect(order.items[0].taxAmount.toString()).toBe('7.27');
        expect(order.totalAmount.toString()).toBe('79.99');
      } finally { await resetFixtures(); }
    });

    it('ignores client-sent amounts and persists product and contract amounts', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` }, payload: { items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 1, unitPrice: 0 }], shippingAddress: validShippingAddress, ...checkoutSelection, subtotalAmount: 0, totalAmount: 0, shippingAmount: 999 } });
      expect(response.statusCode).toBe(201);
      const order = await prisma.order.findUniqueOrThrow({ where: { id: response.json().data.id } });
      expect(order.subtotalAmount.toString()).toBe('79.99');
      expect(order.totalAmount.toString()).toBe('79.99');
    });

    it('rejects unknown shipping options before changing stock or creating an order', async () => {
      const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock;
      const countBefore = await prisma.order.count();
      const response = await app.inject({ method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` }, payload: { items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 1 }], shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:missing', paymentMethod: 'manual-payment' } });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('SHIPPING_OPTION_UNAVAILABLE');
      expect(await prisma.order.count()).toBe(countBefore);
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock).toBe(stockBefore);
    });

    it('returns a tax contract failure without creating an order or changing stock', async () => {
      await installFixture('checkout-failing-tax', 'tax', "module.exports = { register(ctx) { ctx.contracts.implement('tax', 1, { calculate: () => { const error = new Error('Tax provider unavailable'); error.code = 'TAX_UNAVAILABLE'; throw error; } }); } };");
      const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock;
      const countBefore = await prisma.order.count();
      try {
        const response = await app.inject({ method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` }, payload: { items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 1 }], shippingAddress: validShippingAddress, ...checkoutSelection } });
        expect(response.statusCode).toBe(502);
        expect(response.json().error.code).toBe('CONTRACT_CALL_FAILED');
        expect(response.json().error.message).toBe('Checkout provider is temporarily unavailable');
        expect(response.body).not.toContain('Tax provider unavailable');
        expect(response.body).not.toContain('TAX_UNAVAILABLE');
        expect(await prisma.order.count()).toBe(countBefore);
        expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock).toBe(stockBefore);
      } finally { await resetFixtures(); }
    });

    it('rejects disabled and currency-unsupported payment methods', async () => {
      await installFixture('checkout-card-payment', 'payment', checkoutPaymentFixtureSource);
      try {
        const instance = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: 'checkout-card-payment', instanceKey: 'default' } } });
        const configResponse = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/checkout-card-payment/instances/${instance.id}`, headers: { authorization: `Bearer ${adminToken}` }, payload: { config: { supported: false } } });
        expect(configResponse.statusCode).toBe(200);
        const unsupported = await app.inject({ method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` }, payload: { items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 1 }], shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free', paymentMethod: 'checkout-card-payment' } });
        expect(unsupported.statusCode).toBe(409);
        expect(unsupported.json().error.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
        const disabled = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/checkout-card-payment/instances/${instance.id}`, headers: { authorization: `Bearer ${adminToken}` }, payload: { enabled: false } });
        expect(disabled.statusCode).toBe(200);
        const unavailable = await app.inject({ method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` }, payload: { items: [{ productId: testProduct.id, variantId: testVariantId, quantity: 1 }], shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free', paymentMethod: 'checkout-card-payment' } });
        expect(unavailable.statusCode).toBe(409);
        expect(unavailable.json().error.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
      } finally { await resetFixtures(); }
    });
  });

  describe('unpaid-order timeout', () => {
    it('cancels only expired pending orders once across concurrent runs', async () => {
      const expiredId = await createCheckoutOrder();
      const unexpiredId = await createCheckoutOrder();
      const paidId = await createCheckoutOrder();
      await createCheckoutSession(expiredId, 'manual-payment');
      await createCheckoutSession(paidId, 'manual-payment');
      const paidResponse = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${paidId}/record-manual-payment`, headers: { authorization: `Bearer ${adminToken}` }, payload: { reference: 'timeout-test-paid' } });
      expect(paidResponse.statusCode).toBe(200);
      await prisma.order.update({ where: { id: expiredId }, data: { unpaidExpiresAt: new Date(Date.now() - 60_000) } });
      await prisma.order.update({ where: { id: unexpiredId }, data: { unpaidExpiresAt: new Date(Date.now() + 60_000) } });
      await prisma.order.update({ where: { id: paidId }, data: { unpaidExpiresAt: new Date(Date.now() - 60_000) } });
      const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock;

      const runs = await Promise.all([OrderService.cancelExpiredUnpaidOrders(), OrderService.cancelExpiredUnpaidOrders()]);
      expect(runs.reduce((total, count) => total + count, 0)).toBe(1);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: expiredId } })).status).toBe('CANCELLED');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: unexpiredId } })).status).toBe('PENDING');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: paidId } })).status).toBe('PROCESSING');
      expect((await prisma.payment.findFirstOrThrow({ where: { orderId: expiredId } })).status).toBe('CANCELLED');
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock).toBe(stockBefore + 1);
      expect(await prisma.orderStatusHistory.count({ where: { orderId: expiredId, reason: 'unpaid timeout' } })).toBe(1);
      expect(await prisma.outboxEvent.count({ where: { aggregateId: expiredId, type: 'order.cancelled' } })).toBe(1);
      expect(await prisma.outboxEvent.count({ where: { aggregateId: unexpiredId, type: 'order.cancelled' } })).toBe(0);
      expect(await prisma.outboxEvent.count({ where: { aggregateId: paidId, type: 'order.cancelled' } })).toBe(0);
    });

    it('keeps a timed-out order cancelled when a late payment succeeds and records refund required', async () => {
      await installFixture('checkout-late-payment', 'payment', checkoutPaymentFixtureSource);
      try {
        const orderId = await createCheckoutOrder('checkout-late-payment');
        const sessionId = await createCheckoutSession(orderId, 'checkout-late-payment');
        await prisma.order.update({ where: { id: orderId }, data: { unpaidExpiresAt: new Date(Date.now() - 60_000) } });
        expect(await OrderService.cancelExpiredUnpaidOrders()).toBe(1);
        expect(await applyNormalizedPluginWebhook('checkout-late-payment', { received: true, handled: true, sessionId, normalizedStatus: 'succeeded', providerEventId: `late:${orderId}` })).toBe(true);
        const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
        expect(order.status).toBe('CANCELLED');
        expect(order.paymentStatus).toBe('PAID');
        expect((await prisma.payment.findFirstOrThrow({ where: { orderId } })).status).toBe('SUCCEEDED');
        expect(await prisma.paymentLedger.count({ where: { orderId, eventType: 'SUCCEEDED' } })).toBe(1);
        expect(await prisma.orderStatusHistory.count({ where: { orderId, reason: 'refund_required_after_cancelled_order_payment' } })).toBe(1);
      } finally { await resetFixtures(); }
    });
  });

  describe('GET /api/v1/orders/', () => {
    beforeEach(async () => {
      // Create an order for testing
      await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
          shippingAddress: validShippingAddress,
          ...checkoutSelection,
        },
      });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orders/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user orders', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      // API returns { items: [...], page, limit, total, totalPages }
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orders/?page=1&limit=5',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should support status filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orders/?status=PENDING',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should only return current user orders', async () => {
      // Create another user
      const { token: otherToken } = await createUserWithToken();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      // Should not contain orders from first user
      expect(body.data.items.every((order: any) => order.userId !== userId)).toBe(true);
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
          shippingAddress: validShippingAddress,
          ...checkoutSelection,
        },
      });

      if (createResponse.statusCode === 200 || createResponse.statusCode === 201) {
        const body = createResponse.json();
        orderId = body.data.id;
      }
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return order details', async () => {
      if (!orderId) return; // Skip if order creation failed

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.id).toBe(orderId);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/orders/${fakeOrderId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403/404 for other user order', async () => {
      if (!orderId) return;

      const { token: otherToken } = await createUserWithToken();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect([403, 404]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/orders/:id/cancel', () => {
    let orderId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
          shippingAddress: validShippingAddress,
          ...checkoutSelection,
        },
      });

      if (createResponse.statusCode === 200 || createResponse.statusCode === 201) {
        const body = createResponse.json();
        orderId = body.data.id;
      }
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/orders/${orderId}/cancel`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should cancel order', async () => {
      if (!orderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { cancelReason: 'Test cancel' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/orders/${fakeOrderId}/cancel`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { cancelReason: 'Test cancel' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403/404 for other user order', async () => {
      if (!orderId) return;

      const { token: otherToken } = await createUserWithToken();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { cancelReason: 'Test cancel' },
      });

      expect([403, 404]).toContain(response.statusCode);
    });
  });
});
