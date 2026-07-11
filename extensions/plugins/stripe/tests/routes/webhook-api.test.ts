import http from 'http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockWebhookService = vi.hoisted(() => ({
  verifyAndHandle: vi.fn(),
}));

vi.mock('../../src/services/webhook.service', () => ({
  webhookService: mockWebhookService,
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('../../src/lib/stripe-client', () => ({
  getStripeClient: vi.fn(() => ({})),
}));

import { webhookApiRoutes } from '../../src/routes/webhook-api';
import { createContextMiddleware } from '../../src/lib/platform-context';

type JsonResponse = { status: number; json: any };

const ENV_KEYS = ['STRIPE_WEBHOOK_SECRET'];
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

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  // Webhook route needs raw body for signature verification
  app.use('/', express.raw({ type: 'application/json' }));
  app.use(createContextMiddleware());
  app.use('/', webhookApiRoutes);

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

describe('webhook-api routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveEnv();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
  });

  afterEach(() => {
    restoreEnv();
  });

  // ==========================================================================
  // POST /webhook - success
  // ==========================================================================

  describe('POST / (webhook)', () => {
    it('processes webhook successfully with valid signature', async () => {
      mockWebhookService.verifyAndHandle.mockResolvedValue({
        received: true,
        providerEventId: 'evt_test_1',
        sessionId: 'cs_test_1',
        normalizedStatus: 'succeeded',
        occurredAt: '2026-01-01T00:00:00.000Z',
        handled: true,
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': 'sig_valid',
          },
          body: JSON.stringify({ type: 'payment_intent.succeeded' }),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data.received).toBe(true);
        expect(res.json.data.handled).toBe(true);
        expect(res.json.data.providerEventId).toBe('evt_test_1');
        expect(res.json.data.normalizedStatus).toBe('succeeded');
        expect(mockWebhookService.verifyAndHandle).toHaveBeenCalledWith(
          expect.any(Buffer),
          'sig_valid',
          'whsec_test_123',
          undefined,
        );
      });
    });

    it('processes manifest-declared /stripe path with plugin config before env', async () => {
      mockWebhookService.verifyAndHandle.mockResolvedValue({
        received: true,
        providerEventId: 'evt_test_manifest',
        sessionId: 'cs_test_manifest',
        normalizedStatus: 'succeeded',
        occurredAt: '2026-01-01T00:00:00.000Z',
        handled: true,
      });

      const pluginConfig = Buffer.from(JSON.stringify({
        secretKey: 'sk_test_config_secret',
        webhookSecret: 'whsec_config_secret',
      })).toString('base64url');

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/stripe', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': 'sig_valid',
            'x-plugin-config': pluginConfig,
          },
          body: JSON.stringify({ type: 'payment_intent.succeeded' }),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(mockWebhookService.verifyAndHandle).toHaveBeenCalledWith(
          expect.any(Buffer),
          'sig_valid',
          'whsec_config_secret',
          'sk_test_config_secret',
        );
      });
    });

    it('returns 400 when stripe-signature header is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ type: 'payment_intent.succeeded' }),
        });

        expect(res.status).toBe(400);
        expect(res.json.success).toBe(false);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
        expect(res.json.error.message).toContain('stripe-signature');
      });
    });

    it('acknowledges unsigned platform order lifecycle events on the manifest path', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/stripe', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            id: 'evt_platform_order_created',
            type: 'order.created',
            data: { orderId: 'order_123' },
          }),
        });

        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data).toEqual({
          ignored: true,
          eventType: 'order.created',
          reason: 'platform-lifecycle-event',
        });
        expect(mockWebhookService.verifyAndHandle).not.toHaveBeenCalled();
      });
    });

    it('returns 400 when signature verification fails', async () => {
      const sigError = new Error('Invalid signature');
      (sigError as any).type = 'StripeSignatureVerificationError';
      mockWebhookService.verifyAndHandle.mockRejectedValue(sigError);

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': 'sig_invalid',
          },
          body: JSON.stringify({ type: 'payment_intent.succeeded' }),
        });

        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('INVALID_SIGNATURE');
      });
    });

    it('returns 500 when webhook secret is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': 'sig_valid',
          },
          body: JSON.stringify({ type: 'payment_intent.succeeded' }),
        });

        expect(res.status).toBe(500);
        expect(res.json.error.code).toBe('NOT_CONFIGURED');
        expect(res.json.error.message).toContain('Webhook secret not configured');
      });
    });

    it('returns 500 when service throws a non-signature error', async () => {
      mockWebhookService.verifyAndHandle.mockRejectedValue(
        new Error('DB connection failed'),
      );

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': 'sig_valid',
          },
          body: JSON.stringify({ type: 'payment_intent.succeeded' }),
        });

        expect(res.status).toBe(500);
        expect(res.json.error.code).toBe('WEBHOOK_ERROR');
        expect(res.json.error.message).toBe('DB connection failed');
      });
    });
  });
});
