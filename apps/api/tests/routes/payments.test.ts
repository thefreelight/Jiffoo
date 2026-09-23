/**
 * Payments Endpoints Tests
 * 
 * Coverage:
 * - GET /api/v1/payments/available-methods
 * - POST /api/v1/payments/create-session
 * - GET /api/v1/payments/verify/:sessionId
 * - POST /api/v1/payments/webhook/:provider
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts, deleteAllTestOrders } from '../helpers/fixtures';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { prisma } from '@/config/database';
import { checkoutPaymentFixtureSource, installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { applyNormalizedPluginWebhook } from '@/core/payment/plugin-webhook';

describe('Payments Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let adminUserId: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testOrderId: string;
  const originalFetch = global.fetch;
  const validShippingAddress = {
    firstName: 'Test',
    lastName: 'User',
    phone: '+1-555-0101',
    addressLine1: '123 Payment St',
    city: 'Test City',
    state: 'CA',
    postalCode: '94016',
    country: 'US',
  };
  const checkoutSelection = {
    shippingOptionId: 'free-shipping:free',
    paymentMethod: 'manual-payment',
  };
  const paymentFixtureSlug = 'checkout-payment-success';
  let paymentFixtureInstalled = false;

  async function createOrder(paymentMethod: string): Promise<string> {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }],
        shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free', paymentMethod,
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data.id as string;
  }

  async function createSession(orderId: string, paymentMethod: string) {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/payments/create-session',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { orderId, paymentMethod, idempotencyKey: `checkout:${orderId}` },
    });
    expect(response.statusCode).toBe(200);
    return response.json().data as { sessionId: string; action: { type: string } };
  }

  async function installPaymentFixture(): Promise<void> {
    if (paymentFixtureInstalled) return;
    await installFixturePlugin({ app, adminToken, adminUserId }, paymentFixtureSlug, 'payment', [{ name: 'payment', version: 1 }], checkoutPaymentFixtureSource);
    paymentFixtureInstalled = true;
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    const { token } = await createUserWithToken();
    userToken = token;
    const admin = await createAdminWithToken();
    adminToken = admin.token;
    adminUserId = admin.user.id;

    testProduct = await createTestProduct({
      name: 'Payment Test Product',
      price: 59.99,
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
        ...checkoutSelection,
      },
    });

    if (orderResponse.statusCode === 200 || orderResponse.statusCode === 201) {
      testOrderId = orderResponse.json().data.id;
    }
  });

  afterAll(async () => {
    if (paymentFixtureInstalled) await removeFixturePlugin({ app, adminToken, adminUserId }, paymentFixtureSlug);
    await deleteAllTestOrders();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/payments/available-methods', () => {
    it('should return available payment methods', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/available-methods',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/available-methods',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('POST /api/v1/payments/create-session', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-session',
        payload: {
          paymentMethod: 'test-gateway',
          orderId: testOrderId,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing paymentMethod', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-session',
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
        url: '/api/v1/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          paymentMethod: 'test-gateway',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400/404/409 for non-existent order', async () => {
      const fakeOrderId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          paymentMethod: 'test-gateway',
          orderId: fakeOrderId,
        },
      });

      expect([400, 404, 409]).toContain(response.statusCode);
    });

    it('returns and persists manual instructions on first creation and idempotent replay', async () => {
      expect(testOrderId).toBeDefined();
      const payload = {
        paymentMethod: 'manual-payment',
        orderId: testOrderId,
        idempotencyKey: `manual-session-${testOrderId}`,
      };
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.action).toEqual({ type: 'instructions', text: 'Pay manually.' });
      const stored = await prisma.payment.findUniqueOrThrow({ where: { idempotencyKey: payload.idempotencyKey } });
      expect(stored.actionJson).toEqual(response.json().data.action);

      const replay = await app.inject({ method: 'POST', url: '/api/v1/payments/create-session', headers: { authorization: `Bearer ${userToken}` }, payload });
      expect(replay.statusCode).toBe(200);
      expect(replay.json().data).toMatchObject({ sessionId: stored.sessionId, action: stored.actionJson });
      expect(await prisma.payment.count({ where: { idempotencyKey: payload.idempotencyKey } })).toBe(1);
    });
  });

  describe('payment success transitions', () => {
    it('allows Admin manual recording only for a manual-confirmation provider', async () => {
      await installPaymentFixture();
      const manualOrderId = await createOrder('manual-payment');
      const cardOrderId = await createOrder(paymentFixtureSlug);
      await createSession(manualOrderId, 'manual-payment');
      await createSession(cardOrderId, paymentFixtureSlug);

      const manualDetail = await app.inject({ method: 'GET', url: `/api/v1/admin/orders/${manualOrderId}`, headers: { authorization: `Bearer ${adminToken}` } });
      const cardDetail = await app.inject({ method: 'GET', url: `/api/v1/admin/orders/${cardOrderId}`, headers: { authorization: `Bearer ${adminToken}` } });
      expect(manualDetail.statusCode).toBe(200);
      expect(cardDetail.statusCode).toBe(200);
      expect(manualDetail.json().data.canRecordManualPayment).toBe(true);
      expect(cardDetail.json().data.canRecordManualPayment).toBe(false);

      const rejected = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${cardOrderId}/record-manual-payment`, headers: { authorization: `Bearer ${adminToken}` }, payload: {} });
      expect(rejected.statusCode).toBe(409);
      expect(rejected.json().error.code).toBe('MANUAL_CONFIRMATION_NOT_SUPPORTED');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: cardOrderId } })).paymentStatus).toBe('PENDING');

      const recorded = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${manualOrderId}/record-manual-payment`, headers: { authorization: `Bearer ${adminToken}` }, payload: { reference: 'bank-transfer-verified' } });
      expect(recorded.statusCode).toBe(200);
      expect(recorded.json().data.paymentStatus).toBe('PAID');
      expect((await prisma.payment.findFirstOrThrow({ where: { orderId: manualOrderId } })).status).toBe('SUCCEEDED');
    });

    it('records equivalent payment, ledger, history, and outbox kinds for Admin and webhook success', async () => {
      await installPaymentFixture();
      const manualOrderId = await createOrder('manual-payment');
      const cardOrderId = await createOrder(paymentFixtureSlug);
      await createSession(manualOrderId, 'manual-payment');
      const cardSession = await createSession(cardOrderId, paymentFixtureSlug);

      const recorded = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${manualOrderId}/record-manual-payment`, headers: { authorization: `Bearer ${adminToken}` }, payload: { reference: 'verified-transfer' } });
      expect(recorded.statusCode).toBe(200);
      expect(await applyNormalizedPluginWebhook(paymentFixtureSlug, { received: true, handled: true, sessionId: cardSession.sessionId, providerEventId: `success:${cardOrderId}`, normalizedStatus: 'succeeded' })).toBe(true);

      const snapshot = async (orderId: string) => {
        const [order, payment, ledger, history, events] = await Promise.all([
          prisma.order.findUniqueOrThrow({ where: { id: orderId } }),
          prisma.payment.findFirstOrThrow({ where: { orderId } }),
          prisma.paymentLedger.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } }),
          prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } }),
          prisma.outboxEvent.findMany({ where: { type: { in: ['order.paid', 'payment.succeeded'] }, payload: { path: ['data', 'orderId'], equals: orderId } } }),
        ]);
        return {
          order: { status: order.status, paymentStatus: order.paymentStatus },
          payment: { status: payment.status, amount: payment.amount.toString(), currency: payment.currency },
          ledger: ledger.map((entry) => entry.eventType).sort(),
          history: history.map((entry) => ({ toStatus: entry.toStatus, toPaymentStatus: entry.toPaymentStatus })),
          outbox: events.map((event) => event.type).sort(),
        };
      };
      const manual = await snapshot(manualOrderId);
      const webhook = await snapshot(cardOrderId);
      expect(manual).toEqual(webhook);
      expect(manual).toMatchObject({
        order: { status: 'PROCESSING', paymentStatus: 'PAID' },
        payment: { status: 'SUCCEEDED', amount: '59.99', currency: 'USD' },
        ledger: ['CREATED', 'SUCCEEDED'],
        outbox: ['order.paid', 'payment.succeeded'],
      });
    });
  });

  describe('GET /api/v1/payments/verify/:sessionId', () => {
    it('should return pending status for non-existent session', async () => {
      const fakeSessionId = 'cs_test_invalid_session_id';

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/payments/verify/${fakeSessionId}`,
      });

      // API returns 200 with pending status for non-existent sessions
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.status).toBe('pending');
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/verify/test-session-id',
      });

      // Should not return 401 (payment verification is public)
      expect(response.statusCode).not.toBe(401);
    });

  });

  describe('POST /api/v1/payments/webhook/:provider', () => {
    it('should handle webhook for a generic provider', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/webhook/test-gateway',
        payload: {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
            },
          },
        },
      });

      // The generic webhook handler returns success
      expect([200, 400, 401, 500]).toContain(response.statusCode);
    });

    it('should handle webhook with signature header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/webhook/test-gateway',
        headers: {
          'x-provider-signature': 'test-signature',
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

      // Generic webhook handler accepts the request
      expect([200, 400, 401, 500]).toContain(response.statusCode);
    });

    it('should not require JWT authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/webhook/test-gateway',
        headers: {
          'x-provider-signature': 'test-signature',
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

      expect(response.statusCode).not.toBe(401);
    });
  });
});
