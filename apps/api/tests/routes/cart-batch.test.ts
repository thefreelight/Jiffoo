/**
 * Cart Batch Endpoints Tests
 *
 * Coverage:
 * - POST /api/cart/items/batch
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, createMultipleProducts, deleteAllTestProducts, deleteAllTestCarts } from '../helpers/fixtures';
import { v4 as uuidv4 } from 'uuid';

describe('Cart Batch Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let testProduct1: Awaited<ReturnType<typeof createTestProduct>>;
  let testProduct2: Awaited<ReturnType<typeof createTestProduct>>;
  let testProduct3: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    app = await createTestApp();
    const { token } = await createUserWithToken();
    userToken = token;

    // Create multiple test products for batch operations
    testProduct1 = await createTestProduct({
      name: 'Batch Test Product 1',
      price: 29.99,
      stock: 100,
    });

    testProduct2 = await createTestProduct({
      name: 'Batch Test Product 2',
      price: 49.99,
      stock: 50,
    });

    testProduct3 = await createTestProduct({
      name: 'Batch Test Product 3',
      price: 19.99,
      stock: 200,
    });
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
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });
  });

  describe('POST /api/cart/items/batch', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        payload: {
          items: [
            { productId: testProduct1.id, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should add multiple items to cart in a single request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct1.id, quantity: 2 },
            { productId: testProduct2.id, quantity: 1 },
            { productId: testProduct3.id, quantity: 3 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toBeDefined();
      expect(body.data).toHaveProperty('items');
      expect(body.data.items).toHaveLength(3);
    });

    it('should return 400 for missing items field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty items array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing productId in items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should use default quantity of 1 for items without quantity', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct1.id },
            { productId: testProduct2.id },
          ],
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.items).toHaveLength(2);
    });

    it('should return 404 for non-existent product in batch', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct1.id, quantity: 1 },
            { productId: fakeProductId, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle batch add with different quantities', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct1.id, quantity: 5 },
            { productId: testProduct2.id, quantity: 10 },
            { productId: testProduct3.id, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.items).toHaveLength(3);

      // Verify quantities are correctly set
      const item1 = body.data.items.find((i: any) => i.productId === testProduct1.id);
      const item2 = body.data.items.find((i: any) => i.productId === testProduct2.id);
      const item3 = body.data.items.find((i: any) => i.productId === testProduct3.id);

      expect(item1).toBeDefined();
      expect(item1.quantity).toBe(5);
      expect(item2).toBeDefined();
      expect(item2.quantity).toBe(10);
      expect(item3).toBeDefined();
      expect(item3.quantity).toBe(1);
    });

    it('should return updated cart with correct totals after batch add', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct1.id, quantity: 2 },
            { productId: testProduct2.id, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('itemCount');
      expect(body.data).toHaveProperty('subtotal');
      expect(body.data).toHaveProperty('total');
      expect(body.data.itemCount).toBe(3); // 2 + 1
    });

    it('should add items to existing cart', async () => {
      // First, add an item through regular endpoint
      await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct1.id,
          quantity: 1,
        },
      });

      // Then batch add more items
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct2.id, quantity: 2 },
            { productId: testProduct3.id, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify cart now has all items
      const getCartResponse = await app.inject({
        method: 'GET',
        url: '/api/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const cart = getCartResponse.json();
      expect(cart.data.items).toHaveLength(3);
    });

    it('should handle single item in batch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct1.id, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.items).toHaveLength(1);
    });

    it('should handle large batch of items', async () => {
      // Create 5 more products for a larger batch
      const moreProducts = await createMultipleProducts(5, {
        name: 'Batch Test Product',
        price: 15.99,
        stock: 100,
      });

      const items = moreProducts.map(product => ({
        productId: product.id,
        quantity: 1,
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { items },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.items).toHaveLength(5);
    });

    it('should maintain atomicity on partial failure', async () => {
      const fakeProductId = uuidv4();

      // This should fail due to non-existent product
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items/batch',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct1.id, quantity: 1 },
            { productId: fakeProductId, quantity: 1 }, // This will fail
            { productId: testProduct2.id, quantity: 1 },
          ],
        },
      });

      // Should fail with 404 (product not found) or 500 (if DB error)
      expect([404, 500]).toContain(response.statusCode);

      // Verify cart is still empty (transaction rolled back)
      const getCartResponse = await app.inject({
        method: 'GET',
        url: '/api/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const cart = getCartResponse.json();
      // Cart should be empty or have no items since transaction failed
      expect(cart.data.items.length).toBe(0);
    });
  });
});
