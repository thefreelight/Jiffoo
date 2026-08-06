import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createCheckout = vi.hoisted(() => vi.fn());
let serviceSubject = 'plugin:subscription';

vi.mock('@/core/auth/service-auth', () => ({
  requireServiceAuthMiddleware: vi.fn(async (request: any) => {
    request.user = { id: serviceSubject };
  }),
}));
vi.mock('@/core/order/plugin-orders', () => ({ createPluginOrderCheckout: createCheckout }));

import { pluginOrderRoutes } from '@/core/order/plugin-orders-routes';

const validPayload = {
  userId: 'user-1',
  sourcePlugin: 'subscription',
  entitlementType: 'subscription',
  externalReferenceId: 'checkout-1',
  name: 'Plus subscription',
  amount: 6.99,
  currency: 'usd',
  paymentMethod: 'yipay',
  metadata: { planId: 'plus-monthly' },
};

describe('plugin order routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceSubject = 'plugin:subscription';
    createCheckout.mockResolvedValue({
      orderId: 'order-1',
      session: { sessionId: 'session-1', url: 'https://pay.example/session-1' },
    });
  });

  it('creates checkout for the authenticated source plugin', async () => {
    const app = Fastify();
    await app.register(pluginOrderRoutes);
    const response = await app.inject({ method: 'POST', url: '/checkout', payload: validPayload });
    expect(response.statusCode).toBe(200);
    expect(createCheckout).toHaveBeenCalledWith(validPayload);
    expect(response.json().data.orderId).toBe('order-1');
    await app.close();
  });

  it('rejects a token issued for another plugin', async () => {
    serviceSubject = 'plugin:reviews';
    const app = Fastify();
    await app.register(pluginOrderRoutes);
    const response = await app.inject({ method: 'POST', url: '/checkout', payload: validPayload });
    expect(response.statusCode).toBe(403);
    expect(createCheckout).not.toHaveBeenCalled();
    await app.close();
  });
});
