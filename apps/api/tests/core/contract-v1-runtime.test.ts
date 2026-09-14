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
  clearContractJobs,
  contractJobIntervalMs,
  dispatchContractV1Event,
  isContractV1Runtime,
  registerContractV1Runtime,
  type ContractV1Runtime,
} from '@/core/admin/extension-installer/contract-v1-runtime';

describe('contract v1 plugin runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps contract cron schedules to polling intervals', () => {
    expect(contractJobIntervalMs('0 * * * *')).toBe(3_600_000);
    expect(contractJobIntervalMs('*/15 * * * *')).toBe(900_000);
    expect(contractJobIntervalMs('0 */6 * * *')).toBe(21_600_000);
    expect(contractJobIntervalMs('30 2 * * *')).toBe(86_400_000);
    // Malformed or unhandled expressions fall back to hourly, never a hot loop.
    expect(contractJobIntervalMs('nonsense')).toBe(3_600_000);
    expect(contractJobIntervalMs('* * * *')).toBe(3_600_000);
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

  it('normalizes captured Buffer webhook bodies before invoking the driver', async () => {
    const handleWebhook = vi.fn(async () => ({
      received: true,
      handled: true,
      sessionId: null,
      providerEventId: 'evt-buffer',
      normalizedStatus: 'succeeded',
    }));
    const runtime: ContractV1Runtime = {
      manifest: { id: 'stripe', version: '1.0.4', contract: 'v1' },
      register(context) {
        const registerDriver = context.registerDriver as (kind: string, driver: unknown) => void;
        registerDriver('payment', { handleWebhook });
      },
    };
    const app = Fastify({ logger: false });
    await registerContractV1Runtime(app, runtime, {
      slug: 'stripe',
      installationId: 'install-buffer-webhook',
      config: {},
    });
    await app.ready();

    const rawBody = Buffer.from('{"id":"evt-buffer","type":"checkout.session.completed"}', 'utf8');
    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/webhook',
      headers: {
        'content-type': 'application/json',
        'x-jiffoo-stripe-signature': 't=1,v1=test',
      },
      payload: rawBody,
    });

    expect(response.statusCode).toBe(200);
    expect(handleWebhook).toHaveBeenCalledWith(expect.objectContaining({
      payload: {
        rawBody: rawBody.toString('utf8'),
        signature: 't=1,v1=test',
      },
    }));
    await app.close();
  });

  it('schedules contract jobs on the mapped interval and clears them per installation', async () => {
    vi.useFakeTimers();
    try {
      const renew = vi.fn(async () => []);
      const runtime: ContractV1Runtime = {
        manifest: { id: 'subscription', version: '0.1.10', contract: 'v1' },
        register(context) {
          const registerJob = context.registerJob as (job: { id: string; schedule: string; handler: () => unknown }) => void;
          registerJob({ id: 'subscription.renew-due', schedule: '0 * * * *', handler: renew });
        },
      };
      const app = Fastify({ logger: false });
      await registerContractV1Runtime(app, runtime, {
        slug: 'subscription',
        installationId: 'install-jobs',
        config: {},
      });

      await vi.advanceTimersByTimeAsync(3_600_000);
      expect(renew).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(3_600_000);
      expect(renew).toHaveBeenCalledTimes(2);

      clearContractJobs('install-jobs');
      await vi.advanceTimersByTimeAsync(7_200_000);
      expect(renew).toHaveBeenCalledTimes(2);
      await app.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('swallows scheduled job handler failures so the API keeps ticking', async () => {
    vi.useFakeTimers();
    try {
      const failing = vi.fn(async () => { throw new Error('db down'); });
      const runtime: ContractV1Runtime = {
        manifest: { id: 'subscription', version: '0.1.10', contract: 'v1' },
        register(context) {
          const registerJob = context.registerJob as (job: { id: string; schedule: string; handler: () => unknown }) => void;
          registerJob({ id: 'subscription.renew-due', schedule: '*/1 * * * *', handler: failing });
        },
      };
      const app = Fastify({ logger: false });
      await registerContractV1Runtime(app, runtime, {
        slug: 'subscription',
        installationId: 'install-jobs-fail',
        config: {},
      });

      await vi.advanceTimersByTimeAsync(60_000);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(failing).toHaveBeenCalledTimes(2);
      clearContractJobs('install-jobs-fail');
      await app.close();
    } finally {
      vi.useRealTimers();
    }
  });
});
