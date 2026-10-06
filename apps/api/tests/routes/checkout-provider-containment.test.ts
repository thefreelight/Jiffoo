import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts, deleteAllTestOrders, deleteAllTestCarts } from '../helpers/fixtures';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { prisma } from '@/config/database';

const paymentSource = (fail: boolean) => `module.exports = { register(ctx) {
  ctx.contracts.implement('payment', 1, {
    describe: (input) => { ${fail ? "throw new Error('fixture payment failure');" : ''} return {
      displayName: 'Fixture payment', requiresManualConfirmation: true,
      unpaidTimeoutMinutes: 60, supportedCurrencies: [input.storeCurrency],
    }; },
    createSession: () => ({ sessionId: 'fixture', action: { type: 'none' } }),
    getSessionStatus: () => ({ status: 'pending' }),
    handleWebhook: () => ({ events: [] }),
  });
} };`;
const shippingSource = (fail: boolean) => `module.exports = { register(ctx) {
  ctx.contracts.implement('shipping', 1, {
    quote: () => { ${fail ? "throw new Error('fixture shipping failure');" : ''} return {
      options: [{ id: 'standard', label: 'Fixture shipping', amountMinor: 0 }],
    }; },
  });
} };`;

describe('Checkout provider failure containment', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let adminUserId: string;
  let product: Awaited<ReturnType<typeof createTestProduct>>;
  const slugs: string[] = [];
  const disabledBuiltins: string[] = [];
  const address = {
    firstName: 'Test', lastName: 'User', phone: '+1-555-0101',
    addressLine1: '123 Test St', city: 'Test City', state: 'CA',
    postalCode: '94016', country: 'US',
  };
  const options = () => ({ app, adminToken, adminUserId });

  async function install(slug: string, category: 'payment' | 'shipping', fail = false) {
    slugs.push(slug);
    await installFixturePlugin(options(), slug, category, [{ name: category, version: 1 }],
      category === 'payment' ? paymentSource(fail) : shippingSource(fail));
  }

  async function toggle(slug: string, enabled: boolean) {
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
    const response = await app.inject({
      method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${instance.id}`,
      headers: { authorization: `Bearer ${adminToken}` }, payload: { enabled },
    });
    expect(response.statusCode).toBe(200);
  }

  async function disableBuiltin(slug: string) {
    await toggle(slug, false);
    disabledBuiltins.push(slug);
  }

  async function quote(shippingOptionId?: string) {
    return app.inject({
      method: 'POST', url: '/api/v1/checkout/quote',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { shippingAddress: address, ...(shippingOptionId ? { shippingOptionId } : {}) },
    });
  }

  async function corrupt(slug: string) {
    const pkg = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
    await prisma.pluginPackageBlob.update({
      where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash: pkg.zipHash! } },
      data: { bytes: Buffer.from('corrupt fixture') },
    });
    await clearTestPluginCache(slug);
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    const shopper = await createUserWithToken();
    userToken = shopper.token;
    userId = shopper.user.id;
    const admin = await createAdminWithToken();
    adminToken = admin.token;
    adminUserId = admin.user.id;
    product = await createTestProduct({ name: 'Provider containment product', price: 25, stock: 10 });
    const cart = await app.inject({
      method: 'POST', url: '/api/v1/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { productId: product.id, variantId: product.variants[0].id, quantity: 1 },
    });
    expect(cart.statusCode).toBe(200);
  });

  afterEach(async () => {
    while (disabledBuiltins.length) await toggle(disabledBuiltins.pop()!, true);
    while (slugs.length) await removeFixturePlugin(options(), slugs.pop()!);
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('A excludes a failing payment plugin and records its failure while preserving healthy payment methods', async () => {
    await install('contain-payment-fail', 'payment', true);
    await install('contain-payment-ok', 'payment');
    const response = await quote();
    expect(response.statusCode).toBe(200);
    expect(response.json().data.paymentMethods).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerSlug: 'contain-payment-ok' }),
      expect.objectContaining({ providerSlug: 'manual-payment' }),
    ]));
    expect(response.json().data.paymentMethods).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ providerSlug: 'contain-payment-fail' }),
    ]));
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: 'contain-payment-fail', instanceKey: 'default' } },
    });
    expect(instance.lastFailureAt).not.toBeNull();
  });

  it('B excludes a failing shipping plugin while preserving healthy shipping options', async () => {
    await install('contain-shipping-fail', 'shipping', true);
    await install('contain-shipping-ok', 'shipping');
    const response = await quote();
    expect(response.statusCode).toBe(200);
    expect(response.json().data.shippingOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'contain-shipping-ok:standard' }),
      expect.objectContaining({ id: 'free-shipping:free' }),
    ]));
    expect(response.json().data.shippingOptions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ providerSlug: 'contain-shipping-fail' }),
    ]));
  });

  it('C returns 502 when all payment providers fail and separately when all shipping providers fail', async () => {
    await install('contain-all-payment-fail', 'payment', true);
    await disableBuiltin('manual-payment');
    const payment = await quote();
    expect(payment.statusCode).toBe(502);
    expect(payment.json().error).toMatchObject({
      code: 'CONTRACT_CALL_FAILED', message: 'Provider is temporarily unavailable',
    });
    await toggle('manual-payment', true);
    disabledBuiltins.pop();
    await install('contain-all-shipping-fail', 'shipping', true);
    await disableBuiltin('free-shipping');
    const shipping = await quote();
    expect(shipping.statusCode).toBe(502);
    expect(shipping.json().error).toMatchObject({
      code: 'CONTRACT_CALL_FAILED', message: 'Provider is temporarily unavailable',
    });
  });

  it('D returns provider-specific 409 on re-quote without order, stock, or notification writes', async () => {
    for (const category of ['payment', 'shipping'] as const) {
      const slug = `contain-order-${category}`;
      await install(slug, category);
      const initial = await quote(category === 'shipping' ? `${slug}:standard` : 'free-shipping:free');
      expect(initial.statusCode).toBe(200);
      const selected = initial.json().data;
      const orderCount = await prisma.order.count({ where: { userId } });
      const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock;
      const notifications = await prisma.notification.count({ where: { recipientUserId: userId } });
      await corrupt(slug);
      const response = await app.inject({
        method: 'POST', url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }],
          shippingAddress: address,
          shippingOptionId: category === 'shipping' ? `${slug}:standard` : 'free-shipping:free',
          paymentMethod: category === 'payment' ? slug : 'manual-payment',
          expectedTotal: selected.total,
        },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe(category === 'payment' ? 'PAYMENT_METHOD_UNAVAILABLE' : 'SHIPPING_METHOD_UNAVAILABLE');
      expect(await prisma.order.count({ where: { userId } })).toBe(orderCount);
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(stock);
      expect(await prisma.notification.count({ where: { recipientUserId: userId } })).toBe(notifications);
      await removeFixturePlugin(options(), slugs.pop()!);
    }
  });

  it('E excludes a corrupt provider while its own contract call reports PLUGIN_PACKAGE_CORRUPT', async () => {
    await install('contain-corrupt-payment', 'payment');
    await corrupt('contain-corrupt-payment');
    await expect(callContract('contain-corrupt-payment', 'payment', 1, 'describe', { storeCurrency: 'USD' }))
      .rejects.toMatchObject({ code: 'PLUGIN_PACKAGE_CORRUPT' });
    const response = await quote();
    expect(response.statusCode).toBe(200);
    expect(response.json().data.paymentMethods).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerSlug: 'manual-payment' }),
    ]));
    expect(response.json().data.paymentMethods).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ providerSlug: 'contain-corrupt-payment' }),
    ]));
  });
});
