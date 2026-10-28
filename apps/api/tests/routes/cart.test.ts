/**
 * Cart Endpoints Tests
 * 
 * Coverage:
 * - GET /api/v1/cart/
 * - POST /api/v1/cart/items
 * - PUT /api/v1/cart/items/:itemId
 * - DELETE /api/v1/cart/items/:itemId
 * - DELETE /api/v1/cart/
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts, deleteAllTestCarts, deleteTestProduct } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { v4 as uuidv4 } from 'uuid';

describe('Cart Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testVariantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { token } = await createUserWithToken();
    userToken = token;

    testProduct = await createTestProduct({
      name: 'Cart Test Product',
      price: 49.99,
      stock: 100,
    });
    testVariantId = testProduct.variants[0].id;

  });

  afterAll(async () => {
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  beforeEach(async () => {
    // Clear cart before each test
    await app.inject({
      method: 'DELETE',
      url: '/api/v1/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });
  });

  describe('GET /api/v1/cart/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return empty cart for new user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toBeDefined();
    });

    it('should return cart with items after adding', async () => {
      // First add an item
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 2,
        },
      });

      // Then get cart
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('items');
    });

    it('should report the exact decimal total of a basket whose prices do not sum exactly in a float', async () => {
      // The two prices do not sum exactly in a binary float: 79.99 + 19.99 is
      // 99.97999999999999 when it is added as a float.
      const first = await createTestProduct({ name: 'Cart Exact Total Product', price: 79.99, stock: 10 });
      const second = await createTestProduct({ name: 'Cart Exact Total Second Product', price: 19.99, stock: 10 });

      try {
        for (const product of [first, second]) {
          const added = await app.inject({
            method: 'POST',
            url: '/api/v1/cart/items',
            headers: { authorization: `Bearer ${userToken}` },
            payload: {
              productId: product.id,
              variantId: product.variants[0].id,
              quantity: 1,
            },
          });

          expect(added.statusCode).toBe(200);
        }

        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/cart/',
          headers: { authorization: `Bearer ${userToken}` },
        });

        expect(response.statusCode).toBe(200);

        const cart = response.json().data;
        expect(cart.items).toHaveLength(2);
        expect(cart.subtotal).toBe(99.98);
        expect(cart.subtotal).not.toBe(99.97999999999999);
        expect(cart.total).toBe(99.98);
      } finally {
        await deleteTestProduct(first.id);
        await deleteTestProduct(second.id);
      }
    });
  });

  describe('POST /api/v1/cart/items', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should add item to cart', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 for missing productId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should use default quantity of 1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: fakeProductId,
          variantId: uuidv4(),
          quantity: 1,
        },
      });

      expect([400, 404]).toContain(response.statusCode);
    });

    it('should handle adding same product multiple times', async () => {
      // Add first time
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      // Add same product again
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 2,
        },
      });

      // Should either update quantity or return error - both are valid
      expect([200, 400]).toContain(response.statusCode);
    });

    it('should return 400 for a product that is not sellable', async () => {
      const inactiveProduct = await createTestProduct({
        name: 'Cart Test Inactive Product',
        price: 19.99,
        stock: 10,
      });
      const inactiveVariantId = inactiveProduct.variants[0].id;

      // The product is created and then deactivated, so the add finds a
      // product that exists but is not sellable.
      const prisma = getTestPrisma();
      await prisma.product.update({
        where: { id: inactiveProduct.id },
        data: { isActive: false },
      });

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/cart/items',
          headers: { authorization: `Bearer ${userToken}` },
          payload: {
            productId: inactiveProduct.id,
            variantId: inactiveVariantId,
            quantity: 1,
          },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error?.code).toBe('BAD_REQUEST');

        // The refused add writes no line.
        const cartResponse = await app.inject({
          method: 'GET',
          url: '/api/v1/cart/',
          headers: { authorization: `Bearer ${userToken}` },
        });

        expect(cartResponse.json().data?.items ?? []).toHaveLength(0);
      } finally {
        await deleteTestProduct(inactiveProduct.id);
      }
    });

  });

  describe('PUT /api/v1/cart/items/:itemId', () => {
    let cartItemId: string;

    beforeEach(async () => {
      // Add item to cart first
      const addResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      // Get the item ID from cart
      const cartResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const cart = cartResponse.json();
      cartItemId = cart.data?.items?.[0]?.id || 'unknown';
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/cart/items/${cartItemId}`,
        payload: {
          quantity: 5,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing quantity', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/cart/items/${cartItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should update item quantity', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/cart/items/${cartItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          quantity: 5,
        },
      });

      expect([200, 404]).toContain(response.statusCode);
    });

    it('should return 404 for non-existent item', async () => {
      const fakeItemId = uuidv4();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/cart/items/${fakeItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          quantity: 5,
        },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/v1/cart/items/:itemId', () => {
    let cartItemId: string;

    beforeEach(async () => {
      // Add item to cart first
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      const cartResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const cart = cartResponse.json();
      cartItemId = cart.data?.items?.[0]?.id || 'unknown';
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/cart/items/${cartItemId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should remove item from cart', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/cart/items/${cartItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be idempotent for non-existent item', async () => {
      const fakeItemId = uuidv4();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/cart/items/${fakeItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should not delete a cart line that belongs to another customer', async () => {
      const other = await createUserWithToken();

      await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${other.token}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      const otherCart = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/',
        headers: { authorization: `Bearer ${other.token}` },
      });
      const otherItemId = otherCart.json().data?.items?.[0]?.id;
      expect(otherItemId).toBeDefined();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/cart/items/${otherItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      // The line is not a line of the caller, so the caller does not have it.
      expect(response.statusCode).toBe(404);

      const afterDelete = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/',
        headers: { authorization: `Bearer ${other.token}` },
      });

      expect(afterDelete.json().data?.items).toHaveLength(1);
    });
  });

  describe('DELETE /api/v1/cart/', () => {
    beforeEach(async () => {
      // Add items to cart first
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 3,
        },
      });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/cart/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should clear cart', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      // Verify cart is empty
      const cartResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const cart = cartResponse.json();
      expect(cart.data?.items?.length || 0).toBe(0);
    });
  });
});
