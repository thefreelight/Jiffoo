/**
 * Payment Routes Unit Tests
 *
 * Tests the payment route handlers using Fastify's inject pattern with
 * fully mocked dependencies (database, plugin management, cache, auth).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the routes module
// ---------------------------------------------------------------------------

vi.mock('@/config/database', () => ({
  prisma: {
    pluginInstallation: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    payment: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    adminAuditEvent: { upsert: vi.fn().mockResolvedValue({}) },
    paymentLedger: { findFirst: vi.fn().mockResolvedValue({ createdAt: new Date('2025-06-01T12:00:00Z') }) },
    $transaction: vi.fn(),
  },
}));

// The registry mock keeps the real `declaresContract`: the payment routes read
// the declared contract of the installed package, and that check must stay a
// real one instead of a stub that always agrees.
vi.mock('@/core/extensions/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/extensions/registry')>();
  return {
    ...actual,
    getAllPluginPackages: vi.fn(),
    getDefaultInstance: vi.fn(),
  };
});

vi.mock('@/core/settings/service', () => ({
  systemSettingsService: {
    getShopCurrency: vi.fn(),
  },
}));

vi.mock('@/core/cache/service', () => ({
  CacheService: {
    getPluginVersion: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    incrementOrderVersion: vi.fn(),
  },
}));

const authState = vi.hoisted(() => ({ userId: 'user-1' }));
vi.mock('@/core/auth/middleware', () => ({
  authMiddleware: vi.fn(async (request: any) => {
    request.user = { id: authState.userId, email: 'test@example.com', role: 'USER' };
  }),
}));

// The verification endpoint spends a shared protection permit on every call.
// The unit test does not run Redis, so the permit is granted here.
vi.mock('@/infra/shared-protection', () => ({
  sharedProtection: { rate: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, retryAfter: 1 }) },
  SharedProtectionUnavailable: class SharedProtectionUnavailable extends Error {},
  sendProtectionUnavailable: vi.fn(),
}));

vi.mock('@/core/logger/unified-logger', () => ({
  LoggerService: {
    logPayment: vi.fn(),
  },
}));

vi.mock('@/core/extensions/runtime/plugin-runtime', () => ({
  callContract: vi.fn(),
}));

// The outbox is mocked: the unit test exercises the payment session, and the
// event write is asserted through the mock instead of through the database.
vi.mock('@/infra/events/emit', () => ({
  emitEvent: vi.fn().mockResolvedValue({ id: 'event-1' }),
  syncEventSubscriptions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/core/notifications/service', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/core/payment/provider-account', () => ({
  bindPaymentProviderAccount: vi.fn().mockResolvedValue({ account: { providerKey: 'account-1', namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' } }),
}));
vi.mock('@/core/payment/reconciliation', () => ({ queryPaymentByRequestKey: vi.fn() }));
// The webhook applies the payload of one request in one transaction: the
// facts are prepared before the transaction opens and applied inside it.
vi.mock('@/core/payment/observations', () => ({
  observePaymentFact: vi.fn(),
  preparePaymentFact: vi.fn().mockResolvedValue({ identity: null, evidence: {}, hash: 'evidence-hash', reason: null }),
  applyPreparedPaymentFact: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { paymentRoutes } from '@/core/payment/routes';
import { prisma } from '@/config/database';
import { getAllPluginPackages, getDefaultInstance } from '@/core/extensions/registry';
import { systemSettingsService } from '@/core/settings/service';
import { CacheService } from '@/core/cache/service';
import { authMiddleware } from '@/core/auth/middleware';
import { queryPaymentByRequestKey } from '@/core/payment/reconciliation';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { observePaymentFact, preparePaymentFact, applyPreparedPaymentFact } from '@/core/payment/observations';
import { emitEvent } from '@/infra/events/emit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_GATEWAY_PACKAGE = {
  slug: 'test-gateway-payment',
  name: 'Test Gateway',
  category: 'payment',
  manifestJson: {
    schemaVersion: 1,
    slug: 'test-gateway-payment',
    name: 'Test Gateway',
    version: '1.0.0',
    description: 'Test payment gateway',
    runtimeType: 'internal-fastify',
    hostProtocol: 'internal-fastify-v1',
    entryModule: 'server/index.js',
    permissions: [],
    contracts: [{ name: 'payment', version: 2 }],
  },
};

const ENABLED_INSTANCE = {
  enabled: true,
  deletedAt: null,
  configJson: '{"mode":"test"}',
};

/** Configure the standard "happy-path" mocks for a single payment plugin. */
function setupDefaultMocks() {
  vi.mocked(prisma.order.findFirst).mockResolvedValue({ id: 'order-1', orderNumber: 'JF-20261012-0001', userId: 'user-1', currency: 'USD', status: 'PENDING', paymentStatus: 'PENDING', paymentMethod: 'test-gateway-payment', totalAmount: 19.99 } as any);
  (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
  (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  (systemSettingsService.getShopCurrency as ReturnType<typeof vi.fn>).mockResolvedValue('USD');
  (getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue([
    TEST_GATEWAY_PACKAGE,
  ]);
  (getDefaultInstance as ReturnType<typeof vi.fn>).mockResolvedValue(
    ENABLED_INSTANCE,
  );
  (callContract as ReturnType<typeof vi.fn>).mockResolvedValue({
    displayName: 'Test Gateway', requiresManualConfirmation: false, unpaidTimeoutMinutes: 30, supportedCurrencies: ['USD', 'EUR'], account: { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' },
  });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Payment Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(paymentRoutes, { prefix: '/api/v1/payments' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/payments/available-methods
  // -----------------------------------------------------------------------

  describe('GET /api/v1/payments/available-methods', () => {
    it('should return payment methods from installed plugins', async () => {
      setupDefaultMocks();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/available-methods',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);

      const method = body.data[0];
      expect(method.pluginSlug).toBe('test-gateway-payment');
      expect(method.displayName).toBe('Test Gateway');
      expect(method.supportedCurrencies).toEqual(['USD', 'EUR']);
      expect(method.isLive).toBe(false); // mode is "test"
      expect(callContract).toHaveBeenCalledWith('test-gateway-payment', 'payment', 2, 'describe', { storeCurrency: 'USD' });
    });

    it('should return an empty array when no payment plugins are installed', async () => {
      (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
      (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/available-methods',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/payments/create-session
  // -----------------------------------------------------------------------

  describe('POST /api/v1/payments/create-session', () => {
    it('should reject session creation when no payment plugins are available', async () => {
      (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
      (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (systemSettingsService.getShopCurrency as ReturnType<typeof vi.fn>).mockResolvedValue('USD');
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-session',
        payload: {
          paymentMethod: 'test-gateway-payment',
          orderId: 'order-1',
          successUrl: 'https://shop.example/en/order-success',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should call authMiddleware for authentication', async () => {
      // Even though the request will fail for other reasons, authMiddleware
      // must be invoked as the route declares onRequest: [authMiddleware].
      (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
      (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-session',
        payload: {
          paymentMethod: 'test-gateway-payment',
          orderId: 'order-1',
        },
      });

      expect(authMiddleware).toHaveBeenCalled();
    });

    it('should prefer an enabled payment extension over the built-in manual payment', async () => {
      setupDefaultMocks();
      const order = {
        id: 'order-1',
        userId: 'user-1', currency: 'USD',
        totalAmount: 19.99,
        paymentStatus: 'PENDING',
        status: 'PENDING',
        paymentAttempts: 0,
        paymentMethod: 'test-gateway-payment',
      };
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (callContract as ReturnType<typeof vi.fn>).mockImplementation(async (_slug: string, _name: string, _version: number, method: string) => method === 'describe'
        ? { displayName: 'Test Gateway', requiresManualConfirmation: false, unpaidTimeoutMinutes: 30, supportedCurrencies: ['USD', 'EUR'], account: { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' } }
        : { sessionId: 'test-gateway-session-1', action: { type: 'redirect', url: 'https://gateway.example/session' } });
      let stored: any;
      const sequence: string[] = [];
      const tx = {
        payment: {
          create: vi.fn().mockImplementation(({ data }) => { sequence.push('reserved'); stored = { id: 'payment-1', ...data }; return stored; }),
          findUnique: vi.fn().mockImplementation(({ where }) => where.id ? stored : null), findFirst: vi.fn().mockResolvedValue(null),
          findUniqueOrThrow: vi.fn().mockImplementation(() => stored),
          updateMany: vi.fn().mockImplementation(({ data }) => { sequence.push('stored'); Object.assign(stored, data); return { count: 1 }; }),
        },
        paymentLedger: { create: vi.fn().mockResolvedValue({}) },
        order: { findUnique: vi.fn().mockResolvedValue(order), findUniqueOrThrow: vi.fn().mockResolvedValue(order), update: vi.fn().mockResolvedValue(order) },
        $queryRaw: vi.fn().mockResolvedValue([{ now: new Date('2026-10-10T00:00:00Z') }]),
      };
      (callContract as ReturnType<typeof vi.fn>).mockImplementation(async (_slug: string, _name: string, _version: number, method: string) => {
        if (method === 'describe') return { displayName: 'Test Gateway', requiresManualConfirmation: false, unpaidTimeoutMinutes: 30, supportedCurrencies: ['USD', 'EUR'], account: { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' } };
        sequence.push('provider'); return { sessionId: 'test-gateway-session-1', action: { type: 'redirect', url: 'https://gateway.example/session' } };
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
      vi.mocked(observePaymentFact).mockImplementation(async (_slug, fact) => {
        await tx.payment.updateMany({ data: { status: 'PENDING', sessionId: fact.sessionId, actionJson: fact.action } } as any); return true;
      });
      vi.mocked(emitEvent).mockImplementation(async (_transaction, type) => {
        if (type === 'order.confirmed') sequence.push('event');
        return { id: 'event-1' } as any;
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-session',
        payload: { paymentMethod: 'test-gateway-payment', orderId: 'order-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(callContract).toHaveBeenLastCalledWith('test-gateway-payment', 'payment', 2, 'createSession', expect.objectContaining({ amountMinor: 1999 }));
      expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: 'test-gateway-payment',
          status: 'CREATING', idempotencyKey: expect.any(String),
        }),
      }));
      expect(response.json().data.action).toEqual({ type: 'redirect', url: 'https://gateway.example/session' });
      // The order confirmation is an event of the payment session: it is
      // written with the transaction of the session, so the event and the
      // payment state stay atomic.
      expect(emitEvent).toHaveBeenCalledWith(
        tx,
        'order.confirmed',
        1,
        'order-1',
        { id: 'order-1', orderId: 'order-1', instructions: '' },
        { actorId: 'user-1' },
      );
      expect(sequence).toEqual(['reserved','provider','stored','event']);
    });

    it('passes a complete verified payment v2 fact to observation storage', async () => {
      (prisma.pluginInstallation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: true, deletedAt: null, plugin: { deletedAt: null } });
      (callContract as ReturnType<typeof vi.fn>).mockResolvedValue({
        verification: 'verified',
        events: [{ providerEventId: 'provider-event-1', account: { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' },
          requestKey: 'request-1', sessionId: 'plugin-session-1', status: 'succeeded', amountMinor: 1999, currency: 'USD', observedAt: '2026-10-10T00:00:00Z',
          canStillBeCharged: false, requestClosed: true, captures: [] }],
      });
      const tx = {
        paymentLedger: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
        payment: { update: vi.fn().mockResolvedValue({ id: 'payment-1', sessionId: 'plugin-session-1' }) },
        order: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({ id: 'order-1', status: 'PROCESSING', paymentStatus: 'PAID' }),
        },
        orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
        eventRecord: { create: vi.fn().mockResolvedValue({ id: 'payment-failed-event' }) },
        $queryRaw: vi.fn().mockResolvedValue([]),
      };
      (prisma.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'payment-1', orderId: 'order-1', amount: 19.99, currency: 'USD', metadata: {},
        order: { status: 'PENDING', paymentStatus: 'PENDING' },
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

      const response = await app.inject({ method: 'POST', url: '/api/v1/payments/webhook/test-gateway-payment', payload: { event: 'paid' } });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      // The fact of the payload is prepared before the transaction opens and
      // applied inside it, so the whole payload of one request is one
      // transaction.
      expect(preparePaymentFact).toHaveBeenCalledWith('test-gateway-payment', expect.objectContaining({ requestKey: 'request-1', amountMinor: 1999 }), 'webhook');
      expect(applyPreparedPaymentFact).toHaveBeenCalledWith('test-gateway-payment', expect.objectContaining({ requestKey: 'request-1', amountMinor: 1999 }), 'webhook', undefined, expect.anything(), expect.anything());
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/payments/verify/:paymentId
  // -----------------------------------------------------------------------

  describe('GET /api/v1/payments/verify/:paymentId', () => {
    beforeEach(() => { authState.userId = 'user-1'; });

    it('returns payment status for the Core payment id', async () => {
      const mockPayment = {
        id: 'pay-1',
        order: { orderNumber: 'JF-20261012-0001', userId: 'user-1' },
        orderId: 'order-1',
        sessionId: 'sess-abc',
        status: 'SUCCEEDED',
        paymentMethod: 'test-gateway-payment',
        updatedAt: new Date('2025-06-01T12:00:00Z'),
        paymentIntentId: 'pi_123',
      };

      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPayment);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/verify/pay-1',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.sessionId).toBe('sess-abc');
      expect(body.data.paymentId).toBe('pay-1');
      expect(body.data.orderId).toBe('order-1');
      expect(body.data.orderNumber).toBe('JF-20261012-0001');
      expect(body.data.status).toBe('paid');
      expect(body.data.paymentMethod).toBe('test-gateway-payment');
    });

    it('returns NOT_FOUND for an unknown Core payment id', async () => {
      (prisma.payment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/verify/sess-unknown',
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('hides a payment owned by another customer and never reaches the provider', async () => {
      authState.userId = 'user-2';
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'pay-1',
        order: { orderNumber: 'JF-20261012-0001', userId: 'user-1' },
        orderId: 'order-1',
        sessionId: 'sess-abc',
        status: 'SUCCEEDED',
        paymentMethod: 'test-gateway-payment',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/verify/pay-1',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(JSON.stringify(body)).not.toContain('pay-1');
      expect(JSON.stringify(body)).not.toContain('order-1');
      expect(queryPaymentByRequestKey).not.toHaveBeenCalled();
    });
  });
});
