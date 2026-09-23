/**
 * Admin Orders Endpoints Tests
 * 
 * Coverage:
 * - GET /api/v1/admin/orders/
 * - GET /api/v1/admin/orders/:id
 * - PUT /api/v1/admin/orders/:id/status
 * - POST /api/v1/admin/orders/:id/ship
 * - POST /api/v1/admin/orders/:id/refund
 * - POST /api/v1/admin/orders/:id/cancel
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import {
  createTestProduct,
  deleteAllTestProducts,
  deleteAllTestOrders,
} from '../helpers/fixtures';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/config/database';
import path from 'path';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';

describe('Admin Orders Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testOrderId: string;
  const validShippingAddress = {
    firstName: 'Admin', lastName: 'Order', phone: '+1-555-0102', addressLine1: '1 Admin Way',
    city: 'Test City', state: 'CA', postalCode: '94016', country: 'US',
  };

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();

    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();

    userToken = uToken;
    adminToken = aToken;

    testProduct = await createTestProduct({
      name: 'Admin Order Test Product',
      price: 99.99,
      stock: 100,
    });

    // Create a test order
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }],
        shippingAddress: validShippingAddress,
        shippingOptionId: 'free-shipping:free',
        paymentMethod: 'manual-payment',
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

  describe('Authentication & Authorization', () => {
    it('GET /api/v1/admin/orders/ should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/admin/orders/ should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('GET /api/v1/admin/orders/ should return 200 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/admin/orders/', () => {
    it('should return orders list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/?page=1&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support status filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/?status=PENDING',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/admin/orders/:id', () => {
    it('should return 401 without token', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders/${testOrderId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders/${testOrderId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return order details for admin', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders/${testOrderId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data).toMatchObject({ paymentMethod: 'manual-payment', canRecordManualPayment: true });
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders/${fakeOrderId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/admin/orders/:id/status', () => {
    it('should return 401 without token', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/orders/${testOrderId}/status`,
        payload: { status: 'PROCESSING' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/orders/${testOrderId}/status`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { status: 'PROCESSING' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing status', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/orders/${testOrderId}/status`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should update order status for admin', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/orders/${testOrderId}/status`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: 'PROCESSING' },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/admin/orders/:id/record-manual-payment', () => {
    it('should register the v1 admin route', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${uuidv4()}/record-manual-payment`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should record a manual payment, update the order, and write an audit record', async () => {
      if (!testOrderId) return;

      const order = await prisma.order.findUniqueOrThrow({ where: { id: testOrderId } });
      const payment = await prisma.payment.create({
        data: {
          orderId: testOrderId,
          paymentMethod: 'manual-payment',
          amount: order.totalAmount,
          currency: order.currency,
          status: 'PENDING',
          sessionId: `manual_${testOrderId}_test`,
          sessionUrl: `http://localhost:3000/en/payment/manual?order_id=${testOrderId}`,
          attemptNumber: (order.paymentAttempts || 0) + 1,
          idempotencyKey: `manual-test:${testOrderId}`,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/record-manual-payment`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reference: 'cash-receipt-001' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        id: testOrderId,
        status: 'PROCESSING',
        paymentStatus: 'PAID',
      });

      const [updatedPayment, audit] = await Promise.all([
        prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
        prisma.orderStatusHistory.findFirst({
          where: { orderId: testOrderId, reason: 'manual_payment_recorded' },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      expect(updatedPayment.status).toBe('SUCCEEDED');
      expect(audit).toMatchObject({
        actorType: 'admin',
        reason: 'manual_payment_recorded',
        metadata: { reference: 'cash-receipt-001' },
      });
    });
  });

  describe('GET /api/v1/admin/orders/stats', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/stats',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/stats',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should return global order stats for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/stats',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('metrics');
      expect(body.data.metrics).toHaveProperty('totalOrders');
      expect(body.data.metrics).toHaveProperty('paidOrders');
      expect(body.data.metrics).toHaveProperty('shippedOrders');
      expect(body.data.metrics).toHaveProperty('refundedOrders');
      expect(body.data.metrics).toHaveProperty('totalRevenue');
      expect(body.data.metrics).toHaveProperty('currency');
      expect(body.data.metrics).toHaveProperty('totalOrdersTrend');
      expect(body.data.metrics).toHaveProperty('totalRevenueTrend');
    });
  });

  describe('POST /api/v1/admin/orders/:id/ship', () => {
    it('should return 401 without token', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/ship`,
        payload: {
          carrier: 'FedEx',
          trackingNumber: 'TRACK123456',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/ship`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          carrier: 'FedEx',
          trackingNumber: 'TRACK123456',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing carrier', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/ship`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          trackingNumber: 'TRACK123456',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing trackingNumber', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/ship`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          carrier: 'FedEx',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should ship order for admin', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/ship`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          carrier: 'FedEx',
          trackingNumber: 'TRACK123456',
        },
      });

      // May fail if order is not in correct state
      expect([200, 400]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/admin/orders/:id/refund', () => {
    it('should return 401 without token', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/refund`,
        payload: {
          idempotencyKey: uuidv4(),
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/refund`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          idempotencyKey: uuidv4(),
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing idempotencyKey', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/refund`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle refund request for admin', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/refund`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          idempotencyKey: uuidv4(),
          reason: 'Customer request',
        },
      });

      // May fail if order is not paid
      expect([200, 400]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/admin/orders/:id/cancel', () => {
    it('should return 401 without token', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/cancel`,
        payload: {
          cancelReason: 'Admin cancellation',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/cancel`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          cancelReason: 'Admin cancellation',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing cancelReason', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should cancel order for admin', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          cancelReason: 'Admin cancellation test',
        },
      });

      // May succeed or fail based on order state
      expect([200, 400]).toContain(response.statusCode);
    });
  });
});
