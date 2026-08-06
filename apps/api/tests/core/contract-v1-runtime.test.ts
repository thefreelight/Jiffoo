import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  pluginInstallation: {
    update: vi.fn(),
  },
  $executeRawUnsafe: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn(),
}));
const applyPluginWebhook = vi.hoisted(() => vi.fn());

vi.mock('@/config/database', () => ({ prisma: prismaMock }));
vi.mock('@/core/payment/plugin-webhook', () => ({ applyNormalizedPluginWebhook: applyPluginWebhook }));

import {
  dispatchContractV1Event,
  isContractV1Runtime,
  registerContractV1Runtime,
  type ContractV1Runtime,
} from '@/core/admin/extension-installer/contract-v1-runtime';

describe('contract v1 plugin runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recognizes only contract-v1 runtime exports', () => {
    expect(isContractV1Runtime({
      manifest: { id: 'payment', version: '0.0.1', contract: 'v1' },
      register() {},
    })).toBe(true);
    expect(isContractV1Runtime({ manifest: { contract: 'v1' } })).toBe(false);
    expect(isContractV1Runtime(() => undefined)).toBe(false);
  });

  it('registers payment routes and normalizes dollars to minor units', async () => {
    const createSession = vi.fn(async () => ({
      sessionId: 'session-1',
      url: 'https://pay.example/session-1',
    }));
    let configuredGateway: unknown;
    const runtime: ContractV1Runtime = {
      manifest: { id: 'yipay', version: '0.0.5', contract: 'v1' },
      register(context) {
        const settings = context.settings as { get(key: string): unknown };
        configuredGateway = settings.get('yipay.gatewayUrl');
        const registerDriver = context.registerDriver as (kind: string, driver: unknown) => void;
        registerDriver('payment', { createSession });
      },
    };
    const app = Fastify({ logger: false });

    await registerContractV1Runtime(app, runtime, {
      slug: 'yipay',
      installationId: 'install-1',
      config: { gatewayUrl: 'https://pay.example' },
    });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/create-session',
      payload: {
        orderId: 'order-1',
        amount: 6.99,
        currency: 'USD',
        metadata: { plan: 'plus-monthly' },
      },
    });

    expect(configuredGateway).toBe('https://pay.example');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      data: {
        sessionId: 'session-1',
        url: 'https://pay.example/session-1',
      },
    });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      amountMinor: 699,
      currency: 'USD',
      metadata: { plan: 'plus-monthly' },
    }));

    await app.close();
  });

  it('delivers subscribed events to the owning installation', async () => {
    const handler = vi.fn(async () => undefined);
    const runtime: ContractV1Runtime = {
      manifest: { id: 'subscription', version: '0.1.6', contract: 'v1' },
      register(context) {
        const events = context.events as { subscribe(type: string, callback: (payload: unknown) => unknown): void };
        events.subscribe('order.paid', handler);
      },
    };
    const app = Fastify({ logger: false });
    await registerContractV1Runtime(app, runtime, { slug: 'subscription', installationId: 'install-events', config: {} });
    const delivered = await dispatchContractV1Event('install-events', 'order.paid', { orderId: 'order-1' });
    expect(delivered).toBe(1);
    expect(handler).toHaveBeenCalledWith({ orderId: 'order-1' });
    await app.close();
  });

  it('applies normalized payment webhooks to Core', async () => {
    const webhookResult = {
      received: true,
      handled: true,
      sessionId: 'order-1',
      providerEventId: 'trade-1',
      normalizedStatus: 'succeeded',
    };
    const runtime: ContractV1Runtime = {
      manifest: { id: 'yipay', version: '0.0.5', contract: 'v1' },
      register(context) {
        const registerDriver = context.registerDriver as (kind: string, driver: unknown) => void;
        registerDriver('payment', { handleWebhook: vi.fn(async () => webhookResult) });
      },
    };
    const app = Fastify({ logger: false });
    await registerContractV1Runtime(app, runtime, { slug: 'yipay', installationId: 'install-webhook', config: {} });
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/payments/webhook', payload: { trade_status: 'TRADE_SUCCESS' } });
    expect(response.statusCode).toBe(200);
    expect(applyPluginWebhook).toHaveBeenCalledWith('yipay', webhookResult);
    await app.close();
  });
});
