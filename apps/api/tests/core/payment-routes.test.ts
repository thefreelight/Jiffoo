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
    payment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/core/admin/plugin-management/service', () => ({
  PluginManagementService: {
    getAllPluginPackages: vi.fn(),
    getDefaultInstance: vi.fn(),
  },
}));

vi.mock('@/core/admin/system-settings/service', () => ({
  systemSettingsService: {
    getShopCurrency: vi.fn(),
  },
}));

vi.mock('@/core/cache/service', () => ({
  CacheService: {
    getPluginVersion: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/core/auth/middleware', () => ({
  authMiddleware: vi.fn(async (request: any) => {
    request.user = { id: 'user-1', email: 'test@example.com', role: 'USER' };
  }),
}));

vi.mock('@/core/logger/unified-logger', () => ({
  LoggerService: {
    logPayment: vi.fn(),
  },
}));

vi.mock('@/core/payment/plugin-gateway', () => ({
  callPaymentPlugin: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { paymentRoutes } from '@/core/payment/routes';
import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { CacheService } from '@/core/cache/service';
import { authMiddleware } from '@/core/auth/middleware';
import { callPaymentPlugin } from '@/core/payment/plugin-gateway';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_GATEWAY_PACKAGE = {
  slug: 'test-gateway-payment',
  name: 'Test Gateway',
  category: 'payment',
  manifestJson: '{"supportedCurrencies":["USD","EUR"]}',
};

const ENABLED_INSTANCE = {
  enabled: true,
  deletedAt: null,
  configJson: '{"mode":"test"}',
};

/** Configure the standard "happy-path" mocks for a single payment plugin. */
function setupDefaultMocks() {
  (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
  (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  (systemSettingsService.getShopCurrency as ReturnType<typeof vi.fn>).mockResolvedValue('USD');
  (PluginManagementService.getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue([
    TEST_GATEWAY_PACKAGE,
  ]);
  (PluginManagementService.getDefaultInstance as ReturnType<typeof vi.fn>).mockResolvedValue(
    ENABLED_INSTANCE,
  );
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
    });

    it('should return an empty array when no payment plugins are installed', async () => {
      (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
      (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (PluginManagementService.getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue(
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
    it('should use the built-in manual payment when no payment plugins are available', async () => {
      (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
      (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (PluginManagementService.getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (systemSettingsService.getShopCurrency as ReturnType<typeof vi.fn>).mockResolvedValue('USD');
      (prisma.order.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'order-1',
        totalAmount: 12.34,
        paymentStatus: 'PENDING',
        paymentAttempts: 0,
      });
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const tx = {
        payment: { create: vi.fn().mockResolvedValue({ id: 'payment-1', sessionId: 'manual_order-1_1', sessionUrl: 'http://localhost:3000/en/payment/manual?order_id=order-1' }) },
        paymentLedger: { create: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({}) },
      };
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-session',
        payload: {
          paymentMethod: 'test-gateway-payment',
          orderId: 'order-1',
          successUrl: 'https://shop.example/en/order-success',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.sessionId).toBe('manual_order-1_1');
      expect(body.data.url).toBe('http://localhost:3000/en/payment/manual?order_id=order-1');
      expect(tx.paymentLedger.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ eventType: 'CREATED', provider: 'manual' }),
      }));
    });

    it('should call authMiddleware for authentication', async () => {
      // Even though the request will fail for other reasons, authMiddleware
      // must be invoked as the route declares onRequest: [authMiddleware].
      (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
      (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (PluginManagementService.getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue(
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
      (prisma.order.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'order-1',
        totalAmount: 12.34,
        paymentStatus: 'PENDING',
        paymentAttempts: 0,
      });
      (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (callPaymentPlugin as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        payload: { data: { sessionId: 'test-gateway-session-1', url: 'https://gateway.example/session' } },
      });
      const tx = {
        payment: { create: vi.fn().mockResolvedValue({ id: 'payment-1' }) },
        paymentLedger: { create: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({}) },
      };
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-session',
        payload: { paymentMethod: 'test-gateway-payment', orderId: 'order-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(callPaymentPlugin).toHaveBeenCalledWith(expect.objectContaining({ pluginSlug: 'test-gateway-payment' }));
      expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: 'test-gateway-payment' }),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/payments/verify/:sessionId
  // -----------------------------------------------------------------------

  describe('GET /api/v1/payments/verify/:sessionId', () => {
    it('should resolve a manual payment without calling a payment extension', async () => {
      const manualPayment = {
        id: 'payment-1',
        orderId: 'order-1',
        sessionId: 'manual_order-1_1',
        status: 'PENDING',
        paymentMethod: 'manual',
        updatedAt: new Date('2025-06-01T12:00:00Z'),
      };
      (prisma.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(manualPayment);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/verify/manual_order-1_1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        orderId: 'order-1',
        status: 'PENDING',
        paymentMethod: 'manual',
      });
    });

    it('should return payment status for a known session', async () => {
      const mockPayment = {
        id: 'pay-1',
        orderId: 'order-1',
        sessionId: 'sess-abc',
        status: 'SUCCEEDED',
        paymentMethod: 'test-gateway-payment',
        updatedAt: new Date('2025-06-01T12:00:00Z'),
        paymentIntentId: 'pi_123',
      };

      // syncPaymentFromPlugin will call findFirst first -- return the already
      // succeeded payment so it short-circuits.  Then the route handler calls
      // findFirst again for its own lookup.
      (prisma.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPayment);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/verify/sess-abc',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.sessionId).toBe('sess-abc');
      expect(body.data.orderId).toBe('order-1');
      expect(body.data.status).toBe('paid');
      expect(body.data.paymentMethod).toBe('test-gateway-payment');
    });

    it('should return pending status when session is not found', async () => {
      (prisma.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/verify/sess-unknown',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.sessionId).toBe('sess-unknown');
      expect(body.data.status).toBe('pending');
      expect(body.data.paymentMethod).toBe('unknown');
    });
  });
});
