import http from 'http';
import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPaymentService = vi.hoisted(() => ({
  getDashboardStats: vi.fn(),
  listPayments: vi.fn(),
  getPayment: vi.fn(),
}));

const mockRefundService = vi.hoisted(() => ({
  listRefunds: vi.fn(),
  createRefund: vi.fn(),
}));

vi.mock('../../src/services/payment.service', () => ({
  paymentService: mockPaymentService,
}));

vi.mock('../../src/services/refund.service', () => ({
  refundService: mockRefundService,
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('../../src/lib/stripe-client', () => ({
  getStripeClient: vi.fn(() => ({})),
}));

import { adminApiRoutes } from '../../src/routes/admin-api';
import { createContextMiddleware } from '../../src/lib/platform-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type JsonResponse = { status: number; json: any };

function adminHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-platform-id': 'plat_1',
    'x-plugin-slug': 'stripe',
    'x-installation-id': 'ins_test',
    'x-caller': 'admin',
    ...overrides,
  };
}

function nonAdminHeaders(): Record<string, string> {
  return adminHeaders({ 'x-caller': 'shop' });
}

const ENV_KEYS = [
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NODE_ENV',
];

let savedEnv: Record<string, string | undefined>;

function saveEnv() {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
}

function setAllKeys() {
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_51Abc123XyzLong';
  process.env.STRIPE_SECRET_KEY = 'sk_test_secret_key_value';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
  process.env.NODE_ENV = 'development';
}

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(createContextMiddleware());
  app.use('/admin/api', adminApiRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

async function requestJson(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<JsonResponse> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const json = await res.json();
  return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin-api routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveEnv();
    setAllKeys();
  });

  afterEach(() => {
    restoreEnv();
  });

  // ==========================================================================
  // GET /admin/api/status (original tests preserved)
  // ==========================================================================

  describe('GET /admin/api/status', () => {
    it('returns success=true with stripe status data', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/status', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data).toBeDefined();
        expect(res.json.data.plugin).toBe('stripe');
        expect(res.json.data.version).toBe('1.0.0');
      });
    });

    it('returns configured=true when all keys are present', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/status', {
          headers: adminHeaders(),
        });

        expect(res.json.data.configured).toBe(true);
        expect(res.json.data.storefrontReady).toBe(true);
        expect(res.json.data.apiReady).toBe(true);
        expect(res.json.data.webhookReady).toBe(true);
      });
    });

    it('returns endpoint paths', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/status', {
          headers: adminHeaders(),
        });

        expect(res.json.data.endpoints).toBeDefined();
        expect(res.json.data.endpoints.createIntent).toBe('/api/extensions/plugin/stripe/api/create-intent');
        expect(res.json.data.endpoints.webhook).toBe('/api/extensions/plugin/stripe/api/webhook/stripe');
      });
    });

    it('reports configured=true from plugin config when env keys are missing', async () => {
      delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
      process.env.NODE_ENV = 'production';

      const pluginConfig = Buffer.from(JSON.stringify({
        publishableKey: 'pk_live_from_config',
        secretKey: 'sk_live_from_config',
        webhookSecret: 'whsec_from_config',
      })).toString('base64url');

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/status', {
          headers: adminHeaders({ 'x-plugin-config': pluginConfig }),
        });

        expect(res.status).toBe(200);
        expect(res.json.data.configured).toBe(true);
        expect(res.json.data.apiReady).toBe(true);
        expect(res.json.data.webhookReady).toBe(true);
      });
    });

    it('returns warnings array', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/status', {
          headers: adminHeaders(),
        });

        expect(Array.isArray(res.json.data.warnings)).toBe(true);
      });
    });

    it('returns 403 for non-admin caller', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/status', {
          headers: nonAdminHeaders(),
        });

        expect(res.status).toBe(403);
        expect(res.json.error.code).toBe('FORBIDDEN');
      });
    });
  });

  // ==========================================================================
  // GET /admin/api/dashboard
  // ==========================================================================

  describe('GET /admin/api/dashboard', () => {
    it('returns dashboard stats', async () => {
      mockPaymentService.getDashboardStats.mockResolvedValue({
        totalPayments: 100,
        succeeded: 80,
        failed: 10,
        refunded: 5,
        successRate: 80.0,
        totalRevenue: 400000,
        totalRefunded: 25000,
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/dashboard', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.totalPayments).toBe(100);
        expect(res.json.data.succeeded).toBe(80);
        expect(res.json.data.totalRevenue).toBe(400000);
        expect(mockPaymentService.getDashboardStats).toHaveBeenCalledWith('ins_test');
      });
    });

    it('returns 403 for non-admin caller', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/dashboard', {
          headers: nonAdminHeaders(),
        });

        expect(res.status).toBe(403);
        expect(res.json.error.code).toBe('FORBIDDEN');
      });
    });

    it('returns 500 when service throws', async () => {
      mockPaymentService.getDashboardStats.mockRejectedValue(new Error('DB error'));

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/dashboard', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(500);
        expect(res.json.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  // ==========================================================================
  // GET /admin/api/payments
  // ==========================================================================

  describe('GET /admin/api/payments', () => {
    it('returns paginated payments', async () => {
      mockPaymentService.listPayments.mockResolvedValue({
        items: [{ id: 'pay_1', amount: 5000 }],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/payments', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.items).toHaveLength(1);
        expect(res.json.data.total).toBe(1);
      });
    });

    it('passes query parameters to service', async () => {
      mockPaymentService.listPayments.mockResolvedValue({
        items: [],
        page: 2,
        limit: 5,
        total: 0,
        totalPages: 0,
      });

      await withServer(async (baseUrl) => {
        await requestJson(
          baseUrl,
          '/admin/api/payments?page=2&limit=5&status=failed',
          { headers: adminHeaders() },
        );

        expect(mockPaymentService.listPayments).toHaveBeenCalledWith(
          'ins_test',
          { page: 2, limit: 5, status: 'failed' },
        );
      });
    });

    it('returns 403 for non-admin caller', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/payments', {
          headers: nonAdminHeaders(),
        });

        expect(res.status).toBe(403);
      });
    });
  });

  // ==========================================================================
  // GET /admin/api/payments/:id
  // ==========================================================================

  describe('GET /admin/api/payments/:id', () => {
    it('returns a single payment', async () => {
      mockPaymentService.getPayment.mockResolvedValue({
        id: 'pay_1',
        orderId: 'order_1',
        amount: 5000,
        status: 'succeeded',
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/payments/pay_1', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.id).toBe('pay_1');
      });
    });

    it('returns 404 when payment not found', async () => {
      mockPaymentService.getPayment.mockResolvedValue(null);

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/payments/pay_missing', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(404);
        expect(res.json.error.code).toBe('NOT_FOUND');
      });
    });

    it('returns 403 for non-admin caller', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/payments/pay_1', {
          headers: nonAdminHeaders(),
        });

        expect(res.status).toBe(403);
      });
    });
  });

  // ==========================================================================
  // GET /admin/api/refunds
  // ==========================================================================

  describe('GET /admin/api/refunds', () => {
    it('returns paginated refunds', async () => {
      mockRefundService.listRefunds.mockResolvedValue({
        items: [{ id: 'ref_1', amount: 5000 }],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/refunds', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.items).toHaveLength(1);
      });
    });

    it('passes paymentRecordId filter', async () => {
      mockRefundService.listRefunds.mockResolvedValue({
        items: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });

      await withServer(async (baseUrl) => {
        await requestJson(
          baseUrl,
          '/admin/api/refunds?paymentRecordId=pay_1',
          { headers: adminHeaders() },
        );

        expect(mockRefundService.listRefunds).toHaveBeenCalledWith(
          'ins_test',
          expect.objectContaining({ paymentRecordId: 'pay_1' }),
        );
      });
    });

    it('returns 403 for non-admin caller', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/refunds', {
          headers: nonAdminHeaders(),
        });

        expect(res.status).toBe(403);
      });
    });
  });

  // ==========================================================================
  // POST /admin/api/refund
  // ==========================================================================

  describe('POST /admin/api/refund', () => {
    it('creates a refund successfully', async () => {
      mockRefundService.createRefund.mockResolvedValue({
        refundId: 'ref_1',
        stripeRefundId: 're_abc',
        amount: 5000,
        status: 'succeeded',
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/refund', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ paymentRecordId: 'pay_1', amount: 5000 }),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.refundId).toBe('ref_1');
      });
    });

    it('returns 400 when paymentRecordId is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/refund', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({}),
        });

        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
        expect(res.json.error.message).toContain('paymentRecordId');
      });
    });

    it('returns 404 when payment not found', async () => {
      mockRefundService.createRefund.mockRejectedValue(
        new Error('Payment record not found'),
      );

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/refund', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ paymentRecordId: 'pay_missing' }),
        });

        expect(res.status).toBe(404);
        expect(res.json.error.code).toBe('REFUND_ERROR');
      });
    });

    it('returns 400 when refund service rejects with "Cannot refund"', async () => {
      mockRefundService.createRefund.mockRejectedValue(
        new Error('Cannot refund payment with status: pending'),
      );

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/refund', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ paymentRecordId: 'pay_1' }),
        });

        expect(res.status).toBe(400);
      });
    });

    it('returns 403 for non-admin caller', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/admin/api/refund', {
          method: 'POST',
          headers: nonAdminHeaders(),
          body: JSON.stringify({ paymentRecordId: 'pay_1' }),
        });

        expect(res.status).toBe(403);
      });
    });
  });
});
