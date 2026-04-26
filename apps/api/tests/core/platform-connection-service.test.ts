import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  getString: vi.fn(),
  startPlatformConnection: vi.fn(),
  pollPlatformConnection: vi.fn(),
  completePlatformConnection: vi.fn(),
  bindPlatformTenant: vi.fn(),
  storeFindFirst: vi.fn(),
}));

vi.mock('@/core/admin/system-settings/service', () => ({
  systemSettingsService: {
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
    getString: mocks.getString,
  },
}));

vi.mock('@/core/admin/market/market-client', () => ({
  MarketClient: {
    startPlatformConnection: mocks.startPlatformConnection,
    pollPlatformConnection: mocks.pollPlatformConnection,
    completePlatformConnection: mocks.completePlatformConnection,
    bindPlatformTenant: mocks.bindPlatformTenant,
  },
}));

vi.mock('@/config/database', () => ({
  prisma: {
    store: {
      findFirst: mocks.storeFindFirst,
    },
  },
}));

import { PlatformConnectionService } from '@/core/admin/platform-connection/service';

describe('PlatformConnectionService verify URL normalization', () => {
  let storedState: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MARKET_API_URL', 'https://platform-api.jiffoo.com/api');
    storedState = {};

    mocks.getSetting.mockImplementation(async () => storedState);
    mocks.setSetting.mockImplementation(async (_key: string, value: Record<string, unknown>) => {
      storedState = value;
    });
    mocks.getString.mockResolvedValue('NavtoAI Store');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns and persists a public verify URL when starting platform connection', async () => {
    mocks.startPlatformConnection.mockResolvedValue({
      pending: {
        deviceCode: 'device-1',
        userCode: 'QJQ6-BEC7',
        verifyUrl: 'http://platform-api.jiffoo-mall-prod.svc.cluster.local/marketplace/connect?deviceCode=device-1',
        expiresAt: '2026-04-26T08:00:00.000Z',
        intervalSeconds: 5,
        startedAt: '2026-04-26T07:55:00.000Z',
      },
    });

    const service = new PlatformConnectionService();
    const status = await service.start({
      instanceName: 'NavtoAI Store',
      originUrl: 'https://admin.navtoai.com',
      coreVersion: '1.0.37',
    });

    expect(status.pending?.verifyUrl).toBe(
      'https://platform-api.jiffoo.com/marketplace/connect?deviceCode=device-1',
    );
    expect((storedState.pending as { verifyUrl?: string } | undefined)?.verifyUrl).toBe(
      'https://platform-api.jiffoo.com/marketplace/connect?deviceCode=device-1',
    );
  });

  it('normalizes verify URLs returned by poll responses', async () => {
    storedState = {
      instanceKey: 'instance-1',
      pending: {
        deviceCode: 'device-1',
        userCode: 'QJQ6-BEC7',
        verifyUrl: 'http://platform-api.jiffoo-mall-prod.svc.cluster.local/marketplace/connect?deviceCode=device-1',
        expiresAt: '2026-04-26T08:00:00.000Z',
        intervalSeconds: 5,
        startedAt: '2026-04-26T07:55:00.000Z',
      },
    };

    mocks.pollPlatformConnection.mockResolvedValue({
      authorized: false,
      status: {
        pending: {
          deviceCode: 'device-1',
          userCode: 'QJQ6-BEC7',
          verifyUrl: 'http://platform-api.jiffoo-mall-prod.svc.cluster.local/marketplace/connect?deviceCode=device-1',
          expiresAt: '2026-04-26T08:00:00.000Z',
          intervalSeconds: 5,
          startedAt: '2026-04-26T07:55:00.000Z',
        },
        instance: null,
        tenantBinding: null,
      },
      instanceToken: null,
    });

    const service = new PlatformConnectionService();
    const status = await service.poll({ deviceCode: 'device-1' });

    expect(status.pending?.verifyUrl).toBe(
      'https://platform-api.jiffoo.com/marketplace/connect?deviceCode=device-1',
    );
    expect((storedState.pending as { verifyUrl?: string } | undefined)?.verifyUrl).toBe(
      'https://platform-api.jiffoo.com/marketplace/connect?deviceCode=device-1',
    );
  });
});
