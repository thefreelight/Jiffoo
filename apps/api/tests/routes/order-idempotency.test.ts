/**
 * Order creation idempotency tests.
 *
 * The idempotency key is scoped to the customer that owns the order: the
 * uniqueness of the key is the pair of the customer and the key, so two
 * different customers may use the same key and each of them gets their own
 * order. Inside one customer the guarantee is unchanged: the same key with
 * the same request replays the original order, and the same key with a
 * different request is rejected.
 *
 * Coverage:
 * - A repeated request with the same key returns the original order
 * - A repeated request with the same key but a different payload is rejected
 * - Two different customers may use the same key, each getting their own order
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
  let userId: string;
  let otherToken: string;
  let otherUserId: string;
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

  async function orderPayload(idempotencyKey: string, quantity = 1, token: string = userToken) {
    const items = [{ productId: testProduct.id, variantId: testVariantId, quantity }];
    const expectedTotal = await checkoutTotal(app, token, items, shippingAddress, 'free-shipping:free');
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
    userId = buyer.user.id;
    const otherBuyer = await createUserWithToken();
    otherToken = otherBuyer.token;
    otherUserId = otherBuyer.user.id;
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

    expect(await prisma.order.count({ where: { userId, idempotencyKey: key } })).toBe(1);
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
    expect(await prisma.order.count({ where: { userId, idempotencyKey: key } })).toBe(1);
  });

  it('lets two customers own the same idempotency key', async () => {
    const key = randomUUID();

    const first = await post(userToken, await orderPayload(key));
    expect(first.statusCode).toBe(201);
    const firstOrderId = first.json().data.id as string;
    const firstOrderNumber = first.json().data.orderNumber as string;
    const firstStatus = first.json().data.status as string;

    // The key is scoped to the customer, so the second customer may use the
    // key of the first customer and gets their own order.
    const second = await post(otherToken, await orderPayload(key, 1, otherToken));
    expect(second.statusCode).toBe(201);
    const secondOrderId = second.json().data.id as string;
    const secondOrderNumber = second.json().data.orderNumber as string;

    expect(second.json().data.userId).toBe(otherUserId);
    expect(secondOrderId).not.toBe(firstOrderId);
    expect(secondOrderNumber).not.toBe(firstOrderNumber);

    const secondOrder = await prisma.order.findUniqueOrThrow({ where: { id: secondOrderId } });
    expect(secondOrder.userId).toBe(otherUserId);

    // The order of the first customer is untouched by the placement of the
    // order of the second customer.
    const firstOrder = await prisma.order.findUniqueOrThrow({ where: { id: firstOrderId } });
    expect(firstOrder.userId).toBe(userId);
    expect(firstOrder.id).toBe(firstOrderId);
    expect(firstOrder.orderNumber).toBe(firstOrderNumber);
    expect(String(firstOrder.status)).toBe(firstStatus);

    // The key is unique per customer: one order for each of the two
    // customers, and the two orders are two distinct rows.
    expect(await prisma.order.count({ where: { userId, idempotencyKey: key } })).toBe(1);
    expect(await prisma.order.count({ where: { userId: otherUserId, idempotencyKey: key } })).toBe(1);
    const rows = await prisma.order.findMany({ where: { idempotencyKey: key }, select: { id: true } });
    expect(rows.map((row) => row.id).sort()).toEqual([firstOrderId, secondOrderId].sort());
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
    expect(await prisma.order.count({ where: { userId, idempotencyKey: key } })).toBe(1);
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
