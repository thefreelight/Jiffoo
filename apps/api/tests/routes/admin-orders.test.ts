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

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AsyncLocalStorage } from 'node:async_hooks';
import type Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import {
  createTestProduct,
  createTestOrder,
  createTestOrderItem,
  deleteAllTestProducts,
  deleteAllTestOrders,
} from '../helpers/fixtures';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/config/database';
import path from 'path';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { checkoutTotal } from '../helpers/checkout-total';
import { deliverCoreEvents } from '../helpers/core-events';
import { CacheService } from '@/core/cache/service';
import { sharedProtection } from '@/infra/shared-protection';

function installProtectionDiagnostics() {
  const protection = sharedProtection as unknown as { client: Redis; closed: boolean; connecting?: Promise<unknown> };
  const context = new AsyncLocalStorage<{ operation?: string; evaluationId?: number }>();
  const clients = new WeakMap<Redis, number>();
  const cleanups: Array<() => void> = [];
  let nextEvaluationId = 0, nextClientId = 0, active = true;
  const record = (event: string, details: Record<string, unknown> = {}, client = protection.client) => {
    if (!active) return;
    console.info('Admin orders protection diagnostic', JSON.stringify({
      event, at: new Date().toISOString(), monotonicNs: process.hrtime.bigint().toString(), pid: process.pid,
      ...context.getStore(), clientId: clients.get(client), status: client.status,
      closed: protection.closed, connecting: Boolean(protection.connecting), ...details,
    }));
  };
  const errorState = (error: unknown) => {
    const value = error as { name?: string; code?: string; message?: string } | undefined;
    const errorClass = ['Error', 'ReplyError', 'AbortError', 'MaxRetriesPerRequestError', 'SharedProtectionUnavailable', 'TypeError'].includes(value?.name ?? '') ? value!.name : 'OTHER';
    const errorCode = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'SHARED_PROTECTION_UNAVAILABLE'].includes(value?.code ?? '') ? value!.code : 'OTHER';
    const classification = value?.message === 'Command timed out' ? 'COMMAND_TIMEOUT'
      : value?.message === "Stream isn't writeable and enableOfflineQueue options is false" ? 'NONWRITABLE'
      : value?.message === 'Connection is closed.' ? 'CONNECTION_CLOSED'
      : value?.message === 'Redis is already connecting/connected' ? 'ALREADY_CONNECTING'
      : value?.code === 'SHARED_PROTECTION_UNAVAILABLE' ? 'NORMALIZED_UNAVAILABLE_AMBIGUOUS' : 'OTHER';
    return { errorClass, errorCode, classification };
  };
  const trace = (target: object, method: string, client?: Redis, onReturn?: (value: unknown) => void) => {
    const methods = target as Record<string, (...args: unknown[]) => unknown>;
    const original = methods[method];
    const spy = vi.spyOn(methods, method).mockImplementation(function (this: unknown, ...args: unknown[]) {
      const inherited = context.getStore();
      const scope = method === 'evaluate' ? { ...inherited, evaluationId: ++nextEvaluationId }
        : method === 'breaker' || method === 'result' ? { ...inherited, operation: method } : inherited;
      return context.run(scope ?? {}, () => {
        const started = process.hrtime.bigint();
        const elapsedMs = () => Number(process.hrtime.bigint() - started) / 1_000_000;
        record(method + '-start', {}, client);
        try {
          const result = Reflect.apply(original, this, args);
          onReturn?.(result);
          if (result instanceof Promise) {
            void result.then(
              () => record(method + '-resolved', { elapsedMs: elapsedMs() }, client),
              error => record(method + '-rejected', { elapsedMs: elapsedMs(), ...errorState(error) }, client),
            ).catch(() => undefined);
          } else record(method + '-returned', { elapsedMs: elapsedMs() }, client);
          return result;
        } catch (error) {
          record(method + '-threw', { elapsedMs: elapsedMs(), ...errorState(error) }, client);
          throw error;
        }
      });
    });
    cleanups.push(() => spy.mockRestore());
  };
  const observeClient = (client: Redis) => {
    if (clients.has(client)) return;
    clients.set(client, ++nextClientId);
    for (const event of ['connect', 'ready', 'close', 'reconnecting', 'end', 'error']) {
      const listener = (error?: unknown) => record('client-' + event, event === 'error' ? errorState(error) : {}, client);
      client.on(event, listener);
      cleanups.push(() => client.off(event, listener));
    }
    trace(client, 'connect', client);
    trace(client, 'eval', client);
    record('client-observed', {}, client);
  };
  const restore = () => {
    record('diagnostics-cleanup');
    active = false;
    for (const cleanup of cleanups.reverse()) cleanup();
    context.disable();
  };
  try {
    observeClient(protection.client);
    trace(sharedProtection, 'createClient', undefined, value => observeClient(value as Redis));
    for (const method of ['evaluate', 'breaker', 'result']) trace(sharedProtection, method);
  } catch (error) { restore(); throw error; }
  return { record, restore };
}

describe('Admin Orders Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testOrderId: string;
  let protectionDiagnostics: ReturnType<typeof installProtectionDiagnostics> | undefined;
  const validShippingAddress = {
    firstName: 'Admin', lastName: 'Order', phone: '+1-555-0102', addressLine1: '1 Admin Way',
    city: 'Test City', state: 'CA', postalCode: '94016', country: 'US',
  };

  beforeAll(async () => {
    protectionDiagnostics = installProtectionDiagnostics();
    protectionDiagnostics.record('before-builtin-sync');
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    protectionDiagnostics.record('after-builtin-sync');
    protectionDiagnostics.record('before-create-test-app');
    app = await createTestApp();
    protectionDiagnostics.record('after-create-test-app');

    protectionDiagnostics.record('before-user-auth');
    const { token: uToken } = await createUserWithToken();
    protectionDiagnostics.record('after-user-auth');
    protectionDiagnostics.record('before-admin-auth');
    const { token: aToken } = await createAdminWithToken();
    protectionDiagnostics.record('after-admin-auth');

    userToken = uToken;
    adminToken = aToken;

    protectionDiagnostics.record('before-product-fixture');
    testProduct = await createTestProduct({
      name: 'Admin Order Test Product',
      price: 99.99,
      stock: 100,
    });
    protectionDiagnostics.record('after-product-fixture');
    protectionDiagnostics.record('before-checkout-total');
    const expectedTotal = await checkoutTotal(app, userToken,
      [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }],
      validShippingAddress, 'free-shipping:free');
    protectionDiagnostics.record('after-checkout-total');

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
    try {
      await deleteAllTestOrders();
      await deleteAllTestProducts();
      await deleteAllTestUsers();
      if (app) await app.close();
    } finally { protectionDiagnostics?.restore(); }
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
    it('returns real status counts, distinct review orders, quantity sums and isolated payment filters', async () => {
      const headers = { authorization: `Bearer ${adminToken}` };
      const stats = async () => (await app.inject({ method: 'GET', url: '/api/v1/admin/orders/stats', headers })).json().data;
      const before = await stats();
      const userId = (await prisma.order.findUniqueOrThrow({ where: { id: testOrderId } })).userId;
      const owned: string[] = [];
      const { providerKey } = await prisma.paymentProviderAccount.create({ data: { namespace: 'u1c-orders', merchantAccount: uuidv4(), environment: 'test' } });
      try {
        for (const status of ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']) {
          const order = await createTestOrder({ userId, status, total: 50 }); owned.push(order.id);
        }
        const reviewId = owned[0];
        for (const quantity of [2, 3]) await createTestOrderItem({ orderId: reviewId, productId: testProduct.id, quantity });
        for (const attemptNumber of [1, 2]) await prisma.payment.create({ data: {
          orderId: reviewId, providerKey, paymentMethod: 'manual-payment', amount: 50, status: attemptNumber === 1 ? 'FAILED' : 'REQUIRES_REVIEW', attemptNumber, idempotencyKey: uuidv4(),
        } });
        await prisma.payment.create({ data: { orderId: owned[1], providerKey, paymentMethod: 'manual-payment', amount: 50, status: 'PENDING', idempotencyKey: uuidv4() } });
        const resolved = await prisma.payment.create({ data: { orderId: owned[2], providerKey, paymentMethod: 'manual-payment', amount: 50, status: 'REQUIRES_REVIEW', idempotencyKey: uuidv4() } });
        const closeReview = async (orderId: string, paymentId: string) => {
          const response = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${orderId}/close-review-payment`, headers, payload: { paymentId, reference: `review-proof:${paymentId}` } });
          expect(response.statusCode).toBe(200);
        };
        await closeReview(owned[2], resolved.id);
        await prisma.order.update({ where: { id: owned[3] }, data: { paymentStatus: 'PAID' } });
        await prisma.order.update({ where: { id: owned[4] }, data: { paymentStatus: 'FAILED' } });
        await prisma.order.update({ where: { id: owned[5] }, data: { paymentStatus: 'REFUNDED' } });
        await CacheService.incrementOrderVersion();
        const after = await stats();
        for (const status of ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']) expect(after.statusCounts[status]).toBe(before.statusCounts[status] + 1);
        expect(after.paymentReviewCount).toBe(before.paymentReviewCount + 1);
        const list = async (query: string) => {
          const response = await app.inject({ method: 'GET', url: '/api/v1/admin/orders/?limit=100&' + query, headers });
          expect(response.statusCode).toBe(200); return response.json().data;
        };
        // An earlier release's cached projection lacks the new required fields.
        await CacheService.setOrderList(1, 100, { items: [], page: 1, limit: 100, total: 0, totalPages: 0 }, {});
        const all = await list('');
        expect(all.items.find((item: any) => item.id === reviewId)).toMatchObject({ itemsCount: 2, itemQuantitySum: 5, requiresPaymentReview: true });
        for (const id of owned.slice(1)) expect(all.items.find((item: any) => item.id === id).requiresPaymentReview).toBe(false);
        const review = await list('paymentReview=required');
        expect(review.total).toBe(after.paymentReviewCount);
        expect(review.items.every((item: any) => item.requiresPaymentReview)).toBe(true);
        expect((await list('paymentReview=required&status=SHIPPED')).items).toEqual([]);
        expect((await list('paymentReview=required&search=' + reviewId)).items.map((item: any) => item.id)).toEqual([reviewId]);
        const paid = await list('paymentStatus=PAID'); expect(paid.items.every((item: any) => item.paymentStatus === 'PAID')).toBe(true);
        expect(paid.items.some((item: any) => item.id === owned[3])).toBe(true);
        const unpaid = await list('paymentStatus=UNPAID'); expect(unpaid.items.every((item: any) => ['PENDING', 'FAILED'].includes(item.paymentStatus))).toBe(true);
        expect(unpaid.items.some((item: any) => item.id === owned[4])).toBe(true);
        const refunded = await list('paymentStatus=REFUNDED'); expect(refunded.items.every((item: any) => item.paymentStatus === 'REFUNDED')).toBe(true);
        expect(refunded.items.some((item: any) => item.id === owned[5])).toBe(true);
        expect((await app.inject({ method: 'GET', url: '/api/v1/admin/orders/?paymentReview=pending', headers })).statusCode).toBe(400);
        for (const token of [undefined, userToken]) {
          const response = await app.inject({ method: 'GET', url: '/api/v1/admin/orders/stats', headers: token ? { authorization: `Bearer ${token}` } : {} });
          expect(response.statusCode).toBe(token ? 403 : 401);
        }
        for (const payment of await prisma.payment.findMany({ where: { orderId: reviewId, status: 'REQUIRES_REVIEW' } })) await closeReview(reviewId, payment.id);
        expect((await stats()).paymentReviewCount).toBe(before.paymentReviewCount);
        expect((await list('paymentReview=required&search=' + reviewId)).items).toEqual([]);
      } finally {
        const payments = await prisma.payment.findMany({ where: { orderId: { in: owned } }, select: { id: true } });
        await prisma.adminAuditEvent.deleteMany({ where: { targetType: 'payment', targetId: { in: payments.map(payment => payment.id) } } });
        await prisma.payment.deleteMany({ where: { orderId: { in: owned } } });
        await prisma.orderItem.deleteMany({ where: { orderId: { in: owned } } });
        await prisma.order.deleteMany({ where: { id: { in: owned } } });
        await prisma.paymentProviderAccount.delete({ where: { providerKey } });
        await CacheService.incrementOrderVersion();
      }
    });
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
    it('projects real amounts, private timeline fields and customer snapshot email after payment and shipment', async () => {
      const headers = { authorization: `Bearer ${adminToken}` };
      const expectedTotal = await checkoutTotal(app, userToken,
        [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }], validShippingAddress, 'free-shipping:free');
      const created = await app.inject({ method: 'POST', url: '/api/v1/orders/', headers: { authorization: `Bearer ${userToken}` }, payload: {
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }], shippingAddress: validShippingAddress,
        shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal, idempotencyKey: uuidv4(),
      } });
      expect(created.statusCode).toBe(201);
      const id = created.json().data.id;
      const original = await prisma.order.findUniqueOrThrow({ where: { id }, include: { user: true } });
      const provider = await prisma.paymentProviderAccount.upsert({
        where: { namespace_merchantAccount_environment: { namespace: 'jiffoo-manual', merchantAccount: 'store', environment: 'live' } },
        update: {}, create: { namespace: 'jiffoo-manual', merchantAccount: 'store', environment: 'live' },
      });
      await prisma.payment.create({ data: { orderId: id, providerKey: provider.providerKey, paymentMethod: 'manual-payment', amount: original.totalAmount,
        currency: original.currency, status: 'PENDING', sessionId: 'u3-manual-' + id, idempotencyKey: 'u3-manual-' + id } });
      const paid = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${id}/record-manual-payment`, headers, payload: { reference: 'u3-receipt-' + id } });
      expect(paid.statusCode).toBe(200); expect(paid.json().data).toMatchObject({ status: 'PROCESSING', paymentStatus: 'PAID' });
      const shipped = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${id}/ship`, headers, payload: { carrier: 'U3 Carrier', trackingNumber: 'U3-' + id } });
      expect(shipped.statusCode).toBe(200);
      const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/orders/${id}`, headers });
      expect(detail.statusCode).toBe(200);
      const data = detail.json().data;
      expect(data.amounts).toEqual({ subtotal: Number(original.subtotalAmount), shipping: Number(original.shippingAmount), tax: Number(original.taxAmount),
        taxInclusive: original.taxInclusive, total: Number(original.totalAmount) });
      expect(data.totalAmount).toBe(Number(original.totalAmount));
      const history = await prisma.orderStatusHistory.findMany({ where: { orderId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      expect(data.timeline).toEqual(history.map(row => ({ at: row.createdAt.toISOString(), fromStatus: row.fromStatus, toStatus: row.toStatus,
        fromPaymentStatus: row.fromPaymentStatus, toPaymentStatus: row.toPaymentStatus, actorType: row.actorType })));
      expect(data.timeline.map((row: any) => row.toStatus)).toEqual(['PENDING', 'PROCESSING', 'SHIPPED']);
      expect(data.timeline[1]).toMatchObject({ fromStatus: 'PENDING', toStatus: 'PROCESSING', toPaymentStatus: 'PAID', actorType: 'admin' });
      expect(data.timeline.every((row: any) => !('actorId' in row) && !('metadata' in row) && !('reason' in row))).toBe(true);
      try {
        await prisma.order.update({ where: { id }, data: { customerEmail: 'snapshot@u3.example' } });
        await prisma.user.update({ where: { id: original.userId }, data: { email: '' } });
        expect((await app.inject({ method: 'GET', url: `/api/v1/admin/orders/${id}`, headers })).json().data.customer.email).toBe('snapshot@u3.example');
      } finally {
        await prisma.user.update({ where: { id: original.userId }, data: { email: original.user.email } });
      }
    });
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
          providerKey: (await prisma.paymentProviderAccount.upsert({ where: { namespace_merchantAccount_environment: { namespace: 'jiffoo-manual', merchantAccount: 'store', environment: 'live' } }, update: {}, create: { namespace: 'jiffoo-manual', merchantAccount: 'store', environment: 'live' } })).providerKey,
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
        metadata: { manualReference: 'cash-receipt-001', refundRequired: false },
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
    it('queues one shipped notification on the shipped transition', async () => {
      const expectedTotal = await checkoutTotal(app, userToken,
        [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }],
        validShippingAddress, 'free-shipping:free');
      const created = await app.inject({
        method: 'POST', url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }],
          shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal, idempotencyKey: uuidv4(),
        },
      });
      expect(created.statusCode).toBe(201);
      const id = created.json().data.id as string;
      const session = await app.inject({
        method: 'POST', url: '/api/v1/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { orderId: id, paymentMethod: 'manual-payment' },
      });
      expect(session.statusCode).toBe(200);
      const paid = await app.inject({
        method: 'POST', url: `/api/v1/admin/orders/${id}/record-manual-payment`,
        headers: { authorization: `Bearer ${adminToken}` }, payload: { reference: 'shipping-payment-reference' },
      });
      expect(paid.statusCode).toBe(200);
      const shipped = await app.inject({
        method: 'POST', url: `/api/v1/admin/orders/${id}/ship`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { carrier: 'FedEx', trackingNumber: `TRACK-${uuidv4()}` },
      });
      expect(shipped.statusCode).toBe(200);
      await deliverCoreEvents();
      expect(await prisma.notification.count({ where: { relatedId: id, type: 'shipped' } })).toBe(1);
    });
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

      expect(response.statusCode).toBe(200);
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
          reference: 'offline-refund-reference',
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
          reference: 'offline-refund-reference',
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
          reference: 'offline-refund-reference',
          reason: 'Customer request',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/admin/orders/:id/cancel', () => {
    it('queues a cancellation notification on Admin cancellation', async () => {
      const expectedTotal = await checkoutTotal(app, userToken,
        [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }],
        validShippingAddress, 'free-shipping:free');
      const created = await app.inject({
        method: 'POST', url: '/api/v1/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }],
          shippingAddress: validShippingAddress, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal, idempotencyKey: uuidv4(),
        },
      });
      expect(created.statusCode).toBe(201);
      const id = created.json().data.id as string;
      const cancelled = await app.inject({
        method: 'POST', url: `/api/v1/admin/orders/${id}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` }, payload: { cancelReason: 'Admin requested cancellation' },
      });
      expect(cancelled.statusCode).toBe(200);
      await deliverCoreEvents();
      const notifications = await prisma.notification.findMany({ where: { relatedId: id, type: 'cancelled' } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].text).toContain('Admin requested cancellation');
    });
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

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('INVALID_ORDER_TRANSITION');
    });
  });
});
