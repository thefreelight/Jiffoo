import http from 'http';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSessionService = vi.hoisted(() => ({
  createSession: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock('../../src/services/session.service', () => ({
  sessionService: mockSessionService,
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('../../src/lib/stripe-client', () => ({
  getStripeClient: vi.fn(() => ({})),
}));

import { sessionApiRoutes } from '../../src/routes/session-api';
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

function configHeader(config: Record<string, any>): string {
  return Buffer.from(JSON.stringify(config)).toString('base64url');
}

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(createContextMiddleware());
  app.use('/payments', sessionApiRoutes);

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

describe('session-api routes', () => {
  beforeEach(() => vi.clearAllMocks());

  // ==========================================================================
  // POST /payments/create-session
  // ==========================================================================

  describe('POST /payments/create-session', () => {
    it('creates a session successfully', async () => {
      mockSessionService.createSession.mockResolvedValue({
        sessionId: 'cs_new',
        url: 'https://checkout.stripe.com/new',
        expiresAt: '2026-03-27T12:00:00.000Z',
        paymentIntentId: 'pi_new',
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/payments/create-session', {
          method: 'POST',
          headers: defaultHeaders({
            'x-plugin-config': configHeader({ secretKey: 'sk_test' }),
          }),
          body: JSON.stringify({
            orderId: 'order_1',
            amount: 5000,
            currency: 'usd',
            customerEmail: 'buyer@test.com',
          }),
        });

        expect(res.status).toBe(201);
        expect(res.json.success).toBe(true);
        expect(res.json.data.sessionId).toBe('cs_new');
        expect(res.json.data.url).toBe('https://checkout.stripe.com/new');
        expect(mockSessionService.createSession).toHaveBeenCalledWith(
          'ins_test',
          expect.objectContaining({
            orderId: 'order_1',
            amount: 5000,
            currency: 'usd',
            customerEmail: 'buyer@test.com',
          }),
          'sk_test',
        );
      });
    });

    it('returns 400 when orderId is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/payments/create-session', {
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
        const res = await requestJson(baseUrl, '/payments/create-session', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({ orderId: 'order_1' }),
        });

        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
        expect(res.json.error.message).toContain('amount');
      });
    });

    it('returns 400 when amount is negative', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/payments/create-session', {
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
        const res = await requestJson(baseUrl, '/payments/create-session', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({ orderId: 'order_1', amount: 'abc' }),
        });

        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
      });
    });

    it('returns 500 when service throws', async () => {
      mockSessionService.createSession.mockRejectedValue(
        new Error('Stripe API error'),
      );

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/payments/create-session', {
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
  // POST /payments/verify-session
  // ==========================================================================

  describe('POST /payments/verify-session', () => {
    it('verifies a session successfully', async () => {
      mockSessionService.verifySession.mockResolvedValue({
        status: 'paid',
        paymentIntentId: 'pi_verified',
        eventId: 'session:cs_1:paid',
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/payments/verify-session', {
          method: 'POST',
          headers: defaultHeaders({
            'x-plugin-config': configHeader({ secretKey: 'sk_test' }),
          }),
          body: JSON.stringify({ sessionId: 'cs_1' }),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.status).toBe('paid');
        expect(res.json.data.paymentIntentId).toBe('pi_verified');
        expect(mockSessionService.verifySession).toHaveBeenCalledWith(
          'cs_1',
          'sk_test',
        );
      });
    });

    it('returns 400 when sessionId is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/payments/verify-session', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({}),
        });

        expect(res.status).toBe(400);
        expect(res.json.success).toBe(false);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
        expect(res.json.error.message).toContain('sessionId');
      });
    });

    it('returns 500 when service throws', async () => {
      mockSessionService.verifySession.mockRejectedValue(
        new Error('Session not found'),
      );

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/payments/verify-session', {
          method: 'POST',
          headers: defaultHeaders(),
          body: JSON.stringify({ sessionId: 'cs_invalid' }),
        });

        expect(res.status).toBe(500);
        expect(res.json.error.code).toBe('VERIFICATION_ERROR');
        expect(res.json.error.message).toBe('Session not found');
      });
    });
  });
});
