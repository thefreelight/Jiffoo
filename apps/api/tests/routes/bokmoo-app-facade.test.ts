import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  authMiddlewareMock,
  gatewayMock,
  nativeConfirmMock,
  MockPluginGatewayError,
  MockNativePaymentConfirmationError,
} = vi.hoisted(() => {
  class MockPluginGatewayError extends Error {
    statusCode: number;
    code: string;

    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  }

  class MockNativePaymentConfirmationError extends Error {
    statusCode: number;
    code: string;
    details?: Record<string, unknown>;

    constructor(
      statusCode: number,
      code: string,
      message: string,
      details?: Record<string, unknown>,
    ) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.details = details;
    }
  }

  return {
    authMiddlewareMock: vi.fn(async (request: any) => {
      request.user = {
        id: 'user_facade',
        email: 'facade@bokmoo.com',
        role: 'USER',
        scopes: ['support:read', 'support:ticket_update', 'support:card_action'],
      };
    }),
    gatewayMock: vi.fn(async (request: any, reply: any, forwardPath: string) => reply.send({
      data: {
        forwardPath,
        slug: request.params?.slug,
        userId: request.user?.id ?? null,
        method: request.method,
      },
    })),
    nativeConfirmMock: vi.fn(),
    MockPluginGatewayError,
    MockNativePaymentConfirmationError,
  };
});

vi.mock('@/core/auth/middleware', () => ({
  authMiddleware: authMiddlewareMock,
}));

vi.mock('@/core/admin/extension-installer/plugin-runtime', () => ({
  handlePluginGateway: gatewayMock,
  PluginGatewayError: MockPluginGatewayError,
}));

vi.mock('@/core/payment/native-confirmation', () => ({
  NativePaymentConfirmationError: MockNativePaymentConfirmationError,
  NativePaymentConfirmationService: {
    confirm: nativeConfirmMock,
  },
}));

import { bokmooAppRoutes } from '@/core/bokmoo-app/routes';

async function createFacadeApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(bokmooAppRoutes, { prefix: '/api' });
  await app.ready();
  return app;
}

describe('BOKMOO App API facade routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['GET', '/api/cards?page=1&limit=10', '/api/cards'],
    ['GET', '/api/cards/card_123', '/api/cards/card_123'],
    ['POST', '/api/cards/claim', '/api/cards/claim'],
    ['POST', '/api/cards/card_123/verify', '/api/cards/card_123/verify'],
    ['POST', '/api/cards/card_123/unbind', '/api/cards/card_123/unbind'],
    ['GET', '/api/orders/ord_123/install-session', '/api/orders/ord_123/install-session'],
    ['POST', '/api/orders/ord_123/install-complete', '/api/orders/ord_123/install-complete'],
    ['GET', '/api/profiles', '/api/profiles'],
    ['POST', '/api/profiles/prof_123/switch', '/api/profiles/prof_123/switch'],
    ['DELETE', '/api/profiles/prof_123', '/api/profiles/prof_123'],
    ['GET', '/api/payment-methods', '/api/payment-methods'],
    ['POST', '/api/payment-methods', '/api/payment-methods'],
    ['POST', '/api/payment-methods/pm_123/default', '/api/payment-methods/pm_123/default'],
    ['DELETE', '/api/payment-methods/pm_123', '/api/payment-methods/pm_123'],
    ['GET', '/api/notifications', '/api/notifications'],
    ['POST', '/api/notifications/noti_123/read', '/api/notifications/noti_123/read'],
    ['POST', '/api/support/tickets', '/api/support/tickets'],
    ['GET', '/api/support/tickets', '/admin/api/support/tickets'],
    ['POST', '/api/support/tickets/ticket_123/status', '/admin/api/support/tickets/ticket_123/status'],
    ['GET', '/api/support/cards/search?q=MID123', '/admin/api/support/cards/search'],
    ['POST', '/api/support/cards/card_123/actions', '/admin/api/support/cards/card_123/actions'],
  ])('forwards %s %s to bokmoo-connect %s', async (method, url, forwardPath) => {
    const app = await createFacadeApp();
    try {
      const response = await app.inject({
        method,
        url,
        payload: method === 'POST' ? { ok: true } : undefined,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        forwardPath,
        slug: 'bokmoo-connect',
        userId: 'user_facade',
      });
      const gatewayCall = gatewayMock.mock.calls.at(-1);
      expect(gatewayCall?.[0].raw.method).toBe(method);
      expect(gatewayCall?.[2]).toBe(forwardPath);
      expect(typeof gatewayCall?.[3]?.ready).toBe('function');
    } finally {
      await app.close();
    }
  });

  it('forwards the Jiffoo order-paid webhook without requiring app auth', async () => {
    const app = await createFacadeApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/webhooks/jiffoo/order-paid',
        payload: { orderId: 'ord_123', userId: 'user_123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        forwardPath: '/webhooks/jiffoo/order-paid',
        slug: 'bokmoo-connect',
        userId: null,
      });
      expect(authMiddlewareMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('handles native Apple Pay and Google Pay confirmation in core', async () => {
    nativeConfirmMock.mockResolvedValue({
      orderId: 'ord_123',
      status: 'paid',
      provider: 'apple-pay',
    });

    const app = await createFacadeApp();
    try {
      const appleResponse = await app.inject({
        method: 'POST',
        url: '/api/payments/apple-pay/confirm',
        payload: {
          orderId: 'ord_123',
          stripePaymentMethodId: 'pm_card_visa',
          expectedTotal: 5.9,
          currency: 'USD',
        },
      });

      expect(appleResponse.statusCode).toBe(200);
      expect(appleResponse.json().data).toMatchObject({
        orderId: 'ord_123',
        status: 'paid',
      });
      expect(nativeConfirmMock).toHaveBeenCalledWith('apple-pay', 'user_facade', {
        orderId: 'ord_123',
        stripePaymentMethodId: 'pm_card_visa',
        expectedTotal: 5.9,
        currency: 'USD',
      });

      nativeConfirmMock.mockResolvedValueOnce({
        orderId: 'ord_456',
        status: 'paid',
        provider: 'google-pay',
      });

      const googleResponse = await app.inject({
        method: 'POST',
        url: '/api/payments/google-pay/confirm',
        payload: {
          orderId: 'ord_456',
          providerPaymentIntentId: 'pi_123',
          expectedTotal: 9.9,
          currency: 'USD',
        },
      });

      expect(googleResponse.statusCode).toBe(200);
      expect(nativeConfirmMock).toHaveBeenCalledWith('google-pay', 'user_facade', {
        orderId: 'ord_456',
        providerPaymentIntentId: 'pi_123',
        expectedTotal: 9.9,
        currency: 'USD',
      });
      expect(gatewayMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('maps plugin gateway errors to the BOKMOO app error envelope', async () => {
    gatewayMock.mockRejectedValueOnce(
      new MockPluginGatewayError(404, 'BOKMOO_PLUGIN_NOT_INSTALLED', 'BOKMOO plugin is not installed'),
    );

    const app = await createFacadeApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cards',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: {
          code: 'BOKMOO_PLUGIN_NOT_INSTALLED',
          message: 'BOKMOO plugin is not installed',
        },
      });
    } finally {
      await app.close();
    }
  });
});
