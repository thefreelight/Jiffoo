import { describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
const authenticateNativeUser = vi.fn();
const getNativePluginConfig = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin, authenticateNativeUser }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig, getNativeStripeSecret: vi.fn() }));

const { tryNativeShipping, subscribeKuaidi100Tracking } = await import('./shipping');
const { detectCarriers, kuaidi100CodeFor, matchCarrierByName, trackingUrlFor, SHIPPING_CARRIERS } = await import('./shipping-carriers');

function shipFormRequest(): Request {
  return new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/ship-form', { method: 'GET' });
}

function detectRequest(trackingNumber: string): Request {
  return new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/carriers/detect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trackingNumber }),
  });
}

describe('native shipping carrier catalog', () => {
  it('detects carriers from tracking numbers', () => {
    expect(detectCarriers('1Z12345E6205276888')[0]).toMatchObject({ code: 'ups', confidence: 'high' });
    expect(detectCarriers('SF1382947302948')[0]).toMatchObject({ code: 'sf', confidence: 'high' });
    expect(detectCarriers('EE382947503CN')[0]).toMatchObject({ code: 'ems', confidence: 'high' });
    expect(detectCarriers('9400111899223344556677')[0]).toMatchObject({ code: 'usps', confidence: 'high' });
    expect(detectCarriers('ZZZZ99999999')).toEqual([]);
  });

  it('resolves typed carrier text to structured codes', () => {
    expect(matchCarrierByName('顺丰')?.code).toBe('sf');
    expect(matchCarrierByName('fedex')?.code).toBe('fedex');
    expect(matchCarrierByName('FedEx')?.code).toBe('fedex');
    expect(matchCarrierByName('Custom Van Line')).toBeNull();
  });

  it('keeps the catalog self-consistent', () => {
    for (const carrier of SHIPPING_CARRIERS) {
      expect(carrier.patterns?.every((pattern) => pattern.source.startsWith('^') && pattern.source.endsWith('$')) ?? true).toBe(true);
    }
    expect(trackingUrlFor('dhl', '8259483016')).toBe('https://www.dhl.com/track?tracking-id=8259483016');
    expect(trackingUrlFor('zto', '75123456789012')).toBeNull();
  });
});

describe('native shipping ship-form routes', () => {
  it('serves the enabled carrier catalog to the admin ship dialog', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: {} });
    const response = await tryNativeShipping(shipFormRequest(), { DB: {} } as never);
    expect(response?.status).toBe(200);
    const body = await response?.json() as { success: boolean; data: { available: boolean; carriers: Array<{ code: string }>; defaultCarrierCode: string | null } };
    expect(body.success).toBe(true);
    expect(body.data.available).toBe(true);
    expect(body.data.carriers.length).toBeGreaterThan(5);
    expect(body.data.carriers.some((carrier) => carrier.code === 'sf')).toBe(true);
    expect(body.data.defaultCarrierCode).toBe('sf');
  });

  it('auto-detects the carrier for a tracking number', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: {} });
    const response = await tryNativeShipping(detectRequest('1Z12345E6205276888'), { DB: {} } as never);
    expect(response?.status).toBe(200);
    const body = await response?.json() as { success: boolean; data: { candidates: Array<{ code: string; confidence: string }> } };
    expect(body.data.candidates[0]).toMatchObject({ code: 'ups', confidence: 'high' });
  });

  it('requires administrator authentication', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeShipping(shipFormRequest(), { DB: {} } as never);
    expect(response?.status).toBe(401);
  });

  it('reports the plugin-disabled state so the admin falls back to free text', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: false, config: {} });
    const response = await tryNativeShipping(shipFormRequest(), { DB: {} } as never);
    expect(response?.status).toBe(404);
    const body = await response?.json() as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('PLUGIN_DISABLED');
  });

  it('rejects detection without a tracking number', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: {} });
    const response = await tryNativeShipping(detectRequest(''), { DB: {} } as never);
    expect(response?.status).toBe(400);
  });
});

interface FakeDbRow { sql: string; args: unknown[] }

function createFakeDb(options: { firstResults?: Array<{ match: RegExp; value: unknown }> } = {}) {
  const statements: FakeDbRow[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          const entry: FakeDbRow = { sql, args };
          statements.push(entry);
          return {
            async first<T>() {
              const match = options.firstResults?.find((candidate) => candidate.match.test(sql));
              return (match ? match.value : null) as T | null;
            },
            async all<T>() {
              return { results: [] as T[] };
            },
            async run() {
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
    async batch() {
      return [];
    },
  };
  return { db, statements };
}

function kuaidi100EnabledConfig() {
  return {
    enabled: true,
    config: {
      kuaidi100Enabled: true, kuaidi100Key: 'test-key', kuaidi100Secret: 'test-secret',
      kuaidi100Customer: 'test-customer', kuaidi100CallbackUrl: 'https://api.example.com/api/v1/extensions/plugin/shipping/api/admin/webhooks/kuaidi100',
      kuaidi100CallbackSalt: 'test-salt', mode: 'live',
    },
  };
}

describe('kuaidi100 domestic tracking subscription', () => {
  it('maps catalog carriers to kuaidi100 company codes', () => {
    expect(kuaidi100CodeFor('sf')).toBe('shunfeng');
    expect(kuaidi100CodeFor('zto')).toBe('zhongtong');
    expect(kuaidi100CodeFor('yto')).toBe('yuantong');
    expect(kuaidi100CodeFor('sto')).toBe('shengtong');
    expect(kuaidi100CodeFor('ems')).toBe('ems');
    expect(kuaidi100CodeFor('jd')).toBe('jd');
    expect(kuaidi100CodeFor('cainiao')).toBeNull();
  });

  it('subscribes a shipped domestic order and records the provider operation', async () => {
    getNativePluginConfig.mockResolvedValue(kuaidi100EnabledConfig());
    const { db, statements } = createFakeDb();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: true, returnCode: '200', message: 'success', data: {} }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await subscribeKuaidi100Tracking({ DB: db } as never, 'order-1', 'sf', 'sf1382947302948');
      expect(result).toEqual({ subscribed: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(url)).toBe('https://poll.kuaidi100.com/poll');
      const params = new URLSearchParams(String(init.body));
      const param = JSON.parse(params.get('param') ?? '{}') as Record<string, unknown>;
      expect(param.company).toBe('shunfeng');
      expect(param.number).toBe('SF1382947302948');
      const parameters = param.parameters as Record<string, unknown>;
      expect(parameters.callbackurl).toContain('/admin/webhooks/kuaidi100');
      expect(parameters.salt).toBe('test-salt');
      const insert = statements.find((entry) => entry.sql.includes('INSERT INTO native_shipping_provider_orders'));
      expect(insert?.args[1]).toBe('SF1382947302948');
      expect(insert?.args[2]).toBe('order-1');
      expect(insert?.sql).toContain("'COMPLETED'");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('skips the provider call when the tracking number is already subscribed', async () => {
    getNativePluginConfig.mockResolvedValue(kuaidi100EnabledConfig());
    const { db, statements } = createFakeDb({
      firstResults: [{ match: /SELECT state FROM native_shipping_provider_orders/, value: { state: 'COMPLETED' } }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await subscribeKuaidi100Tracking({ DB: db } as never, 'order-1', 'sf', 'SF1382947302948');
      expect(result).toEqual({ subscribed: true, reason: 'ALREADY_SUBSCRIBED' });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(statements.filter((entry) => entry.sql.includes('INSERT INTO'))).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('records the failure reason without throwing when the provider rejects', async () => {
    getNativePluginConfig.mockResolvedValue(kuaidi100EnabledConfig());
    const { db, statements } = createFakeDb();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: false, returnCode: '601', message: 'unknown company' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await subscribeKuaidi100Tracking({ DB: db } as never, 'order-1', 'sf', 'SF1382947302948');
      expect(result.subscribed).toBe(false);
      const insert = statements.find((entry) => entry.sql.includes('INSERT INTO native_shipping_provider_orders'));
      expect(insert?.sql).toContain("'FAILED'");
      expect(insert?.args[5]).toBe('601');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('skips silently when the plugin, provider, or callback is not configured', async () => {
    vi.stubGlobal('fetch', vi.fn());
    try {
      getNativePluginConfig.mockResolvedValue({ enabled: true, config: { kuaidi100Enabled: false } });
      const disabled = await subscribeKuaidi100Tracking({ DB: createFakeDb().db } as never, 'order-1', 'sf', 'SF1382947302948');
      expect(disabled).toEqual({ subscribed: false, reason: 'KUAIDI100_NOT_CONFIGURED' });

      getNativePluginConfig.mockResolvedValue({ enabled: true, config: { kuaidi100Enabled: true, kuaidi100Key: 'k', kuaidi100Secret: 's' } });
      const noCallback = await subscribeKuaidi100Tracking({ DB: createFakeDb().db } as never, 'order-1', 'sf', 'SF1382947302948');
      expect(noCallback).toEqual({ subscribed: false, reason: 'CALLBACK_URL_MISSING' });

      getNativePluginConfig.mockResolvedValue({ enabled: true, config: { kuaidi100Enabled: true, kuaidi100Key: 'k', kuaidi100Secret: 's', kuaidi100CallbackUrl: 'https://cb.example' } });
      const unsupported = await subscribeKuaidi100Tracking({ DB: createFakeDb().db } as never, 'order-1', 'cainiao', 'LP12345678901234');
      expect(unsupported).toEqual({ subscribed: false, reason: 'CARRIER_NOT_SUPPORTED' });

      getNativePluginConfig.mockResolvedValue({ enabled: false, config: {} });
      const pluginOff = await subscribeKuaidi100Tracking({ DB: createFakeDb().db } as never, 'order-1', 'sf', 'SF1382947302948');
      expect(pluginOff).toEqual({ subscribed: false, reason: 'PLUGIN_DISABLED' });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('exposes kuaidi100 readiness through the ship form', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue(kuaidi100EnabledConfig());
    const response = await tryNativeShipping(shipFormRequest(), { DB: {} } as never);
    const body = await response?.json() as { data: { kuaidi100: { enabled: boolean; callbackConfigured: boolean }; carriers: Array<{ code: string; kuaidi100Code: string | null }> } };
    expect(body.data.kuaidi100).toEqual({ enabled: true, callbackConfigured: true });
    const sf = body.data.carriers.find((carrier) => carrier.code === 'sf');
    expect(sf?.kuaidi100Code).toBe('shunfeng');
  });
});

describe('kuaidi100 relay configuration', () => {
  it('overrides poll/api base URLs when configured for a relay', async () => {
    getNativePluginConfig.mockResolvedValue({
      enabled: true,
      config: {
        kuaidi100Enabled: true, kuaidi100Key: 'test-key', kuaidi100Secret: 'test-secret',
        kuaidi100CallbackUrl: 'https://api.example.com/webhooks/kuaidi100',
        kuaidi100ApiBaseUrl: 'https://relay.example.internal/api',
        kuaidi100PollBaseUrl: 'https://relay.example.internal/poll',
      },
    });
    const { db } = createFakeDb();
    const urls: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ result: true, returnCode: '200', message: 'success', data: {} }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await subscribeKuaidi100Tracking({ DB: db } as never, 'order-1', 'sf', 'SF1382947302948');
      expect(result).toEqual({ subscribed: true });
      expect(urls[0]).toBe('https://relay.example.internal/poll/poll');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('retries a transient subscription failure once before succeeding', async () => {
    getNativePluginConfig.mockResolvedValue(kuaidi100EnabledConfig());
    const { db, statements } = createFakeDb();
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        // Simulate a transport-level failure (retryable path).
        throw new TypeError('fetch failed');
      }
      return new Response(JSON.stringify({ result: true, returnCode: '200', message: 'success', data: {} }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await subscribeKuaidi100Tracking({ DB: db } as never, 'order-1', 'sf', 'SF1382947302948');
      expect(result).toEqual({ subscribed: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const insert = statements.find((entry) => entry.sql.includes('INSERT INTO native_shipping_provider_orders'));
      expect(insert?.sql).toContain("'COMPLETED'");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
