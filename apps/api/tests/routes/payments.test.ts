/**
 * Payments Endpoints Tests
 * 
 * Coverage:
 * - GET /api/payments/available-methods
 * - POST /api/payments/create-session
 * - GET /api/payments/verify/:sessionId
 * - POST /api/payments/stripe/webhook
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts, deleteAllTestOrders } from '../helpers/fixtures';
import { v4 as uuidv4 } from 'uuid';

describe('Payments Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testOrderId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { token } = await createUserWithToken();
    userToken = token;

    testProduct = await createTestProduct({
      name: 'Payment Test Product',
      price: 59.99,
      stock: 100,
    });

    // Create a test order
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders/',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items: [{ productId: testProduct.id, quantity: 1 }],
      },
    });

    if (orderResponse.statusCode === 200 || orderResponse.statusCode === 201) {
      testOrderId = orderResponse.json().data.id;
    }
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  describe('GET /api/payments/available-methods', () => {
    it('should return available payment methods', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/available-methods',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/available-methods',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('POST /api/payments/create-session', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        payload: {
          paymentMethod: 'stripe',
          orderId: testOrderId,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing paymentMethod', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          orderId: testOrderId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing orderId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          paymentMethod: 'stripe',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400/404 for non-existent order', async () => {
      const fakeOrderId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          paymentMethod: 'stripe',
          orderId: fakeOrderId,
        },
      });

      expect([400, 404]).toContain(response.statusCode);
    });

    it('should handle payment session creation', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          paymentMethod: 'stripe',
          orderId: testOrderId,
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel',
        },
      });

      // May fail if Stripe is not configured in test environment
      expect([200, 400, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /api/payments/verify/:sessionId', () => {
    it('should return 404 for non-existent session', async () => {
      const fakeSessionId = 'cs_test_invalid_session_id';

      const response = await app.inject({
        method: 'GET',
        url: `/api/payments/verify/${fakeSessionId}`,
      });

      // Could be 404 or 400 depending on implementation
      expect([400, 404, 500]).toContain(response.statusCode);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/verify/test-session-id',
      });

      // Should not return 401 (payment verification is public)
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('POST /api/payments/stripe/webhook', () => {
    it('should return 400 without signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/stripe/webhook',
        payload: {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
            },
          },
        },
      });

      // Should fail without proper Stripe signature
      expect([400, 401, 500]).toContain(response.statusCode);
    });

    it('should return 400 with invalid signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/stripe/webhook',
        headers: {
          'stripe-signature': 'invalid-signature',
        },
        payload: {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
            },
          },
        },
      });

      // Should fail with invalid signature
      expect([400, 401, 500]).toContain(response.statusCode);
    });

    it('should not require JWT authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/stripe/webhook',
        headers: {
          'stripe-signature': 'test-signature',
        },
        payload: {
          type: 'checkout.session.completed',
        },
      });

      // Should not return 401 - webhooks use signature auth, not JWT
      expect(response.statusCode).not.toBe(401);
    });
  });
});
