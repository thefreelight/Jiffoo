/**
 * Payments Endpoints Tests
 * 
 * Coverage:
 * - GET /api/v1/payments/available-methods
 * - POST /api/v1/payments/create-session
 * - GET /api/v1/payments/verify/:paymentId
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
import { checkoutPaymentFixtureSource, installFixturePlugin, removeFixturePlugin, verifiedPaymentFixtureFact } from '../helpers/fixture-plugin';
import { deliverCoreEvents } from '../helpers/core-events';
import { EventDeliveryEngine } from '@/infra/events/delivery';
import { CORE_EVENT_TARGET } from '@/infra/events/core-subscribers';
import { applyNormalizedPluginWebhook } from '@/core/payment/plugin-webhook';
import { env } from '@/config/env';
import { checkoutTotal } from '../helpers/checkout-total';

describe('Payments Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userEmail: string;
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
    const items = [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }];
    const expectedTotal = await checkoutTotal(app, userToken, items, validShippingAddress, 'free-shipping:free');
    const response = await app.inject({
      method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items, shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free', paymentMethod, expectedTotal, idempotencyKey: uuidv4(),
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
    await installFixturePlugin({ app, adminToken, adminUserId }, paymentFixtureSlug, 'payment', [{ name: 'payment', version: 2 }], checkoutPaymentFixtureSource);
    paymentFixtureInstalled = true;
  }

  /**
   * Deliver the pending outbox deliveries once.
   *
   * The helper of the core events delivers until nothing is pending, which a
   * failing delivery never reaches: the failed delivery stays pending for its
   * next attempt. This helper runs a single round of the worker, so the
   * recorded failure of a delivery is observable.
   */
  async function deliverOutboxOnce(): Promise<void> {
    const engine = new EventDeliveryEngine(`test-payment-session-${uuidv4()}`);
    try {
      await engine.runOnce();
      await engine.drain();
    } finally {
      await engine.stop();
    }
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    const { token, user } = await createUserWithToken();
    userToken = token;
    userEmail = user.email;
    const admin = await createAdminWithToken();
    adminToken = admin.token;
    adminUserId = admin.user.id;

    testProduct = await createTestProduct({
      name: 'Payment Test Product',
      price: 59.99,
      stock: 100,
    });
    const items = [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }];
    const expectedTotal = await checkoutTotal(app, userToken, items, validShippingAddress, checkoutSelection.shippingOptionId);
    // Create a test order
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items,
        shippingAddress: validShippingAddress,
        ...checkoutSelection,
        expectedTotal,
        idempotencyKey: uuidv4(),
      },
    });

    expect(orderResponse.statusCode).toBe(201);
    if (orderResponse.statusCode === 200 || orderResponse.statusCode === 201) {
      testOrderId = orderResponse.json().data.id;
    }
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    if (paymentFixtureInstalled) await removeFixturePlugin({ app, adminToken, adminUserId }, paymentFixtureSlug);
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
    it('L rejects a foreign-origin successUrl with a stable code', async () => {
      const { token } = await createUserWithToken();
      const response = await app.inject({
        method: 'POST', url: '/api/v1/payments/create-session',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          orderId: uuidv4(), paymentMethod: 'manual-payment',
          successUrl: 'https://foreign.example/return',
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('INVALID_PAYMENT_RETURN_ORIGIN');
    });

    it('M accepts a successUrl under the storefront origin', async () => {
      await installPaymentFixture();
      const { token } = await createUserWithToken();
      const ownProduct = await createTestProduct({ name: `Return URL ${uuidv4()}`, price: 20, stock: 5 });
      const items = [{ productId: ownProduct.id, variantId: ownProduct.variants[0].id, quantity: 1 }];
      const expectedTotal = await checkoutTotal(app, token, items, validShippingAddress, 'free-shipping:free');
      const orderResponse = await app.inject({
        method: 'POST', url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          items,
          shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free',
          paymentMethod: paymentFixtureSlug, expectedTotal, idempotencyKey: uuidv4(),
        },
      });
      expect(orderResponse.statusCode).toBe(201);
      const orderId = orderResponse.json().data.id as string;
      const successUrl = `${env.STOREFRONT_URL}/order/confirmation`;
      const response = await app.inject({
        method: 'POST', url: '/api/v1/payments/create-session',
        headers: { authorization: `Bearer ${token}` },
        payload: { orderId, paymentMethod: paymentFixtureSlug, successUrl },
      });
      expect(response.statusCode).toBe(200);
      const actionUrl = new URL(response.json().data.action.url);
      expect(actionUrl.searchParams.get('return')).toBe(successUrl);
    });

    it('uses STOREFRONT_URL for payment return and cancel URLs', async () => {
      await installPaymentFixture();
      const original = env.STOREFRONT_URL;
      try {
        env.STOREFRONT_URL = 'https://store.example';
        const orderId = await createOrder(paymentFixtureSlug);
        const result = await createSession(orderId, paymentFixtureSlug);
        const url = new URL((result.action as { type: 'redirect'; url: string }).url);
        expect(url.searchParams.get('return')).toBe('https://store.example/payment/return');
        expect(url.searchParams.get('cancel')).toBe('https://store.example/payment/cancel');
      } finally {
        env.STOREFRONT_URL = original;
      }
    });
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
      // The order confirmation is written by the core subscriber after the
      // payment transaction committed, so the notification row does not exist
      // while the request is answered.
      expect(await prisma.notification.count({ where: { type: 'order_confirmation', relatedId: testOrderId } })).toBe(0);
      await deliverCoreEvents();
      const confirmations = await prisma.notification.findMany({ where: { type: 'order_confirmation', relatedId: testOrderId } });
      expect(confirmations).toHaveLength(1);
      expect(confirmations[0].text).toContain('Pay manually.');
      // The arguments and the dedup key of the notification are the ones the
      // inline write used.
      expect(confirmations[0]).toMatchObject({
        type: 'order_confirmation', relatedType: 'order', relatedId: testOrderId,
        dedupKey: `notification:order_confirmation:${testOrderId}`, toAddress: userEmail,
      });
      const order = await prisma.order.findUniqueOrThrow({ where: { id: testOrderId } });
      expect(confirmations[0].text).toContain(order.orderNumber);

      const replay = await app.inject({ method: 'POST', url: '/api/v1/payments/create-session', headers: { authorization: `Bearer ${userToken}` }, payload });
      expect(replay.statusCode).toBe(200);
      expect(replay.json().data).toMatchObject({ sessionId: stored.sessionId, action: stored.actionJson });
      expect(await prisma.payment.count({ where: { idempotencyKey: payload.idempotencyKey } })).toBe(1);
      await deliverCoreEvents();
      expect(await prisma.notification.count({ where: { type: 'order_confirmation', relatedId: testOrderId } })).toBe(1);
    });

    it('keeps the payment session committed and answers the customer when the order confirmation cannot be written', async () => {
      const orderId = await createOrder('manual-payment');
      // The constraint rejects the confirmation of this order only, so the
      // notification insert of the core subscriber fails.
      const constraint = `notification_confirmation_rejection_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      await prisma.$executeRawUnsafe(`ALTER TABLE notifications ADD CONSTRAINT ${constraint} CHECK (type <> 'order_confirmation' OR "relatedId" <> '${orderId}')`);
      try {
        const response = await app.inject({
          method: 'POST', url: '/api/v1/payments/create-session',
          headers: { authorization: `Bearer ${userToken}` },
          payload: { orderId, paymentMethod: 'manual-payment', idempotencyKey: `failing-confirmation-${orderId}` },
        });
        // The failing notification does not roll back the payment session and
        // does not fail the request of the customer.
        expect(response.statusCode).toBe(200);
        expect(response.json().data.sessionId).toBeTruthy();
        const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
        expect(payment.sessionId).toBeTruthy();
        expect(payment.status).not.toBe('CREATING');
        expect(await prisma.notification.count({ where: { type: 'order_confirmation', relatedId: orderId } })).toBe(0);
        // The failure is observable: the outbox records it on the delivery.
        const deliveryWhere = { installationId: CORE_EVENT_TARGET, event: { aggregateId: orderId, type: 'order.confirmed' } };
        let delivery = await prisma.eventDelivery.findFirst({ where: deliveryWhere });
        for (let round = 0; round < 5 && !delivery?.lastError; round++) {
          await deliverOutboxOnce();
          delivery = await prisma.eventDelivery.findFirst({ where: deliveryWhere });
        }
        expect(delivery).not.toBeNull();
        expect(delivery?.lastError).toBeTruthy();
        expect(delivery?.status).toBe('PENDING');
      } finally {
        await prisma.$executeRawUnsafe(`ALTER TABLE notifications DROP CONSTRAINT ${constraint}`);
        // The failed delivery stays pending for its next attempt, so it is
        // removed here: it must not disturb the next test file.
        await prisma.eventDelivery.deleteMany({ where: { event: { aggregateId: orderId } } });
        await prisma.eventRecord.deleteMany({ where: { aggregateId: orderId } });
      }
    });

    it('consumes the order confirmation of an order that is gone without a failed delivery', async () => {
      const orderId = `gone-order-${uuidv4()}`;
      const event = await prisma.eventRecord.create({ data: {
        id: uuidv4(), type: 'order.confirmed', version: 1, aggregateId: orderId,
        data: { id: orderId, orderId, instructions: 'Pay manually.' },
      } });
      const delivery = await prisma.eventDelivery.create({ data: { eventId: event.id, installationId: CORE_EVENT_TARGET } });
      try {
        for (let round = 0; round < 5; round++) {
          await deliverOutboxOnce();
          const settled = await prisma.eventDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
          if (settled.status !== 'PENDING') break;
        }
        const settled = await prisma.eventDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
        // There is nobody to notify: the recipient is resolved through the
        // order projection, so the delivery is consumed instead of failed.
        expect(settled.status).toBe('SUCCEEDED');
        expect(settled.lastError).toBeNull();
        expect(await prisma.notification.count({ where: { relatedType: 'order', relatedId: orderId } })).toBe(0);
      } finally {
        await prisma.eventDelivery.delete({ where: { id: delivery.id } });
        await prisma.eventRecord.delete({ where: { id: event.id } });
      }
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

      const rejected = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${cardOrderId}/record-manual-payment`, headers: { authorization: `Bearer ${adminToken}` }, payload: { reference: 'verified-reference' } });
      expect(rejected.statusCode).toBe(409);
      expect(rejected.json().error.code).toBe('MANUAL_CONFIRMATION_NOT_SUPPORTED');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: cardOrderId } })).paymentStatus).toBe('PENDING');

      const recorded = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${manualOrderId}/record-manual-payment`, headers: { authorization: `Bearer ${adminToken}` }, payload: { reference: 'bank-transfer-verified' } });
      expect(recorded.statusCode).toBe(200);
      expect(recorded.json().data.paymentStatus).toBe('PAID');
      expect((await prisma.payment.findFirstOrThrow({ where: { orderId: manualOrderId } })).status).toBe('SUCCEEDED');
    });

    it('records equivalent payment, ledger, history, and event kinds for Admin and webhook success', async () => {
      await installPaymentFixture();
      const manualOrderId = await createOrder('manual-payment');
      const cardOrderId = await createOrder(paymentFixtureSlug);
      await createSession(manualOrderId, 'manual-payment');
      const cardSession = await createSession(cardOrderId, paymentFixtureSlug);

      const recorded = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${manualOrderId}/record-manual-payment`, headers: { authorization: `Bearer ${adminToken}` }, payload: { reference: 'verified-transfer' } });
      expect(recorded.statusCode).toBe(200);
      const fact = await verifiedPaymentFixtureFact(paymentFixtureSlug, cardSession.sessionId, `success:${cardOrderId}`);
      expect(await applyNormalizedPluginWebhook(paymentFixtureSlug, fact)).toBe(true);
      await deliverCoreEvents();
      expect(await prisma.notification.count({ where: { type: 'payment_received', relatedId: manualOrderId } })).toBe(1);
      expect(await prisma.notification.count({ where: { type: 'payment_received', relatedId: cardOrderId } })).toBe(1);
      expect(await applyNormalizedPluginWebhook(paymentFixtureSlug, fact)).toBe(false);
      expect(await prisma.notification.count({ where: { type: 'payment_received', relatedId: cardOrderId } })).toBe(1);

      const snapshot = async (orderId: string) => {
        const [order, payment, ledger, history, events] = await Promise.all([
          prisma.order.findUniqueOrThrow({ where: { id: orderId } }),
          prisma.payment.findFirstOrThrow({ where: { orderId } }),
          prisma.paymentLedger.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } }),
          prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } }),
          prisma.eventRecord.findMany({ where: { type: { in: ['order.paid', 'payment.succeeded'] }, data: { path: ['orderId'], equals: orderId } } }),
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

  describe('GET /api/v1/payments/verify/:paymentId', () => {
    it('should return pending status for non-existent session', async () => {
      const fakeSessionId = 'cs_test_invalid_session_id';

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/payments/verify/${fakeSessionId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/verify/test-session-id',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('UNAUTHORIZED');
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

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('PLUGIN_NOT_FOUND');
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

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('PLUGIN_NOT_FOUND');
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
