/**
 * Cart Concurrency Tests
 *
 * Coverage:
 * - concurrent adds of the same variant
 * - concurrent first adds for a customer without a cart
 * - a concurrent delete of a cart line of another customer
 * - a concurrent clear of the cart and an add of a line
 * - a concurrent clear of the cart and the consumption of a purchased line
 * - a concurrent consumption of a purchased line and an update of that line
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts, deleteAllTestCarts } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { CartService } from '@/core/cart/service';

describe('Cart Concurrency', () => {
  let app: FastifyInstance;
  let productId: string;
  let variantId: string;
  let secondProductId: string;
  let secondVariantId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const product = await createTestProduct({
      name: 'Cart Concurrency Product',
      price: 19.99,
      stock: 100,
    });
    productId = product.id;
    variantId = product.variants[0].id;

    const secondProduct = await createTestProduct({
      name: 'Cart Concurrency Second Product',
      price: 29.99,
      stock: 100,
    });
    secondProductId = secondProduct.id;
    secondVariantId = secondProduct.variants[0].id;
  });

  afterAll(async () => {
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('sums the quantity of concurrent adds of the same variant and keeps one line', async () => {
    const { user, token } = await createUserWithToken();
    const headers = { authorization: `Bearer ${token}` };

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers,
        payload: { productId, variantId, quantity: 1 },
      })),
    );

    expect(responses.map(response => response.statusCode)).toEqual(Array(10).fill(200));

    const prisma = getTestPrisma();
    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(cart).not.toBeNull();
    // One cart holds one line per variant, so the concurrent adds share a line.
    expect(cart!.items).toHaveLength(1);
    expect(cart!.items[0].quantity).toBe(10);
    expect(await prisma.cartItem.count({ where: { cartId: cart!.id, variantId } })).toBe(1);

    const response = await app.inject({ method: 'GET', url: '/api/v1/cart/', headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.itemCount).toBe(10);
  }, 30_000);

  it('lets two concurrent first adds of a customer without a cart leave one cart', async () => {
    const { user, token } = await createUserWithToken();
    const headers = { authorization: `Bearer ${token}` };

    const responses = await Promise.all([0, 1].map(() => app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      headers,
      payload: { productId, variantId, quantity: 1 },
    })));

    expect(responses.map(response => response.statusCode)).toEqual([200, 200]);

    const prisma = getTestPrisma();
    expect(await prisma.cart.count({ where: { userId: user.id } })).toBe(1);
    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(cart!.items).toHaveLength(1);
    expect(cart!.items[0].quantity).toBe(2);
  }, 30_000);

  it('changes nothing when the cart line of another customer is deleted concurrently', async () => {
    const owner = await createUserWithToken();
    const other = await createUserWithToken();

    await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { productId, variantId, quantity: 1 },
    });

    const prisma = getTestPrisma();
    const cart = await prisma.cart.findUnique({ where: { userId: owner.user.id }, include: { items: true } });
    const lineId = cart!.items[0].id;

    const responses = await Promise.all([0, 1].map(() => app.inject({
      method: 'DELETE',
      url: `/api/v1/cart/items/${lineId}`,
      headers: { authorization: `Bearer ${other.token}` },
    })));

    expect(responses.map(response => response.statusCode)).toEqual([404, 404]);
    expect(await prisma.cartItem.count({ where: { id: lineId } })).toBe(1);

    const ownerCart = await app.inject({
      method: 'GET',
      url: '/api/v1/cart/',
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(ownerCart.json().data.items).toHaveLength(1);
  }, 30_000);

  it('leaves the cart in a state a clear and an add at the same time allow', async () => {
    const { user, token } = await createUserWithToken();
    const headers = { authorization: `Bearer ${token}` };

    // The cart holds one line, and the clear and the add both write that cart.
    await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      headers,
      payload: { productId, variantId, quantity: 1 },
    });

    const [clear, add] = await Promise.all([
      app.inject({ method: 'DELETE', url: '/api/v1/cart/', headers }),
      app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers,
        payload: { productId: secondProductId, variantId: secondVariantId, quantity: 2 },
      }),
    ]);

    expect(clear.statusCode).toBe(200);
    expect(add.statusCode).toBe(200);

    // The two writes of the cart are serialized, so the cart holds what a
    // serial order of a clear and an add allows: nothing, or the line of the
    // add. It never holds a torn line.
    const prisma = getTestPrisma();
    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(cart!.items.length).toBeLessThanOrEqual(1);
    if (cart!.items.length === 1) {
      expect(cart!.items[0].variantId).toBe(secondVariantId);
      expect(cart!.items[0].quantity).toBe(2);
    }
    expect(await prisma.cartItem.count({ where: { cartId: cart!.id } })).toBe(cart!.items.length);
    expect(await prisma.cartItem.count({ where: { cartId: cart!.id, variantId: secondVariantId } })).toBeLessThanOrEqual(1);
  }, 30_000);

  it('does not consume a purchased line against a cart that a concurrent clear emptied', async () => {
    const { user, token } = await createUserWithToken();
    const headers = { authorization: `Bearer ${token}` };

    await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      headers,
      payload: { productId, variantId, quantity: 2 },
    });

    const prisma = getTestPrisma();
    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    const line = cart!.items[0];

    // The order module consumes the purchased lines inside its own
    // transaction, and the clear of the cart writes the same cart.
    const [clear] = await Promise.all([
      app.inject({ method: 'DELETE', url: '/api/v1/cart/', headers }),
      prisma.$transaction(async (tx) => {
        await CartService.consumePurchasedItems(tx, user.id, [
          { productId: line.productId, variantId: line.variantId, quantity: 1 },
        ]);
      }),
    ]);

    expect(clear.statusCode).toBe(200);

    // The consumption and the clear are serialized: the line is consumed and
    // cleared, or it is cleared and the consumption finds no line. The line
    // never survives a clear that ran at the same time, and its quantity is
    // never negative.
    const remaining = await prisma.cartItem.findFirst({ where: { id: line.id } });
    expect(remaining).toBeNull();

    const response = await app.inject({ method: 'GET', url: '/api/v1/cart/', headers });
    expect(response.json().data.items).toHaveLength(0);
  }, 30_000);

  it('consumes the purchased lines while the cart-wide lock of the cart is held', async () => {
    const { user, token } = await createUserWithToken();
    const headers = { authorization: `Bearer ${token}` };

    await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      headers,
      payload: { productId, variantId, quantity: 2 },
    });

    const prisma = getTestPrisma();
    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    const line = cart!.items[0];

    // The cart-wide lock is held by another writer of the cart, exactly as a
    // concurrent cart edit holds it.
    let acquired: () => void = () => {};
    const acquiredLock = new Promise<void>(resolve => { acquired = resolve; });
    let release: () => void = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`jiffoo:cart:${user.id}`}, 0))::text`;
      acquired();
      await held;
    });
    await acquiredLock;

    // The consumption of the purchased lines runs inside the transaction of the
    // order, which already holds the order row and the stock row, so it must
    // not wait for the cart-wide lock.
    const outcome = await Promise.race([
      prisma.$transaction(async (tx) => {
        await CartService.consumePurchasedItems(tx, user.id, [
          { productId: line.productId, variantId: line.variantId, quantity: 1 },
        ]);
        return 'consumed';
      }),
      new Promise<string>(resolve => setTimeout(() => resolve('blocked'), 2_000)),
    ]);

    release();
    await holder;

    expect(outcome).toBe('consumed');
    const remaining = await prisma.cartItem.findFirst({ where: { id: line.id } });
    expect(remaining?.quantity).toBe(1);
  }, 30_000);

  it('answers NOT_FOUND when a concurrent order consumed the line the update targets', async () => {
    const { user, token } = await createUserWithToken();
    const headers = { authorization: `Bearer ${token}` };

    await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      headers,
      payload: { productId, variantId, quantity: 2 },
    });

    const prisma = getTestPrisma();
    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    const line = cart!.items[0];

    // The order module consumes the purchased line inside the transaction of
    // the order, and it holds the row lock of the line until that transaction
    // commits.
    let acquired: () => void = () => {};
    const acquiredLock = new Promise<void>(resolve => { acquired = resolve; });
    let release: () => void = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    const order = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT quantity FROM public.cart_items WHERE id = ${line.id} FOR UPDATE`;
      acquired();
      await held;
      await CartService.consumePurchasedItems(tx, user.id, [
        { productId: line.productId, variantId: line.variantId, quantity: 2 },
      ]);
    });
    await acquiredLock;

    // The update of the line waits for the row lock of the line, so it runs
    // after the consumption committed and finds no line to write.
    const update = app.inject({
      method: 'PUT',
      url: `/api/v1/cart/items/${line.id}`,
      headers,
      payload: { quantity: 5 },
    });

    release();
    const [response] = await Promise.all([update, order]);

    // The line is gone, so the update answers NOT_FOUND. It never answers a
    // server error and never answers a silent success.
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    expect(await prisma.cartItem.findFirst({ where: { id: line.id } })).toBeNull();
  }, 30_000);
});
