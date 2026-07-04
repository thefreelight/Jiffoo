import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, pluginManagementServiceMock } = vi.hoisted(() => ({
  prismaMock: {
    webhookDeliveryLog: {
      create: vi.fn(),
    },
    webhookDeadLetter: {
      create: vi.fn(),
    },
  },
  pluginManagementServiceMock: {
    getInstanceById: vi.fn(),
    getPluginPackage: vi.fn(),
  },
}));

vi.mock('@/config/database', () => ({
  prisma: prismaMock,
}));

vi.mock('@/core/admin/plugin-management/service', () => ({
  PluginManagementService: pluginManagementServiceMock,
}));

import { deliverInternalWebhook } from '@/core/webhooks/delivery-worker';

describe('internal webhook delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_SERVICE_URL = 'https://api.bokmoo.com';
    process.env.CATALOG_IMPORT_TOKEN = 'platform-token';
    delete process.env.BOKMOO_JIFFOO_WEBHOOK_SECRET;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{"data":{"received":true}}'),
    }));
  });

  it('signs plugin webhook delivery with the plugin webhook secret', async () => {
    pluginManagementServiceMock.getInstanceById.mockResolvedValue({
      id: 'ins_1',
      pluginSlug: 'bokmoo-connect',
      enabled: true,
      configJson: JSON.stringify({
        jiffooWebhookSecret: 'secret_123',
      }),
    });
    pluginManagementServiceMock.getPluginPackage.mockResolvedValue({
      manifestJson: JSON.stringify({
        webhooks: {
          url: '/webhooks/jiffoo/order-paid',
          events: ['order.paid'],
        },
      }),
    });
    prismaMock.webhookDeliveryLog.create.mockResolvedValue({});

    await deliverInternalWebhook({
      subscriptionId: 'sub_1',
      eventId: 'evt_1',
      eventType: 'order.paid',
      aggregateId: 'ord_1',
      installationId: 'ins_1',
      payload: {
        orderId: 'ord_1',
        userId: 'user_1',
      },
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.bokmoo.com/api/extensions/plugin/bokmoo-connect/api/webhooks/jiffoo/order-paid?installationId=ins_1');

    const headers = init.headers as Record<string, string>;
    expect(headers['X-Platform-Integration-Token']).toBe('platform-token');
    expect(headers['X-Jiffoo-Timestamp']).toEqual(expect.any(String));
    expect(headers['X-Jiffoo-Signature']).toMatch(/^sha256=/);

    const expected = createHmac('sha256', 'secret_123')
      .update(`${headers['X-Jiffoo-Timestamp']}.${init.body as string}`)
      .digest('hex');
    expect(headers['X-Jiffoo-Signature']).toBe(`sha256=${expected}`);
    expect(JSON.parse(init.body as string)).toMatchObject({
      id: 'evt_1',
      type: 'order.paid',
      aggregateId: 'ord_1',
      data: {
        orderId: 'ord_1',
        userId: 'user_1',
      },
    });
  });
});
