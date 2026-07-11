import http from 'http';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPaymentService = vi.hoisted(() => ({
  createPaymentIntent: vi.fn(),
  getPayment: vi.fn(),
  getPaymentByOrderId: vi.fn(),
  listPayments: vi.fn(),
}));

const mockRefundService = vi.hoisted(() => ({
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

import { paymentApiRoutes } from '../../src/routes/payment-api';
import { createContextMiddleware } from '../../src/lib/platform-context';

type JsonResponse = { status: number; json: any };

function defaultHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-platform-id': 'plat_1',
    'x-plugin-slug': 'stripe',
    'x-installation-id': 'ins_test',
    'x-caller': 'shop',
    ...overrides,
  };
}

function adminHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return defaultHeaders({ 'x-caller': 'admin', ...overrides });
}

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(createContextMiddleware());
  app.use('/api', paymentApiRoutes);

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

describe('payment-api routes', () => {
  beforeEach(() => vi.clearAllMocks());

  // ==========================================================================
  // POST /api/create-intent
  // ==========================================================================

  describe('POST /api/create-intent', () => {
    it('creates a payment intent successfully', async () => {
      mockPaymentService.createPaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_new',
        clientSecret: 'cs_new',
        status: 'requires_payment_method',
        amount: 5000,
        currency: 'usd',
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/create-intent', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({
            orderId: 'order_1',
            amount: 5000,
            currency: 'usd',
          }),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.paymentIntentId).toBe('pi_new');
        expect(res.json.data.clientSecret).toBe('cs_new');
        expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith(
          'ins_test',
          expect.objectContaining({
            orderId: 'order_1',
            amount: 5000,
            currency: 'usd',
          }),
          undefined,
        );
      });
    });

    it('returns 400 when orderId is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/create-intent', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({ amount: 5000 }),
        });

        expect(res.status).toBe(400);
        expect(res.json.success).toBe(false);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
        expect(res.json.error.message).toContain('orderId');
      });
    });

    it('returns 400 when amount is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/create-intent', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({ orderId: 'order_1' }),
        });

        expect(res.status).toBe(400);
        expect(res.json.success).toBe(false);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
        expect(res.json.error.message).toContain('amount');
      });
    });

    it('returns 400 when amount is not a positive number', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/create-intent', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({ orderId: 'order_1', amount: -100 }),
        });

        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
      });
    });

    it('returns 400 when amount is a string', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/create-intent', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({ orderId: 'order_1', amount: 'not-a-number' }),
        });

        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
      });
    });

    it('returns 500 when service throws an error', async () => {
      mockPaymentService.createPaymentIntent.mockRejectedValue(
        new Error('Stripe API error'),
      );

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/create-intent', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({ orderId: 'order_1', amount: 5000 }),
        });

        expect(res.status).toBe(500);
        expect(res.json.success).toBe(false);
        expect(res.json.error.code).toBe('PAYMENT_ERROR');
        expect(res.json.error.message).toBe('Stripe API error');
      });
    });
  });

  // ==========================================================================
  // POST /api/refund
  // ==========================================================================

  describe('POST /api/refund', () => {
    it('creates a refund successfully (admin)', async () => {
      mockRefundService.createRefund.mockResolvedValue({
        refundId: 'ref_1',
        stripeRefundId: 're_abc',
        amount: 5000,
        status: 'succeeded',
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/refund', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ paymentRecordId: 'pay_1' }),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.refundId).toBe('ref_1');
      });
    });

    it('returns 403 for non-admin caller', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/refund', {
          method: 'POST',
          headers: defaultHeaders({ 'x-caller': 'shop' }),
          body: JSON.stringify({ paymentRecordId: 'pay_1' }),
        });

        expect(res.status).toBe(403);
        expect(res.json.error.code).toBe('FORBIDDEN');
      });
    });

    it('returns 400 when paymentRecordId is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/refund', {
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
        const res = await requestJson(baseUrl, '/api/refund', {
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
        const res = await requestJson(baseUrl, '/api/refund', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ paymentRecordId: 'pay_1' }),
        });

        expect(res.status).toBe(400);
      });
    });
  });

  // ==========================================================================
  // GET /api/methods
  // ==========================================================================

  describe('GET /api/methods', () => {
    it('returns card payment method', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/methods', {
          headers: defaultHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.methods).toHaveLength(1);
        expect(res.json.data.methods[0]).toEqual({
          type: 'card',
          name: 'Credit / Debit Card',
          currencies: ['usd'],
          provider: 'stripe',
        });
      });
    });
  });

  // ==========================================================================
  // GET /api/payments
  // ==========================================================================

  describe('GET /api/payments', () => {
    it('returns paginated payment list (admin only)', async () => {
      mockPaymentService.listPayments.mockResolvedValue({
        items: [{ id: 'pay_1' }],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/payments', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.items).toHaveLength(1);
        expect(mockPaymentService.listPayments).toHaveBeenCalledWith(
          'ins_test',
          expect.objectContaining({ page: 1, limit: 10 }),
        );
      });
    });

    it('returns 403 for non-admin caller', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/payments', {
          headers: defaultHeaders({ 'x-caller': 'shop' }),
        });

        expect(res.status).toBe(403);
        expect(res.json.error.code).toBe('FORBIDDEN');
      });
    });

    it('passes page, limit, and status query params', async () => {
      mockPaymentService.listPayments.mockResolvedValue({
        items: [],
        page: 2,
        limit: 5,
        total: 0,
        totalPages: 0,
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(
          baseUrl,
          '/api/payments?page=2&limit=5&status=succeeded',
          { headers: adminHeaders() },
        );

        expect(res.status).toBe(200);
        expect(mockPaymentService.listPayments).toHaveBeenCalledWith(
          'ins_test',
          { page: 2, limit: 5, status: 'succeeded' },
        );
      });
    });
  });

  // ==========================================================================
  // GET /api/payments/:id
  // ==========================================================================

  describe('GET /api/payments/:id', () => {
    it('returns a single payment (admin only)', async () => {
      mockPaymentService.getPayment.mockResolvedValue({
        id: 'pay_1',
        orderId: 'order_1',
        amount: 5000,
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/payments/pay_1', {
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
        const res = await requestJson(baseUrl, '/api/payments/pay_missing', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(404);
        expect(res.json.error.code).toBe('NOT_FOUND');
      });
    });

    it('returns 403 for non-admin caller', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/payments/pay_1', {
          headers: defaultHeaders({ 'x-caller': 'shop' }),
        });

        expect(res.status).toBe(403);
      });
    });
  });

  // ==========================================================================
  // GET /api/order/:orderId
  // ==========================================================================

  describe('GET /api/order/:orderId', () => {
    it('returns payment by order ID', async () => {
      mockPaymentService.getPaymentByOrderId.mockResolvedValue({
        id: 'pay_1',
        orderId: 'order_1',
        amount: 5000,
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/order/order_1', {
          headers: defaultHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.orderId).toBe('order_1');
      });
    });

    it('returns 404 when no payment found for order', async () => {
      mockPaymentService.getPaymentByOrderId.mockResolvedValue(null);

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/order/order_missing', {
          headers: defaultHeaders(),
        });

        expect(res.status).toBe(404);
        expect(res.json.error.code).toBe('NOT_FOUND');
        expect(res.json.error.message).toContain('No payment found');
      });
    });

    it('returns 500 when service throws', async () => {
      mockPaymentService.getPaymentByOrderId.mockRejectedValue(
        new Error('DB error'),
      );

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/api/order/order_err', {
          headers: defaultHeaders(),
        });

        expect(res.status).toBe(500);
        expect(res.json.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });
});
