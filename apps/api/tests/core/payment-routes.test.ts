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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { paymentRoutes } from '@/core/payment/routes';
import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { CacheService } from '@/core/cache/service';
import { authMiddleware } from '@/core/auth/middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STRIPE_PACKAGE = {
  slug: 'stripe-payment',
  name: 'Stripe',
  category: 'payment',
  manifestJson: '{"supportedCurrencies":["USD","EUR"]}',
};

const ENABLED_INSTANCE = {
  enabled: true,
  deletedAt: null,
  configJson: '{"mode":"test"}',
};

/** Configure the standard "happy-path" mocks for a single Stripe plugin. */
function setupDefaultMocks() {
  (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
  (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  (systemSettingsService.getShopCurrency as ReturnType<typeof vi.fn>).mockResolvedValue('USD');
  (PluginManagementService.getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue([
    STRIPE_PACKAGE,
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
    await app.register(paymentRoutes, { prefix: '/api/payments' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // GET /api/payments/available-methods
  // -----------------------------------------------------------------------

  describe('GET /api/payments/available-methods', () => {
    it('should return payment methods from installed plugins', async () => {
      setupDefaultMocks();

      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/available-methods',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);

      const method = body.data[0];
      expect(method.pluginSlug).toBe('stripe-payment');
      expect(method.displayName).toBe('Stripe');
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
        url: '/api/payments/available-methods',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/payments/create-session
  // -----------------------------------------------------------------------

  describe('POST /api/payments/create-session', () => {
    it('should return 409 when no payment plugins are available', async () => {
      (CacheService.getPluginVersion as ReturnType<typeof vi.fn>).mockResolvedValue('1');
      (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (PluginManagementService.getAllPluginPackages as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        payload: {
          paymentMethod: 'stripe-payment',
          orderId: 'order-1',
        },
      });

      expect(response.statusCode).toBe(409);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('PAYMENT_PLUGIN_REQUIRED');
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
        url: '/api/payments/create-session',
        payload: {
          paymentMethod: 'stripe-payment',
          orderId: 'order-1',
        },
      });

      expect(authMiddleware).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/payments/verify/:sessionId
  // -----------------------------------------------------------------------

  describe('GET /api/payments/verify/:sessionId', () => {
    it('should return payment status for a known session', async () => {
      const mockPayment = {
        id: 'pay-1',
        orderId: 'order-1',
        sessionId: 'sess-abc',
        status: 'SUCCEEDED',
        paymentMethod: 'stripe-payment',
        updatedAt: new Date('2025-06-01T12:00:00Z'),
        paymentIntentId: 'pi_123',
      };

      // syncPaymentFromPlugin will call findFirst first -- return the already
      // succeeded payment so it short-circuits.  Then the route handler calls
      // findFirst again for its own lookup.
      (prisma.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockPayment);

      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/verify/sess-abc',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.sessionId).toBe('sess-abc');
      expect(body.data.orderId).toBe('order-1');
      expect(body.data.status).toBe('paid');
      expect(body.data.paymentMethod).toBe('stripe-payment');
    });

    it('should return pending status when session is not found', async () => {
      (prisma.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/verify/sess-unknown',
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
