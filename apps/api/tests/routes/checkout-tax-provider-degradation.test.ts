import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestCarts, deleteAllTestOrders, deleteAllTestProducts } from '../helpers/fixtures';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { getDefaultInstance } from '@/core/extensions/registry';
import { CartService } from '@/core/cart/service';
import { prisma } from '@/config/database';

/**
 * A tax provider that fails its contract call.
 *
 * The `fail` mode throws inside the contract, which the gateway answers with
 * a failed contract call. The `hang` mode never answers in time, which the
 * gateway answers with a timeout.
 */
const taxSource = (mode: 'fail' | 'hang') => `module.exports = { register(ctx) {
  ctx.contracts.implement('tax', 1, { calculate: async (input) => {
    ${mode === 'fail' ? "throw new Error('fixture tax failure');" : 'await new Promise((resolve) => setTimeout(resolve, 11000));'}
    return { pricesIncludeTax: false, lines: (input.lines || []).map((line) => ({ lineId: String(line.lineId), taxMinor: 0 })), shippingTaxMinor: 0, totalTaxMinor: 0 };
  } });
} };`;

describe('the degradation of a failed tax provider', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let adminUserId: string;
  let product: Awaited<ReturnType<typeof createTestProduct>>;
  let variantId: string;
  const slugs: string[] = [];
  const address = {
    firstName: 'Test', lastName: 'User', phone: '+1-555-0101',
    addressLine1: '123 Test St', city: 'Test City', state: 'CA',
    postalCode: '94016', country: 'US',
  };
  const options = () => ({ app, adminToken, adminUserId });

  async function installTax(slug: string, mode: 'fail' | 'hang') {
    slugs.push(slug);
    // The fixture is installed and enabled first: the platform refuses to
    // disable the last enabled provider of a contract, so the builtin tax
    // provider may only leave its place once the fixture holds it. The
    // enabling of the fixture replaces the builtin provider, so the quote
    // calls exactly the provider of the case.
    await installFixturePlugin(options(), slug, 'tax', [{ name: 'tax', version: 1 }], taxSource(mode));
    await toggle('zero-tax', false);
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

  async function quote() {
    // The quote of the storefront prices the cart, so the cart carries the
    // line of every quote of the file.
    await CartService.clearCart(userId);
    await CartService.addToCart(userId, product.id, 1, variantId);
    return app.inject({
      method: 'POST', url: '/api/v1/checkout/quote',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { shippingAddress: address, shippingOptionId: 'free-shipping:free' },
    });
  }

  async function placeOrder(expectedTotal: string) {
    return app.inject({
      method: 'POST', url: '/api/v1/orders/',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items: [{ productId: product.id, variantId: variantId, quantity: 1 }],
        shippingAddress: address,
        shippingOptionId: 'free-shipping:free',
        paymentMethod: 'manual-payment',
        expectedTotal,
        idempotencyKey: randomUUID(),
      },
    });
  }

  async function failureRecorded(slug: string) {
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
    return instance.lastFailureAt;
  }

  /**
   * The lines the module logged while the call ran.
   *
   * The exclusion of a failed provider is logged, so the log is the evidence
   * that the provider was excluded instead of being answered with an unknown
   * tax.
   */
  function captureLog() {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map((value) => String(value)).join(' '));
    });
    return { lines, restore: () => spy.mockRestore() };
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
    product = await createTestProduct({ name: 'Tax degradation product', price: 25, stock: 10 });
    variantId = (await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id } })).id;
    // The builtin providers of the quote and of the order need to be enabled.
    for (const slug of ['free-shipping', 'manual-payment', 'zero-tax']) {
      const instance = await getDefaultInstance(slug);
      if (instance && !instance.enabled) {
        const response = await app.inject({
          method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${instance.id}`,
          headers: { authorization: `Bearer ${adminToken}` }, payload: { enabled: true },
        });
        expect(response.statusCode).toBe(200);
      }
    }
  });

  afterEach(async () => {
    // The builtin tax provider of the store comes back first: enabling a
    // provider is never refused, while disabling the last enabled provider
    // of a contract is. The fixture is therefore not the last one any more
    // when it is disabled and removed. The cleanup runs between the cases,
    // so every case starts from the same state.
    await toggle('zero-tax', true);
    while (slugs.length) {
      const slug = slugs.pop()!;
      const instance = await prisma.pluginInstallation.findUnique({
        where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
      });
      if (instance?.enabled) await toggle(slug, false);
      await removeFixturePlugin(options(), slug);
    }
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('A answers the quote with an unknown tax when the tax provider fails, and excludes the provider', async () => {
    await installTax('tax-degrade-fail', 'fail');
    const captured = captureLog();
    let response: Awaited<ReturnType<typeof quote>>;
    try { response = await quote(); } finally { captured.restore(); }

    // The quote is not a failure of the whole checkout: the shipping options
    // and the payment methods of the quote survive.
    expect(response!.statusCode).toBe(200);
    const data = response!.json().data;
    expect(data.shippingOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'free-shipping:free' }),
    ]));
    expect(data.paymentMethods).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerSlug: 'manual-payment' }),
    ]));
    // The tax of the quote is unknown: the quote carries the marker of the
    // failed tax provider and no tax and no total, so it never reports a
    // failed tax provider as a store without one.
    expect(data.taxUnavailable).toBe(true);
    expect(data.tax).toBeUndefined();
    expect(data.taxInclusive).toBeUndefined();
    expect(data.total).toBeUndefined();
    // The failure of the provider is recorded for the operator, and the
    // provider is excluded instead of being charged an unknown tax.
    expect(await failureRecorded('tax-degrade-fail')).not.toBeNull();
    expect(captured.lines.some((line) => line.includes('"event":"provider_excluded"') && line.includes('"slug":"tax-degrade-fail"') && line.includes('"contract":"tax"'))).toBe(true);
  });

  it('B refuses the placement with an unknown tax and writes nothing', async () => {
    await installTax('tax-degrade-order-fail', 'fail');
    const orderCount = await prisma.order.count({ where: { userId } });
    const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
    const captured = captureLog();
    let response: Awaited<ReturnType<typeof placeOrder>>;
    try { response = await placeOrder('25.00'); } finally { captured.restore(); }

    // The placement is refused with the clear error of the provider, not with
    // an unhandled contract error and not with an order of an unknown tax.
    expect(response!.statusCode).toBe(502);
    expect(response!.json().error.code).toBe('CONTRACT_CALL_FAILED');
    expect(await prisma.order.count({ where: { userId } })).toBe(orderCount);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(stock);
    // The failure of the provider is recorded for the operator, and the
    // provider is excluded.
    expect(await failureRecorded('tax-degrade-order-fail')).not.toBeNull();
    expect(captured.lines.some((line) => line.includes('"event":"provider_excluded"') && line.includes('"slug":"tax-degrade-order-fail"') && line.includes('"contract":"tax"'))).toBe(true);
  });

  it('C answers the quote with an unknown tax when the tax provider times out', async () => {
    await installTax('tax-degrade-timeout', 'hang');

    const response = await quote();

    expect(response.statusCode).toBe(200);
    expect(response.json().data.taxUnavailable).toBe(true);
    expect(response.json().data.tax).toBeUndefined();
    expect(response.json().data.taxInclusive).toBeUndefined();
    expect(response.json().data.total).toBeUndefined();
    expect(await failureRecorded('tax-degrade-timeout')).not.toBeNull();
    // The contract of the fixture is still busy, so the file waits for it
    // before the plugin of the fixture is removed.
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }, 45000);

  it('D refuses the placement when the tax provider times out and writes nothing', async () => {
    await installTax('tax-degrade-order-timeout', 'hang');
    const orderCount = await prisma.order.count({ where: { userId } });
    const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;

    const response = await placeOrder('25.00');

    // A timeout keeps its own code, so the caller can tell a hanging
    // provider from a failing one.
    expect(response.statusCode).toBe(504);
    expect(response.json().error.code).toBe('PLUGIN_TIMEOUT');
    expect(await prisma.order.count({ where: { userId } })).toBe(orderCount);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(stock);
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }, 60000);

  it('E answers the quote of the builtin zero tax provider with a zero tax and no marker, and places the order', async () => {
    // The builtin zero tax provider is the tax provider of the store, and it
    // is not a failed provider: the quote carries the zero tax of the store
    // and no marker, so the two answers stay apart on the wire.
    const response = await quote();

    expect(response.statusCode).toBe(200);
    expect(response.json().data.tax).toBe('0.00');
    expect(response.json().data.taxUnavailable).toBeUndefined();
    const total = response.json().data.total;
    expect(total).toBe('25.00');

    const order = await placeOrder(total);
    expect(order.statusCode).toBe(201);
  });
});
