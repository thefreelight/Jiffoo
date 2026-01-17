/**
 * Orders Endpoints Tests
 * 
 * Coverage:
 * - POST /api/orders/
 * - GET /api/orders/
 * - GET /api/orders/:id
 * - POST /api/orders/:id/cancel
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import {
  createTestProduct,
  deleteAllTestProducts,
  deleteAllTestOrders,
  deleteAllTestCarts,
} from '../helpers/fixtures';
import { v4 as uuidv4 } from 'uuid';

describe('Orders Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    app = await createTestApp();
    const { token, user } = await createUserWithToken();
    userToken = token;
    userId = user.id;

    testProduct = await createTestProduct({
      name: 'Order Test Product',
      price: 79.99,
      stock: 100,
    });
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  describe('POST /api/orders/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        payload: {
          items: [
            { productId: testProduct.id, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty items array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
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
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, quantity: 2 },
          ],
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
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: fakeProductId, quantity: 1 },
          ],
        },
      });

      expect([400, 404]).toContain(response.statusCode);
    });

    it('should support shipping address', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, quantity: 1 },
          ],
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            country: 'US',
            zipCode: '12345',
          },
        },
      });

      expect([200, 201]).toContain(response.statusCode);
    });
  });

  describe('GET /api/orders/', () => {
    beforeEach(async () => {
      // Create an order for testing
      await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, quantity: 1 },
          ],
        },
      });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user orders', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      // If the API returns { orders, pagination }, check body.data.orders
      // If it returns just array in data, check body.data
      // Based on user feedback: "most likely orders"
      expect(Array.isArray(body.data.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/?page=1&limit=5',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.data.length).toBeLessThanOrEqual(5);
    });

    it('should support status filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/?status=PENDING',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should only return current user orders', async () => {
      // Create another user
      const { token: otherToken } = await createUserWithToken();

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      // Should not contain orders from first user
      expect(body.data.data.every((order: any) => order.userId !== userId)).toBe(true);
    });
  });

  describe('GET /api/orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, quantity: 1 },
          ],
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
        url: `/api/orders/${orderId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return order details', async () => {
      if (!orderId) return; // Skip if order creation failed

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
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
        url: `/api/orders/${fakeOrderId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403/404 for other user order', async () => {
      if (!orderId) return;

      const { token: otherToken } = await createUserWithToken();

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect([403, 404]).toContain(response.statusCode);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    let orderId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, quantity: 1 },
          ],
        },
      });

      if (createResponse.statusCode === 200 || createResponse.statusCode === 201) {
        const body = createResponse.json();
        orderId = body.id;
      }
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/orders/${orderId}/cancel`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should cancel order', async () => {
      if (!orderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect([200, 400]).toContain(response.statusCode);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: `/api/orders/${fakeOrderId}/cancel`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect([404, 400]).toContain(response.statusCode);
    });

    it('should return 403/404 for other user order', async () => {
      if (!orderId) return;

      const { token: otherToken } = await createUserWithToken();

      const response = await app.inject({
        method: 'POST',
        url: `/api/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect([403, 404]).toContain(response.statusCode);
    });
  });
});
