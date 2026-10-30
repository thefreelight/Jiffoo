import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestCarts, deleteAllTestOrders, deleteAllTestProducts } from '../helpers/fixtures';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { getDefaultInstance } from '@/core/extensions/registry';
import { CartService } from '@/core/cart/service';
import { prisma } from '@/config/database';

/**
 * The failure modes of the tax provider of the case.
 *
 * The `internal` mode breaks outside its contract, so the plugin runtime
 * answers with an exception that is not a contract error and the message of
 * the exception is the internal detail of the plugin. The `timeout` mode
 * answers with the contract error of a hanging provider.
 */
const { state, INTERNAL_DETAIL } = vi.hoisted(() => ({
  state: { mode: 'internal' as 'internal' | 'timeout' },
  INTERNAL_DETAIL: 'tax plugin internal detail',
}));

vi.mock('@/core/extensions/runtime/plugin-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/extensions/runtime/plugin-runtime')>();
  const { ContractCallError } = await import('@/core/extensions/runtime/contract-errors');
  const callContract = actual.callContract as (...args: unknown[]) => Promise<unknown>;
  return {
    ...actual,
    callContract: vi.fn(async (slug: string, contract: string, version: number, method: string, input: unknown) => {
      if (contract === 'tax') {
        if (state.mode === 'timeout') throw new ContractCallError('PLUGIN_TIMEOUT', 'Contract call timed out');
        throw new Error(INTERNAL_DETAIL);
      }
      return callContract(slug, contract, version, method, input);
    }),
  };
});

describe('a tax provider that fails the order placement', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let product: Awaited<ReturnType<typeof createTestProduct>>;
  let variantId: string;
  const address = {
    firstName: 'Test', lastName: 'User', phone: '+1-555-0101',
    addressLine1: '123 Test St', city: 'Test City', state: 'CA',
    postalCode: '94016', country: 'US',
  };

  async function quote() {
    await CartService.clearCart(userId);
    await CartService.addToCart(userId, product.id, 1, variantId);
    return app.inject({
      method: 'POST', url: '/api/v1/checkout/quote',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { shippingAddress: address, shippingOptionId: 'free-shipping:free' },
    });
  }

  async function placeOrder() {
    return app.inject({
      method: 'POST', url: '/api/v1/orders/',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items: [{ productId: product.id, variantId, quantity: 1 }],
        shippingAddress: address,
        shippingOptionId: 'free-shipping:free',
        paymentMethod: 'manual-payment',
        expectedTotal: '25.00',
        idempotencyKey: randomUUID(),
      },
    });
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    const shopper = await createUserWithToken();
    userToken = shopper.token;
    userId = shopper.user.id;
    product = await createTestProduct({ name: 'Non contract tax failure product', price: 25, stock: 10 });
    variantId = (await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id } })).id;
    // The builtin providers of the quote and of the order need to be enabled.
    for (const slug of ['free-shipping', 'manual-payment', 'zero-tax']) {
      const instance = await getDefaultInstance(slug);
      if (instance && !instance.enabled) {
        await PluginManagementService.updateInstance(instance.id, { enabled: true });
      }
    }
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('answers the quote of a provider that breaks outside its contract with an unknown tax', async () => {
    state.mode = 'internal';

    const response = await quote();

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.taxUnavailable).toBe(true);
    expect(data.tax).toBeUndefined();
    expect(data.total).toBeUndefined();
  });

  it('refuses the placement of a provider that breaks outside its contract with the provider error', async () => {
    state.mode = 'internal';
    const orderCount = await prisma.order.count({ where: { userId } });
    const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;

    const response = await placeOrder();

    // A failure that is not a contract error is a provider failure as well:
    // the placement is refused with the stable code of a provider failure and
    // never with an internal error.
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('CONTRACT_CALL_FAILED');
    // The internal detail of the plugin never reaches the client.
    expect(response.payload).not.toContain(INTERNAL_DETAIL);
    expect(await prisma.order.count({ where: { userId } })).toBe(orderCount);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(stock);
  });

  it('refuses the placement of a hanging provider with the timeout of the contract', async () => {
    state.mode = 'timeout';
    const orderCount = await prisma.order.count({ where: { userId } });
    const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;

    const response = await placeOrder();

    // A timeout keeps its own code, so the caller can tell a hanging
    // provider from a failing one.
    expect(response.statusCode).toBe(504);
    expect(response.json().error.code).toBe('PLUGIN_TIMEOUT');
    expect(await prisma.order.count({ where: { userId } })).toBe(orderCount);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(stock);
  });
});
