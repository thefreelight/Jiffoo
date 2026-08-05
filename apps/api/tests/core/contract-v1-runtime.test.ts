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

vi.mock('@/config/database', () => ({ prisma: prismaMock }));

import {
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
});
