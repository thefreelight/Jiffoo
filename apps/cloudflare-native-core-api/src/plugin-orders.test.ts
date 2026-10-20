import { afterEach, describe, expect, it, vi } from 'vitest';
import { tryNativePluginOrders } from './plugin-orders';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

function testEnv(overrides: Record<string, unknown> = {}) {
  // Table-backed fake: INSERT writes rows keyed by table name; SELECT reads
  // from the same table store, so idempotency tests exercise the real path.
  const tables = new Map<string, Record<string, unknown>[]>();
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async <T>(): Promise<T | null> => {
        const table = sql.trim().includes('native_plugin_payments') ? 'native_plugin_payments' : 'native_plugin_orders';
        const rows = tables.get(table) ?? [];
        if (sql.trim().startsWith('SELECT id, user_id, source_plugin') && sql.trim().includes('native_plugin_payments')) {
          const idempotencyKey = String(args[0]);
          return (rows.find((row) => row.idempotency_key === idempotencyKey) as T | undefined) ?? null;
        }
        if (sql.trim().includes('native_plugin_orders') && sql.trim().includes('WHERE source_plugin')) {
          const source = String(args[0]);
          const ref = String(args[1]);
          return (rows.find((row) => row.source_plugin === source && row.external_reference_id === ref) as T | undefined) ?? null;
        }
        return (rows[0] as T | undefined) ?? null;
      },
      run: async () => {
        const table = sql.trim().includes('native_plugin_payments') ? 'native_plugin_payments' : 'native_plugin_orders';
        const rows = tables.get(table) ?? [];
        if (sql.trim().startsWith('INSERT INTO native_plugin_orders')) {
          rows.push({ id: String(args[0]), user_id: String(args[1]), source_plugin: String(args[2]), entitlement_type: String(args[3]), external_reference_id: String(args[4]), name: String(args[5]), amount_cents: Number(args[6]), currency: String(args[7]), payment_method: String(args[8]), payment_status: String(args[9]), metadata_json: args[10] ?? null, created_at: String(args[11]) });
        } else if (sql.trim().startsWith('INSERT INTO native_plugin_payments')) {
          rows.push({ id: String(args[0]), order_id: String(args[1]), user_id: String(args[2]), provider: String(args[3]), idempotency_key: String(args[4]), session_url: String(args[5]), payment_intent_id: args[6] ?? null, status: String(args[7]), created_at: String(args[8]) });
        }
        tables.set(table, rows);
        return { success: true };
      },
    }),
  });
  const db = { prepare };
  return {
    DB: db,
    STRIPE_SECRET_KEY: { get: async () => 'sk_test_placeholder' },
    JWT_SECRET: { get: async () => 'jwt' },
    ...overrides,
  } as unknown as Parameters<typeof tryNativePluginOrders>[1];
}

function serviceRequest(body: unknown, token = 'plugin:stripe'): Request {
  return new Request('https://native.invalid/api/v1/internal/plugin-orders/checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function validToken(sub = 'plugin:stripe', secret = 'test-secret', issuer = 'jiffoo-platform'): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub, iss: issuer, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
  const encode = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput)));
  const sig = btoa(String.fromCharCode(...signature)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${signingInput}.${sig}`;
}

describe('native plugin orders proxy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects requests without a service token', async () => {
    const env = testEnv();
    const response = await tryNativePluginOrders(
      new Request('https://native.invalid/api/v1/internal/plugin-orders/checkout', { method: 'POST', body: '{}' }),
      env,
    );
    expect(response?.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const env = testEnv({ SERVICE_JWT_SECRET: 'test-secret' });
    const response = await tryNativePluginOrders(serviceRequest({}, 'plugin:stripe.tampered'), env);
    expect(response?.status).toBe(401);
  });

  it('rejects a valid token whose subject does not match the source plugin', async () => {
    const env = testEnv({ SERVICE_JWT_SECRET: 'test-secret' });
    const token = await validToken('plugin:other', 'test-secret');
    const response = await tryNativePluginOrders(
      serviceRequest({ userId: 'u1', sourcePlugin: 'stripe', entitlementType: 'tier', externalReferenceId: 'ref-1', name: 'Plus', amount: 6.99, currency: 'USD', paymentMethod: 'stripe' }, token),
      env,
    );
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'PLUGIN_IDENTITY_MISMATCH' } });
  });

  it('accepts a valid signed token and returns an order id', async () => {
    const env = testEnv({ SERVICE_JWT_SECRET: 'test-secret' });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })));
    const token = await validToken('plugin:stripe', 'test-secret');
    const response = await tryNativePluginOrders(
      serviceRequest({ userId: 'u1', sourcePlugin: 'stripe', entitlementType: 'tier', externalReferenceId: 'ref-1', name: 'Plus', amount: 6.99, currency: 'USD', paymentMethod: 'stripe' }, token),
      env,
    );
    expect(response?.status).toBe(201);
    const body = await response?.json() as { data: { orderId: string; checkoutUrl: string } };
    expect(body.data.orderId).toMatch(/^plugin_order_/);
    expect(body.data.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
  });

  it('is idempotent for the same external reference', async () => {
    const env = testEnv({ SERVICE_JWT_SECRET: 'test-secret' });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })));
    const token = await validToken('plugin:stripe', 'test-secret');
    const request = () => serviceRequest({ userId: 'u1', sourcePlugin: 'stripe', entitlementType: 'tier', externalReferenceId: 'ref-same', name: 'Plus', amount: 6.99, currency: 'USD', paymentMethod: 'stripe' }, token);
    const first = await tryNativePluginOrders(request(), env);
    const firstBody = await first?.json() as { data: { orderId: string } };
    expect(first?.status).toBe(201);
    const second = await tryNativePluginOrders(request(), env);
    const secondBody = await second?.json() as { data: { orderId: string } };
    expect(second?.status).toBe(200);
    expect(secondBody.data.orderId).toBe(firstBody.data.orderId);
  });

  it('rejects malformed input', async () => {
    const env = testEnv({ SERVICE_JWT_SECRET: 'test-secret' });
    const token = await validToken('plugin:stripe', 'test-secret');
    const response = await tryNativePluginOrders(
      serviceRequest({ userId: 'u1', sourcePlugin: 'stripe', entitlementType: 'tier', externalReferenceId: 'ref-1', name: 'Plus', amount: -5, currency: 'USD', paymentMethod: 'stripe' }, token),
      env,
    );
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'INVALID_PLUGIN_ORDER' } });
  });

  it('rejects unsupported payment methods', async () => {
    const env = testEnv({ SERVICE_JWT_SECRET: 'test-secret' });
    const token = await validToken('plugin:stripe', 'test-secret');
    const response = await tryNativePluginOrders(
      serviceRequest({ userId: 'u1', sourcePlugin: 'stripe', entitlementType: 'tier', externalReferenceId: 'ref-1', name: 'Plus', amount: 6.99, currency: 'USD', paymentMethod: 'paypal' }, token),
      env,
    );
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'UNSUPPORTED_PAYMENT_METHOD' } });
  });
});