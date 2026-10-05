import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser, tryNativeAuth: vi.fn(async () => null) }));

const { tryPostoryCompat } = await import('./postory-store');

const USER = { id: 'user-1', email: 'u@postory.cc', username: 'u', role: 'USER', avatar: null, emailVerified: true };

interface Executed {
  sql: string;
  bindings: unknown[];
}

interface DbOptions {
  subscriptionRow?: Record<string, unknown> | null;
  knownDevice?: boolean;
  deviceCount?: number;
  orderRow?: Record<string, unknown> | null;
}

function createDb(options: DbOptions = {}) {
  const executed: Executed[] = [];
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...bindings: unknown[]) => ({
        sql,
        bindings,
        first: async () => {
          executed.push({ sql, bindings });
          if (sql.includes('FROM postory_subscriptions') && sql.includes('current_period_end >')) {
            return options.subscriptionRow ?? null;
          }
          if (sql.includes('SELECT device_key FROM postory_subscription_devices')) {
            return options.knownDevice ? { device_key: bindings[2] } : null;
          }
          if (sql.includes('SELECT COUNT(*) AS count FROM postory_subscription_devices')) {
            return { count: options.deviceCount ?? 0 };
          }
          if (sql.includes('FROM postory_orders WHERE id')) {
            return options.orderRow ?? null;
          }
          return null;
        },
        run: async () => {
          executed.push({ sql, bindings });
          return { success: true };
        },
        all: async () => ({ results: [] }),
      }),
    })),
    batch: vi.fn(async (statements: Array<{ sql: string; bindings: unknown[] }>) => {
      for (const statement of statements) executed.push({ sql: statement.sql, bindings: statement.bindings });
      return [];
    }),
  };
  return { db, executed };
}

function baseEnv(db: unknown, overrides: Record<string, unknown> = {}) {
  return {
    DB: db,
    POSTORY_STORE_ENABLED: 'true',
    JWT_SECRET: { get: async () => 'jwt-secret' },
    STRIPE_SECRET_KEY: 'sk_live_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    YIPAY_PID: '1003',
    YIPAY_KEY: 'epay-key-test',
    YIPAY_GATEWAY: 'https://gw.example',
    ...overrides,
  } as never;
}

const activeSubscriptionRow = {
  planSlug: 'local-yearly',
  status: 'active',
  currentPeriodEnd: '2027-09-29T00:00:00.000Z',
};

const pendingOrder = {
  id: 'porder_1',
  user_id: 'user-1',
  plan_slug: 'local-yearly',
  provider: 'stripe',
  status: 'PENDING',
};

describe('postory store compat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is inert without POSTORY_STORE_ENABLED', async () => {
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/plans?product=postory'),
      { DB: db } as never,
    );
    expect(response).toBeNull();
  });

  it('serves the postory plan catalog', async () => {
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/plans?product=postory'),
      baseEnv(db),
    );
    const payload = await response!.json();
    expect(payload.success).toBe(true);
    expect(payload.data.map((plan: { slug: string }) => plan.slug)).toEqual(['trial', 'local-yearly', 'founder-yearly']);
  });

  it('rejects unknown products', async () => {
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/plans?product=other'),
      baseEnv(db),
    );
    expect(response!.status).toBe(400);
  });

  it('requires login for entitlement sync', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/entitlements/active?product=postory&deviceKey=d1'),
      baseEnv(db),
    );
    expect(response!.status).toBe(401);
  });

  it('returns an inactive entitlement for users without a subscription', async () => {
    authenticateNativeUser.mockResolvedValue(USER);
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/entitlements/active?product=postory'),
      baseEnv(db),
    );
    const payload = await response!.json();
    expect(payload.data).toMatchObject({ active: false, productKey: 'postory' });
  });

  it('registers a new device under the cap and returns the entitlement', async () => {
    authenticateNativeUser.mockResolvedValue(USER);
    const { db, executed } = createDb({ subscriptionRow: activeSubscriptionRow, deviceCount: 2 });
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/entitlements/active?product=postory&deviceKey=dev-new'),
      baseEnv(db),
    );
    const payload = await response!.json();
    expect(payload.data).toMatchObject({ active: true, planSlug: 'local-yearly', status: 'active' });
    expect(executed.some((e) => e.sql.includes('INSERT INTO postory_subscription_devices') && e.bindings[0] === 'dev-new')).toBe(true);
  });

  it('rejects the 6th distinct device with DEVICE_LIMIT and no insert', async () => {
    authenticateNativeUser.mockResolvedValue(USER);
    const { db, executed } = createDb({ subscriptionRow: activeSubscriptionRow, deviceCount: 5 });
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/entitlements/active?product=postory&deviceKey=dev-6th'),
      baseEnv(db),
    );
    expect(response!.status).toBe(403);
    const payload = await response!.json();
    expect(payload.error.code).toBe('DEVICE_LIMIT');
    expect(executed.some((e) => e.sql.includes('INSERT INTO postory_subscription_devices'))).toBe(false);
  });

  it('refreshes a known device without counting a new slot', async () => {
    authenticateNativeUser.mockResolvedValue(USER);
    const { db, executed } = createDb({ subscriptionRow: activeSubscriptionRow, knownDevice: true, deviceCount: 5 });
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/entitlements/active?product=postory&deviceKey=dev-known'),
      baseEnv(db),
    );
    expect(response!.status).toBe(200);
    expect(executed.some((e) => e.sql.includes('UPDATE postory_subscription_devices'))).toBe(true);
    expect(executed.some((e) => e.sql.includes('INSERT INTO postory_subscription_devices'))).toBe(false);
  });

  it('creates a stripe checkout session and a pending order', async () => {
    authenticateNativeUser.mockResolvedValue(USER);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: 'cs_live_1', url: 'https://checkout.stripe.com/c/pay/cs_live_1' }), { status: 200 }));
    const globalFetch = globalThis.fetch;
    globalThis.fetch = fetcher as typeof fetch;
    try {
      const { db, executed } = createDb();
      const response = await tryPostoryCompat(
        new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/subscriptions/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ product: 'postory', plan: 'local-yearly', paymentMethod: 'stripe', successUrl: 'https://postory.cc/?checkout=success', cancelUrl: 'https://postory.cc/?checkout=canceled' }),
        }),
        baseEnv(db),
      );
      const payload = await response!.json();
      expect(payload.data.session.url).toContain('checkout.stripe.com');
      const form = new URLSearchParams(String(fetcher.mock.calls[0][1].body));
      expect(form.get('mode')).toBe('subscription');
      expect(form.get('line_items[0][price_data][unit_amount]')).toBe('2900');
      expect(form.get('metadata[planSlug]')).toBe('local-yearly');
      expect(executed.some((e) => e.sql.includes('INSERT INTO postory_orders'))).toBe(true);
    } finally {
      globalThis.fetch = globalFetch;
    }
  });

  it('signs the yipay redirect with the merchant key', async () => {
    authenticateNativeUser.mockResolvedValue(USER);
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/subscriptions/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product: 'postory', plan: 'founder-yearly', paymentMethod: 'yipay', successUrl: 'https://postory.cc/?checkout=success' }),
      }),
      baseEnv(db),
    );
    const payload = await response!.json();
    expect(payload.data.session.url).toContain('gw.example/submit.php?');
    expect(payload.data.session.url).toContain('sign=');
    expect(payload.data.session.url).toContain('money=98.00');
  });

  it('activates the subscription from a signed stripe webhook', async () => {
    authenticateNativeUser.mockResolvedValue(USER);
    const { db, executed } = createDb({ orderRow: pendingOrder });
    const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_live_1', metadata: { orderId: 'porder_1', userId: 'user-1', planSlug: 'local-yearly' } } } });
    const timestamp = Math.floor(Date.now() / 1000);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('whsec_test'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const v1 = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`))), (b) => b.toString(16).padStart(2, '0')).join('');
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/stripe/api/api/payments/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': `t=${timestamp},v1=${v1}`, 'content-type': 'application/json' },
        body,
      }),
      baseEnv(db),
    );
    expect(response!.status).toBe(200);
    expect(executed.some((e) => e.sql.includes("status = 'PAID'") && e.bindings[0] === 'porder_1')).toBe(true);
    expect(executed.some((e) => e.sql.includes('INSERT INTO postory_subscriptions'))).toBe(true);
  });

  it('rejects stripe webhooks with a bad signature', async () => {
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/stripe/api/api/payments/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=deadbeef' },
        body: '{}',
      }),
      baseEnv(db),
    );
    expect(response!.status).toBe(400);
  });

  it('settles a signed yipay notify with the literal success response', async () => {
    authenticateNativeUser.mockResolvedValue(USER);
    const { db, executed } = createDb({ orderRow: pendingOrder });
    const sorted = 'money=98.00&out_trade_no=porder_1&trade_status=TRA_SUCCESS';
    const sign = createHash('md5').update(sorted + 'epay-key-test').digest('hex');
    const response = await tryPostoryCompat(
      new Request(`https://api.postory.cc/api/extensions/plugin/yipay/api/api/payments/webhook?out_trade_no=porder_1&trade_status=TRA_SUCCESS&money=98.00&sign=${sign}&sign_type=MD5`),
      baseEnv(db),
    );
    expect(await response!.text()).toBe('success');
    expect(executed.some((e) => e.sql.includes("status = 'PAID'"))).toBe(true);
  });

  it('rejects yipay notifies with a bad signature', async () => {
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/yipay/api/api/payments/webhook?out_trade_no=porder_1&trade_status=TRA_SUCCESS&money=98.00&sign=bad&sign_type=MD5'),
      baseEnv(db),
    );
    expect(response!.status).toBe(403);
  });
});

describe('postory CORS', () => {
  it('answers OPTIONS preflights with 204 and website CORS headers', async () => {
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/auth/login', {
        method: 'OPTIONS',
        headers: { origin: 'https://postory.cc', 'access-control-request-method': 'POST' },
      }),
      baseEnv(db),
    );
    expect(response?.status).toBe(204);
    expect(response?.headers.get('access-control-allow-origin')).toBe('https://postory.cc');
    expect(response?.headers.get('access-control-allow-headers')).toContain('content-type');
    expect(response?.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('adds CORS headers to actual responses from website origins', async () => {
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/plans?product=postory', {
        headers: { origin: 'https://postory.cc' },
      }),
      baseEnv(db),
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('access-control-allow-origin')).toBe('https://postory.cc');
  });

  it('does not emit CORS headers for unknown origins', async () => {
    const { db } = createDb();
    const response = await tryPostoryCompat(
      new Request('https://api.postory.cc/api/extensions/plugin/subscription/api/store/plans?product=postory', {
        headers: { origin: 'https://evil.example' },
      }),
      baseEnv(db),
    );
    expect(response?.headers.get('access-control-allow-origin')).toBeNull();
  });
});
