/**
 * Order creation idempotency tests.
 *
 * Coverage:
 * - A repeated request with the same key returns the original order
 * - A repeated request with the same key but a different payload is rejected
 * - Concurrent requests with the same key create exactly one order
 * - A request without a key is rejected
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import {
  createTestProduct,
  deleteAllTestCarts,
  deleteAllTestOrders,
  deleteAllTestProducts,
} from '../helpers/fixtures';
import { checkoutTotal } from '../helpers/checkout-total';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { prisma } from '@/config/database';

describe('Order creation idempotency', () => {
  let app: FastifyInstance;
  let userToken: string;
  let otherToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testVariantId: string;

  const shippingAddress = {
    firstName: 'Idempotent',
    lastName: 'Buyer',
    phone: '+1-555-0101',
    addressLine1: '123 Test St',
    city: 'Test City',
    state: 'CA',
    postalCode: '94016',
    country: 'US',
  };

  async function orderPayload(idempotencyKey: string, quantity = 1) {
    const items = [{ productId: testProduct.id, variantId: testVariantId, quantity }];
    const expectedTotal = await checkoutTotal(app, userToken, items, shippingAddress, 'free-shipping:free');
    return { items, shippingAddress, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal, idempotencyKey };
  }

  function post(token: string, payload: unknown) {
    return app.inject({ method: 'POST', url: '/api/v1/orders', headers: { authorization: `Bearer ${token}` }, payload });
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    const buyer = await createUserWithToken();
    userToken = buyer.token;
    otherToken = (await createUserWithToken()).token;
    testProduct = await createTestProduct({ name: 'Idempotency Test Product', price: 79.99, stock: 50 });
    testVariantId = testProduct.variants[0].id;
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('returns the original order when the same key is replayed', async () => {
    const key = randomUUID();
    const payload = await orderPayload(key);
    const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock;

    const created = await post(userToken, payload);
    expect(created.statusCode).toBe(201);
    const orderId = created.json().data.id as string;

    const replayed = await post(userToken, payload);
    expect(replayed.statusCode).toBe(200);
    expect(replayed.json().data.id).toBe(orderId);
    expect(replayed.json().data.orderNumber).toBe(created.json().data.orderNumber);

    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
    const stockAfter = (await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock;
    expect(stockAfter).toBe(stockBefore - 1);
  });

  it('rejects a reused key that carries a different request', async () => {
    const key = randomUUID();
    const created = await post(userToken, await orderPayload(key));
    expect(created.statusCode).toBe(201);

    const conflicting = await post(userToken, await orderPayload(key, 2));
    expect(conflicting.statusCode).toBe(409);
    expect(conflicting.json().error.code).toBe('ORDER_IDEMPOTENCY_CONFLICT');
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('rejects a key that another customer already owns', async () => {
    const key = randomUUID();
    const created = await post(userToken, await orderPayload(key));
    expect(created.statusCode).toBe(201);

    const stolen = await post(otherToken, await orderPayload(key));
    expect(stolen.statusCode).toBe(409);
    expect(stolen.json().error.code).toBe('ORDER_IDEMPOTENCY_CONFLICT');
  });

  it('creates exactly one order for concurrent requests that share a key', async () => {
    const key = randomUUID();
    const payload = await orderPayload(key);
    const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock;

    const responses = await Promise.all([post(userToken, payload), post(userToken, payload), post(userToken, payload)]);
    const ids = new Set(responses.map((response) => response.json().data?.id as string | undefined));
    expect(responses.every((response) => response.statusCode === 200 || response.statusCode === 201)).toBe(true);
    expect(ids.size).toBe(1);
    expect([...ids][0]).toBeTruthy();
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
    const stockAfter = (await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock;
    expect(stockAfter).toBe(stockBefore - 1);
  });

  it('rejects a request without an idempotency key', async () => {
    const payload = await orderPayload(randomUUID());
    const { idempotencyKey: _omitted, ...withoutKey } = payload;
    const response = await post(userToken, withoutKey);
    expect(response.statusCode).toBe(400);
  });
});
