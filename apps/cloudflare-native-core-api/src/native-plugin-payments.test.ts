import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

// A build lists the modules it compiled in through the registry; the open-source build lists none.
const { modules } = vi.hoisted(() => ({ modules: [] as Array<Record<string, unknown>> }));
vi.mock('./native-plugin-modules/registry', () => ({ NATIVE_PLUGIN_MODULES: modules }));

const { authenticateNativeUser, authenticateNativeAdmin } = vi.hoisted(() => ({
  authenticateNativeUser: vi.fn(),
  authenticateNativeAdmin: vi.fn(),
}));
vi.mock('./auth', () => ({ authenticateNativeUser, authenticateNativeAdmin, getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn() }));
vi.mock('./shipments', () => ({ attachShipments: vi.fn() }));
vi.mock('./shipping-carriers', () => ({ getCarrier: vi.fn(), matchCarrierByName: vi.fn(), trackingUrlFor: vi.fn() }));
vi.mock('./shipping', () => ({ subscribeKuaidi100Tracking: vi.fn() }));

const { NativePaymentError } = await import('./native-plugin-modules/payments');
type NativePaymentCharge = import('./native-plugin-modules/payments').NativePaymentCharge;
type NativePaymentNotice = import('./native-plugin-modules/payments').NativePaymentNotice;
const { getNativePluginConfig, tryNativePluginSettings } = await import('./plugin-settings');
const { tryNativeAvailableMethods } = await import('./available-methods');
const { tryNativeCheckout } = await import('./checkout');
const { processNativePendingRefunds, tryNativeAdminWrites } = await import('./admin-writes');

type Json = Record<string, unknown>;
type Row = Record<string, unknown>;

const ORDER = 'ord_1001';
const BUYER = { id: 'user-1', email: 'buyer@example.com', username: 'buyer', role: 'USER' };
const ORIGIN = 'https://api.example.com';
const RETURN_URL = 'https://shop.example.com/en/order-success?session_id={CHECKOUT_SESSION_ID}';

/** A digest of the raw body keyed by the module's API key: what reaches the module in clear. */
async function keyed(key: string, raw: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(raw)))]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** What the fake module was asked and what it answers; a test sets the answers before it acts. */
const fake = {
  checkouts: [] as Array<{ settings: Json; charge: NativePaymentCharge }>,
  lookups: [] as Array<{ status: 'succeeded' | 'failed' | 'pending'; paymentId: string | null } | null>,
  refundOutcome: 'pending' as 'succeeded' | 'failed' | 'pending' | null,
  refunds: [] as Json[],
  refundAnswer: { outcome: 'pending', providerRefundId: 'TKT_1' },
  refundError: null as Error | null,
};

/** A checkout on a page of the module's own, signed deliveries, refunds by ticket. */
const fakepay = {
  id: 'fakepay',
  settings: {
    name: 'Fake Pay', version: '0.0.1', category: 'payment', description: 'A checkout on a page of its own.',
    fields: [
      { key: 'accountId', type: 'string', label: 'Account', required: true, pattern: '^ACC_', patternMessage: 'Account must start with ACC_' },
      { key: 'apiKey', type: 'secret', label: 'API key', required: true },
      { key: 'mode', type: 'string', label: 'Environment', enum: ['test', 'live'] },
    ],
    validate(config: Json) {
      if (config.mode !== undefined && config.mode !== 'test' && config.mode !== 'live') throw new Error('Environment must be test or live');
    },
  },
  paymentMethod(settings: Json) {
    if (!settings.accountId || !settings.apiKey) return null;
    return { displayName: 'Fake Pay', icon: 'credit-card', supportedCurrencies: ['USD'], isLive: settings.mode === 'live', clientConfig: {} };
  },
  payments: {
    webhookAck: 'text',
    async createCheckout(settings: Json, charge: NativePaymentCharge) {
      // Only the public settings are kept for the assertions; the test proves separately that the key arrives in clear.
      const { apiKey, ...publicSettings } = settings;
      fake.checkouts.push({ settings: { ...publicSettings, keyArrived: typeof apiKey === 'string' && apiKey.length > 0 }, charge });
      if (settings.accountId === 'ACC_down') throw new Error('Fake Pay is down for maintenance until Tuesday');
      if (settings.accountId === 'ACC_currency') throw new NativePaymentError('Fake Pay cannot settle EUR orders', 'CURRENCY_UNSUPPORTED');
      if (settings.accountId === 'ACC_total') throw new NativePaymentError('Fake Pay checkout requires a positive amount', 'INVALID_ORDER_TOTAL');
      if (settings.accountId === 'ACC_unset') throw new NativePaymentError('Fake Pay apiKey is not configured', 'NOT_CONFIGURED');
      return { providerSessionId: `cs_${charge.orderId}`, url: `https://pay.example/checkout/${charge.orderId}`, expiresAt: null };
    },
    async lookup(settings: Json, _session: { orderId: string; providerSessionId: string | null }) {
      if (settings.accountId === 'ACC_unreachable') throw new Error('network down');
      return fake.lookups.shift() ?? null;
    },
    async readWebhook(settings: Json, delivery: { rawBody: string; headers: Record<string, string> }) {
      if (delivery.headers['x-fake-signature'] !== await keyed(String(settings.apiKey), delivery.rawBody)) {
        throw new NativePaymentError('Fake Pay signature verification failed', 'INVALID_WEBHOOK');
      }
      const body = JSON.parse(delivery.rawBody) as Json;
      const orderId = typeof body.order_id === 'string' ? body.order_id : '';
      if (body.event === 'refund.succeeded' || body.event === 'refund.failed') {
        return {
          kind: 'refund', status: body.event === 'refund.succeeded' ? 'succeeded' : 'failed', eventId: String(body.id), orderId,
          paymentId: 'PAY_1', refundReference: typeof body.reference === 'string' ? body.reference : null, refundId: String(body.id), amountMinor: null,
        } satisfies NativePaymentNotice;
      }
      if (body.event !== 'order.completed') return { kind: 'ignored', eventId: String(body.id) } satisfies NativePaymentNotice;
      return {
        kind: 'payment', status: body.paid ? 'succeeded' : 'failed', eventId: 'PAY_1', orderId, paymentId: 'PAY_1',
        // A delivery that names no order carries the session the module opened instead.
        providerSessionId: orderId ? null : (typeof body.session === 'string' ? body.session : null),
        amountMinor: typeof body.charged === 'string' ? Math.round(Number(body.charged) * 100) : null,
        currency: typeof body.currency === 'string' ? body.currency : null,
      } satisfies NativePaymentNotice;
    },
    async createRefund(settings: Json, input: { paymentId: string; amountMinor: number; currency: string; reason: string | null; reference: string }) {
      if (fake.refundError) throw fake.refundError;
      fake.refunds.push({ accountId: settings.accountId, ...input });
      return { ...fake.refundAnswer };
    },
    async refundOutcome(_settings: Json, refund: { reference: string; providerRefundId: string | null }) {
      return refund.reference ? fake.refundOutcome : null;
    },
  },
};

/** A second module: JSON answers, and no way to return money by itself. */
const barepay = {
  id: 'barepay',
  settings: { name: 'Bare Pay', version: '0.0.1', description: 'Takes money, never returns it.', fields: [] },
  paymentMethod: () => ({ displayName: 'Bare Pay', icon: 'credit-card', supportedCurrencies: ['USD'], isLive: false, clientConfig: {} }),
  payments: {
    async createCheckout(_settings: Json, charge: NativePaymentCharge) {
      return { providerSessionId: `b_${charge.orderId}`, url: `https://bare.example/${charge.orderId}`, expiresAt: '2026-11-29T20:00:00.000Z' };
    },
    async lookup() { return null; },
    async readWebhook(_settings: Json, delivery: { rawBody: string }) {
      const body = JSON.parse(delivery.rawBody) as Json;
      return { kind: 'payment', status: 'succeeded', eventId: 'b_1', orderId: String(body.order_id), paymentId: 'B_1', providerSessionId: null, amountMinor: null, currency: null } satisfies NativePaymentNotice;
    },
  },
};

/** The store as the payment path asks for it: an unpaid order and every table a payment or a refund writes to. */
function store() {
  const s = {
    order: {
      payload: {
        id: ORDER, userId: BUYER.id, status: 'PENDING', paymentStatus: 'PENDING', currency: 'USD', totalAmount: 39.5, customerEmail: 'buyer@example.com',
        items: [{ id: 'item-1', productId: 'prod-1', variantId: 'var-1', productName: 'BOKMOO Card', quantity: 1, unitPrice: 39.5, totalPrice: 39.5 }],
      } as Json,
      status: 'PENDING', payment_status: 'PENDING', total_amount: 39.5, currency: 'USD', user_id: BUYER.id,
    },
    sessions: [] as Row[],
    events: [] as Row[],
    outbox: [] as Array<{ event_type: string; aggregate_id: string; payload: Json }>,
    notifications: [] as Row[],
    refunds: [] as Row[],
    audit: [] as Row[],
    plugins: new Map<string, { enabled: number; config_json: string; encrypted_secrets_json: string; id: string }>(),
    stock: 3,
  };
  const byId = (id: string) => s.sessions.find((row) => row.id === id) ?? null;
  const paid = () => s.sessions.filter((row) => row.status === 'SUCCEEDED').at(-1) ?? null;
  const refundTotal = () => s.refunds.filter((row) => row.status === 'PENDING' || row.status === 'COMPLETED').reduce((total, row) => total + Number(row.amount), 0);
  const pick = (row: Row | null | undefined, fields: string[]) => (row ? Object.fromEntries(fields.map((field) => [field, row[field]])) : null);

  const first = (sql: string, a: unknown[]) => {
    if (sql.includes('FROM native_order_snapshots snapshots JOIN')) {
      // Only this store's order answers; any other id is an order this store does not have.
      if (a[0] !== ORDER) return null;
      return { payload: JSON.stringify(s.order.payload), user_id: s.order.user_id, total_amount: s.order.total_amount, currency: s.order.currency, payment_status: s.order.payment_status, status: s.order.status };
    }
    if (sql.startsWith('SELECT id, session_url, expires_at FROM native_payment_sessions WHERE idempotency_key')) return pick(s.sessions.find((row) => row.idempotency_key === a[0]), ['id', 'session_url', 'expires_at']);
    if (sql.startsWith('SELECT * FROM native_payment_sessions WHERE id = ?1 AND user_id = ?2')) return byId(String(a[0]))?.user_id === a[1] ? byId(String(a[0])) : null;
    if (sql.startsWith('SELECT status FROM native_payment_sessions WHERE id = ?1')) return pick(byId(String(a[0])), ['status']);
    if (sql.startsWith('SELECT order_id FROM native_payment_sessions WHERE payment_intent_id')) return pick(s.sessions.find((row) => row.payment_intent_id === a[0] && row.provider === a[1]) ?? null, ['order_id']);
    if (sql.startsWith('SELECT total_amount, currency, user_id FROM native_order_metadata')) return a[0] === ORDER ? { total_amount: s.order.total_amount, currency: s.order.currency, user_id: s.order.user_id } : null;
    if (sql.startsWith('SELECT id, payment_intent_id, provider FROM native_payment_sessions WHERE order_id')) return pick(paid(), ['id', 'payment_intent_id', 'provider']);
    if (sql.startsWith('SELECT id, payment_intent_id, provider FROM native_payment_sessions WHERE id = ?1')) return pick(byId(String(a[0])), ['id', 'payment_intent_id', 'provider']);
    if (sql.startsWith('SELECT id FROM native_payment_sessions WHERE order_id')) return pick(paid(), ['id']);
    if (sql.startsWith('SELECT * FROM native_plugin_instances WHERE plugin_slug')) { const row = s.plugins.get(String(a[0])); return row ? { id: row.id, plugin_slug: a[0], instance_key: 'default', enabled: row.enabled, config_json: row.config_json, encrypted_secrets_json: row.encrypted_secrets_json } : null; }
    if (sql.startsWith('SELECT id, status FROM native_refunds WHERE idempotency_key')) return pick(s.refunds.find((row) => row.idempotency_key === a[0]), ['id', 'status']);
    if (sql.startsWith('SELECT id, order_id, amount, reason FROM native_refunds WHERE id = ?1')) return pick(s.refunds.find((row) => row.id === a[0] && row.status === 'PENDING'), ['id', 'order_id', 'amount', 'reason']);
    if (sql.startsWith('SELECT id, order_id, amount, reason FROM native_refunds WHERE provider_refund_id')) return pick(s.refunds.find((row) => row.provider_refund_id === a[0] && row.status === 'PENDING'), ['id', 'order_id', 'amount', 'reason']);
    if (sql.startsWith('SELECT id, order_id, payment_session_id, amount, reason, provider_refund_id FROM native_refunds WHERE id = ?1 AND status = ?2')) return pick(s.refunds.find((row) => row.id === a[0] && row.status === a[1]), ['id', 'order_id', 'payment_session_id', 'amount', 'reason', 'provider_refund_id']);
    if (sql.startsWith('SELECT COALESCE(SUM(amount), 0) AS amount FROM native_refunds')) return { amount: refundTotal() };
    return null;
  };

  const all = (sql: string, a: unknown[]) => {
    if (sql.startsWith('SELECT product_id, variant_id, quantity FROM native_order_items')) return [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 1 }];
    if (sql.startsWith("SELECT id FROM native_refunds WHERE status = 'PENDING' AND created_at < ?1")) return s.refunds.filter((row) => row.status === 'PENDING' && String(row.created_at) < String(a[0])).map((row) => ({ id: row.id }));
    if (sql.startsWith('SELECT plugin_slug, enabled FROM native_plugin_instances')) return [...s.plugins].map(([slug, row]) => ({ plugin_slug: slug, enabled: row.enabled }));
    return [];
  };

  const run = (sql: string, a: unknown[]) => {
    let changes = 0;
    if (sql.startsWith('DELETE FROM native_payment_sessions WHERE id = ?1')) {
      const before = s.sessions.length; s.sessions = s.sessions.filter((row) => row.id !== a[0]); changes = before - s.sessions.length;
    } else if (sql.startsWith('INSERT INTO native_payment_sessions')) {
      if (byId(String(a[0]))) throw new Error('UNIQUE constraint failed: native_payment_sessions.id');
      s.sessions.push({ id: a[0], order_id: a[1], user_id: a[2], provider: a[3], idempotency_key: a[4], session_url: a[5], payment_intent_id: a[6], status: 'PENDING', expires_at: a[7], updated_at: a[8] });
    } else if (sql.startsWith('INSERT INTO native_payment_events')) {
      // (id, provider, received_at) are bound; the event type is written into the statement.
      if (s.events.some((row) => row.provider_event_id === a[0])) throw new Error('UNIQUE constraint failed: native_payment_events.provider_event_id');
      s.events.push({ provider_event_id: a[0], provider: a[1], event_type: /VALUES \(\?1, \?2, '([a-z_.]+)', \?3\)/.exec(sql)?.[1] });
    } else if (sql.startsWith("UPDATE native_payment_sessions SET status = 'SUCCEEDED'")) {
      for (const row of s.sessions) if (row.order_id === a[2] && row.provider === a[3]) { Object.assign(row, { status: 'SUCCEEDED', payment_intent_id: a[0] ?? row.payment_intent_id }); changes += 1; }
    } else if (sql.startsWith("UPDATE native_order_metadata SET payment_status = 'PAID' WHERE order_id = ?1")) {
      s.order.payment_status = 'PAID'; changes = 1;
    } else if (sql.startsWith("UPDATE native_order_snapshots SET status = 'PAID', payload = ?1")) {
      s.order.status = 'PAID'; s.order.payload = JSON.parse(String(a[0])); changes = 1;
    } else if (sql.startsWith('INSERT INTO native_checkout_outbox')) {
      s.outbox.push({ event_type: sql.includes("'order.refunded'") ? 'order.refunded' : 'payment.succeeded', aggregate_id: String(a[1]), payload: JSON.parse(String(a[2])) }); changes = 1;
    } else if (sql.startsWith('INSERT INTO native_bokmoo_notifications')) {
      s.notifications.push({ id: a[0], user_id: a[1] }); changes = 1;
    } else if (sql.startsWith('INSERT INTO native_plugin_instances')) {
      s.plugins.set(String(a[1]), { id: String(a[0]), enabled: Number(a[2]), config_json: String(a[3]), encrypted_secrets_json: String(a[4]) }); changes = 1;
    } else if (sql.startsWith('INSERT INTO native_refunds')) {
      s.refunds.push({ id: a[0], order_id: a[1], payment_session_id: a[2], idempotency_key: a[3], amount: a[4], currency: a[5], status: 'PENDING', reason: a[6], provider_refund_id: null, created_at: a[7], completed_at: null });
      changes = 1;
    } else if (sql.startsWith('DELETE FROM native_refunds WHERE id = ?1 AND status =')) {
      const before = s.refunds.length; s.refunds = s.refunds.filter((row) => !(row.id === a[0] && row.status === 'PENDING')); changes = before - s.refunds.length;
    } else if (sql.startsWith('UPDATE native_refunds SET provider_refund_id = ?1 WHERE id = ?2')) {
      for (const row of s.refunds) if (row.id === a[1] && row.status === 'PENDING') { row.provider_refund_id = a[0]; changes = 1; }
    } else if (sql.startsWith("UPDATE native_refunds SET status = 'COMPLETED'")) {
      for (const row of s.refunds) if (row.id === a[2] && row.status === 'PENDING') { Object.assign(row, { status: 'COMPLETED', provider_refund_id: a[0], completed_at: a[1] }); changes = 1; }
    } else if (sql.startsWith('UPDATE native_order_metadata SET payment_status = ?1 WHERE order_id = ?2')) {
      s.order.payment_status = a[0]; changes = 1;
    } else if (sql.startsWith('UPDATE native_order_snapshots SET status = ?1, payload = ?2')) {
      s.order.status = a[0]; s.order.payload = JSON.parse(String(a[1])); changes = 1;
    } else if (sql.startsWith('UPDATE native_inventory')) {
      s.stock += Number(a[0]); changes = 1;
    } else if (sql.startsWith('INSERT INTO native_order_audit')) {
      s.audit.push({ order_id: a[1], actor_id: a[2] }); changes = 1;
    } else throw new Error(`unexpected statement ${sql}`);
    return { success: true, meta: { changes } };
  };

  type Bound = { sql: string; args: unknown[] };
  const statement = (sql: string) => {
    const bound = (...args: unknown[]) => ({ sql, args, run: async () => run(sql, args), first: async () => first(sql, args), all: async () => ({ results: all(sql, args) }) });
    return { sql, bind: bound };
  };
  const DB = {
    prepare: statement,
    batch: async (statements: Bound[]) => {
      for (const bound of statements) if (bound.sql.startsWith('INSERT INTO native_payment_events') && s.events.some((row) => row.provider_event_id === bound.args[0])) throw new Error('UNIQUE constraint failed: native_payment_events.provider_event_id');
      for (const bound of statements) run(bound.sql, bound.args);
      return statements.map(() => ({ success: true, meta: {} }));
    },
  };
  return { env: { DB, NATIVE_CHECKOUT_ENABLED: 'true', JWT_SECRET_VALUE: 'unit-test-secret-not-used-anywhere-else', STRIPE_SECRET_KEY: undefined } as never, s };
}

const post = (path: string, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) => new Request(`${ORIGIN}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
const data = async (response: Response | null) => (await response?.json()) as { success: boolean; data?: Json; error?: { code: string; message?: string } };

/** Saves the module's settings the way the Admin does, with the administrator's answers. */
async function configure(env: unknown, slug: string, config: Json, enabled = true) {
  const response = await tryNativePluginSettings(post(`/api/v1/extensions/plugin/${slug}/instances`, { enabled, config }), env as never);
  const payload = await data(response);
  if (response?.status !== 201) throw new Error(`configuring ${slug} failed: ${response?.status} ${JSON.stringify(payload)}`);
  return payload;
}
const fakepayReady = { accountId: 'ACC_1', apiKey: 'fake-secret-key', mode: 'live' };

async function openFakepaySession(env: unknown) {
  const response = await tryNativeCheckout(post('/api/v1/payments/sessions', { paymentMethod: 'fakepay', orderId: ORDER, successUrl: RETURN_URL, cancelUrl: 'https://shop.example.com/en/checkout' }), env as never, () => Promise.resolve(null));
  expect(response?.status).toBe(201);
  return (await data(response)).data!;
}

/** A delivery the fake module signs with the key the store saved for it. */
async function fakepayDelivery(env: unknown, payload: unknown) {
  const plugin = await getNativePluginConfig(env as never, 'fakepay');
  const raw = JSON.stringify(payload);
  return new Request(`${ORIGIN}/api/v1/payments/webhook/fakepay`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-fake-signature': await keyed(String(plugin?.config.apiKey), raw) }, body: raw });
}
const PAID = { event: 'order.completed', id: 'evt_1', order_id: ORDER, paid: true, charged: '39.50', currency: 'USD' };

const askRefund = (env: unknown, key = 'refund-1') => tryNativeAdminWrites(post(`/api/v1/admin/orders/${ORDER}/refund`, { idempotencyKey: key, reason: 'test order' }), env as never);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-28T20:00:00.000Z'));
  modules.length = 0;
  modules.push(fakepay as never, barepay as never);
  authenticateNativeUser.mockResolvedValue(BUYER);
  authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
  fake.checkouts.length = 0; fake.lookups.length = 0; fake.refunds.length = 0;
  fake.refundOutcome = 'pending'; fake.refundAnswer = { outcome: 'pending', providerRefundId: 'TKT_1' }; fake.refundError = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a payment module answers only when the build compiled it in', () => {
  it('leaves the checkout, the methods and the settings of the open-source build as they were', async () => {
    modules.length = 0;
    const { env } = store();
    const response = await tryNativeCheckout(post('/api/v1/payments/sessions', { paymentMethod: 'fakepay', orderId: ORDER, successUrl: RETURN_URL }), env, () => Promise.resolve(null));
    expect(response).toBeNull();
    // No card method either: nothing is configured for one in this store.
    expect(await (await tryNativeAvailableMethods(new Request(`${ORIGIN}/api/v1/payments/available-methods`), env))?.json()).toMatchObject({ data: [] });
    const listed = await tryNativePluginSettings(new Request(`${ORIGIN}/api/v1/extensions/plugin`, { headers: { authorization: 'Bearer admin' } }), env);
    expect(((await data(listed)).data as { items: Array<{ slug: string }> }).items.map((item) => item.slug)).not.toContain('fakepay');
  });
});

describe('the module\'s settings in the Admin', () => {
  it('are listed with the plugin, and are saved with the key sealed', async () => {
    const { env, s } = store();
    const listed = await tryNativePluginSettings(new Request(`${ORIGIN}/api/v1/extensions/plugin`, { headers: { authorization: 'Bearer admin' } }), env);
    const item = ((await data(listed)).data as { items: Array<Json> }).items.find((entry) => entry.slug === 'fakepay');
    expect(item).toMatchObject({ name: 'Fake Pay', version: '0.0.1', category: 'payment', enabled: false, configSchema: { apiKey: { type: 'secret', required: true }, accountId: { pattern: '^ACC_' } } });

    const saved = await configure(env, 'fakepay', fakepayReady);

    expect(saved.data).toMatchObject({ enabled: true, config: { accountId: 'ACC_1', mode: 'live', apiKey: '' }, configMeta: { secretFields: { apiKey: { configured: true } } } });
    const stored = s.plugins.get('fakepay')!;
    expect(stored.config_json).not.toContain('fake-secret-key');
    expect(stored.encrypted_secrets_json).not.toContain('fake-secret-key');
    // The module reads the key back in clear; the Admin never does.
    const plugin = await getNativePluginConfig(env as never, 'fakepay');
    expect(plugin).toMatchObject({ enabled: true, config: { accountId: 'ACC_1', apiKey: 'fake-secret-key', mode: 'live' } });
  });

  it('refuse an account that is not the gateway\'s own, a missing key, and a value the module rejects', async () => {
    const { env } = store();
    const save = async (config: Json, enabled = true) => {
      const response = await tryNativePluginSettings(post('/api/v1/extensions/plugin/fakepay/instances', { enabled, config }), env as never);
      return { status: response?.status, error: (await data(response)).error };
    };
    expect(await save({ ...fakepayReady, accountId: 'XYZ_1' })).toMatchObject({ status: 400, error: { code: 'INVALID_PLUGIN_CONFIG', message: 'Account must start with ACC_' } });
    expect(await save({ accountId: 'ACC_1', mode: 'live' })).toMatchObject({ status: 400, error: { message: 'Required plugin configuration is missing: apiKey' } });
    expect(await save({ ...fakepayReady, mode: 'later' })).toMatchObject({ status: 400, error: { message: 'Environment must be test or live' } });
    // An administrator who saves a half-filled form without switching the plugin on may.
    expect((await save({ accountId: 'ACC_1' }, false)).status).toBe(201);
  });
});

describe('a shopper pays through a payment module', () => {
  it('is sent to the module\'s page, and the session is kept by the order', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);

    const response = await data(await tryNativeCheckout(post('/api/v1/payments/sessions', { paymentMethod: 'fakepay', orderId: ORDER, successUrl: RETURN_URL, cancelUrl: 'https://shop.example.com/en/checkout' }), env, () => Promise.resolve(null)));

    expect(response.data).toMatchObject({ sessionId: `fakepay_${ORDER}`, url: `https://pay.example/checkout/${ORDER}` });
    expect(s.sessions).toEqual([expect.objectContaining({ id: `fakepay_${ORDER}`, order_id: ORDER, user_id: BUYER.id, provider: 'fakepay', payment_intent_id: `cs_${ORDER}`, status: 'PENDING' })]);
    // The module gets the order total, the shopper, the store's own webhook route for it, and the
    // key in clear; and the return address names the session this store keeps.
    expect(fake.checkouts).toEqual([{
      settings: expect.objectContaining({ accountId: 'ACC_1', keyArrived: true }),
      charge: {
        orderId: ORDER, amountMinor: 3950, currency: 'USD', buyerEmail: BUYER.email,
        successUrl: `https://shop.example.com/en/order-success?session_id=fakepay_${ORDER}`,
        cancelUrl: 'https://shop.example.com/en/checkout',
        notifyUrl: `${ORIGIN}/api/v1/payments/webhook/fakepay`,
        idempotencyKey: `order:${ORDER}:fakepay`,
      },
    }]);
  });

  it('continues the same payment when the checkout is reopened, and gets a new page once the old one has run out', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);
    const body = { paymentMethod: 'fakepay', orderId: ORDER, successUrl: RETURN_URL };

    const first = await openFakepaySession(env);
    const again = await tryNativeCheckout(post('/api/v1/payments/sessions', body), env, () => Promise.resolve(null));

    expect(await data(again)).toMatchObject({ data: { sessionId: first.sessionId, url: first.url } });
    expect(fake.checkouts).toHaveLength(1);

    s.sessions[0]!.expires_at = '2026-11-28T19:00:00.000Z';
    const renewed = await data(await tryNativeCheckout(post('/api/v1/payments/sessions', body), env, () => Promise.resolve(null)));

    expect(fake.checkouts).toHaveLength(2);
    expect(s.sessions).toHaveLength(1);
    // The same key would only hand back the page that ran out.
    expect(fake.checkouts[1]!.charge.idempotencyKey).not.toBe(fake.checkouts[0]!.charge.idempotencyKey);
    expect(renewed.data).toMatchObject({ sessionId: `fakepay_${ORDER}`, url: `https://pay.example/checkout/${ORDER}` });
  });

  it('is refused, with the module never asked, while the plugin is off or not set up', async () => {
    const { env, s } = store();
    const body = { paymentMethod: 'fakepay', orderId: ORDER, successUrl: RETURN_URL };
    expect((await data(await tryNativeCheckout(post('/api/v1/payments/sessions', body), env, () => Promise.resolve(null)))).error).toMatchObject({ code: 'PAYMENT_METHOD_NOT_AVAILABLE' });

    // Switched on with no key saved: the Admin refuses to save that, so the row is turned over by hand here.
    await configure(env, 'fakepay', { accountId: 'ACC_1', mode: 'live' }, false);
    expect((await data(await tryNativeCheckout(post('/api/v1/payments/sessions', body), env, () => Promise.resolve(null)))).error).toMatchObject({ code: 'PAYMENT_METHOD_NOT_AVAILABLE' });
    s.plugins.get('fakepay')!.enabled = 1;
    expect((await data(await tryNativeCheckout(post('/api/v1/payments/sessions', body), env, () => Promise.resolve(null)))).error).toMatchObject({ code: 'PAYMENT_METHOD_NOT_AVAILABLE' });

    const off = store();
    await configure(off.env, 'fakepay', fakepayReady, false);
    expect((await data(await tryNativeCheckout(post('/api/v1/payments/sessions', body), off.env, () => Promise.resolve(null)))).error).toMatchObject({ code: 'PAYMENT_METHOD_NOT_AVAILABLE' });

    // A method no module takes is not the core's to answer either.
    expect(await tryNativeCheckout(post('/api/v1/payments/sessions', { ...body, paymentMethod: 'someone-else' }), env, () => Promise.resolve(null))).toBeNull();
    expect(fake.checkouts).toEqual([]);
  });

  it('is not sent back to an address that is not https', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);
    const response = await tryNativeCheckout(post('/api/v1/payments/sessions', { paymentMethod: 'fakepay', orderId: ORDER, successUrl: 'bokmoo://payment/return/ord_1001' }), env, () => Promise.resolve(null));
    expect(response?.status).toBe(400);
    expect(fake.checkouts).toEqual([]);
    expect(s.sessions).toEqual([]);
  });

  it.each([
    ['ACC_down', 502, 'PAYMENT_PLUGIN_FAILED'],
    ['ACC_currency', 400, 'CURRENCY_NOT_SUPPORTED'],
    ['ACC_total', 409, 'INVALID_ORDER_TOTAL'],
    ['ACC_unset', 503, 'PAYMENT_METHOD_NOT_CONFIGURED'],
  ] as const)('is told only that %s cannot be used, without the module\'s own words', async (accountId, status, code) => {
    const { env, s } = store();
    await configure(env, 'fakepay', { ...fakepayReady, accountId });

    const response = await tryNativeCheckout(post('/api/v1/payments/sessions', { paymentMethod: 'fakepay', orderId: ORDER, successUrl: RETURN_URL }), env, () => Promise.resolve(null));
    const payload = await data(response);

    expect(response?.status).toBe(status);
    expect(payload.error).toMatchObject({ code });
    expect(JSON.stringify(payload)).not.toMatch(/maintenance|Tuesday|cannot settle|positive amount/);
    expect(s.sessions).toEqual([]);
  });

  it('has its method on the storefront list only while the plugin is enabled and usable', async () => {
    const { env, s } = store();
    const list = async () => ((await (await tryNativeAvailableMethods(new Request(`${ORIGIN}/api/v1/payments/available-methods`), env as never))?.json()) as { data: Array<Json> }).data;

    // No card method is configured in this store, so the list starts empty.
    expect(await list()).toEqual([]);
    await configure(env, 'fakepay', fakepayReady, false);
    expect(await list()).toEqual([]);
    await configure(env, 'fakepay', fakepayReady);
    expect(await list()).toEqual([{ name: 'fakepay', displayName: 'Fake Pay', icon: 'credit-card', supportedCurrencies: ['USD'], isLive: true, clientConfig: {} }]);

    // Switched on by hand with no key saved (the Admin refuses to save that itself):
    // the module says it cannot use these settings, so the method stays off the list.
    await configure(env, 'fakepay', { accountId: 'ACC_1', apiKey: null, mode: 'test' }, false);
    s.plugins.get('fakepay')!.enabled = 1;
    expect(await list()).toEqual([]);
    const session = await data(await tryNativeCheckout(post('/api/v1/payments/sessions', { paymentMethod: 'fakepay', orderId: ORDER, successUrl: RETURN_URL }), env, () => Promise.resolve(null)));
    expect(session.error).toMatchObject({ code: 'PAYMENT_METHOD_NOT_AVAILABLE' });
    expect(fake.checkouts).toEqual([]);
  });
});

describe('a payment module reports a payment', () => {
  it('settles the order once, on a signed delivery, and nothing more on its repeat', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);
    await openFakepaySession(env);

    const first = await tryNativeCheckout(await fakepayDelivery(env, PAID), env, () => Promise.resolve(null));
    const repeat = await tryNativeCheckout(await fakepayDelivery(env, PAID), env, () => Promise.resolve(null));

    // This module's gateway reads anything but the bare word as a failed delivery.
    expect(first?.status).toBe(200);
    expect(await first?.text()).toBe('success');
    expect(await repeat?.text()).toBe('success');
    expect(s.order).toMatchObject({ status: 'PAID', payment_status: 'PAID' });
    // The module's payment id replaces its session id: it is what a refund is asked against.
    expect(s.sessions[0]).toMatchObject({ status: 'SUCCEEDED', payment_intent_id: 'PAY_1' });
    expect(s.events).toEqual([{ provider_event_id: 'fakepay:paid:ord_1001', provider: 'fakepay', event_type: 'payment.succeeded' }]);
    expect(s.outbox).toEqual([{ event_type: 'payment.succeeded', aggregate_id: ORDER, payload: { orderId: ORDER, sessionId: 'fakepay_ord_1001', provider: 'fakepay', paymentId: 'PAY_1' } }]);
    expect(s.notifications).toHaveLength(1);
  });

  it('settles nothing for a payment that did not go through, or for an order it cannot name', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);
    await openFakepaySession(env);

    for (const payload of [{ ...PAID, paid: false }, { ...PAID, order_id: 'ord_someone_else' }]) {
      const response = await tryNativeCheckout(await fakepayDelivery(env, payload), env, () => Promise.resolve(null));
      expect(await response?.text()).toBe('success');
    }

    expect(s.order).toMatchObject({ status: 'PENDING', payment_status: 'PENDING' });
    expect(s.events).toEqual([]);
    expect(s.outbox).toEqual([]);
  });

  it('refuses a delivery that was not signed, and writes nothing it said', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);
    await openFakepaySession(env);
    const signed = await fakepayDelivery(env, PAID);
    const route = `${ORIGIN}/api/v1/payments/webhook/fakepay`;

    expect((await tryNativeCheckout(new Request(route, { method: 'POST', body: JSON.stringify(PAID) }), env, () => Promise.resolve(null)))?.status).toBe(400);
    const altered = new Request(route, { method: 'POST', headers: signed.headers, body: JSON.stringify({ ...PAID, order_id: 'ord_someone_else' }) });
    expect(await (await tryNativeCheckout(altered, env, () => Promise.resolve(null)))?.text()).toBe('fail');

    expect(s.order).toMatchObject({ status: 'PENDING', payment_status: 'PENDING' });
    expect(s.events).toEqual([]);
  });

  it('does not settle a payment that charged less than the order', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);
    await openFakepaySession(env);

    const short = await tryNativeCheckout(await fakepayDelivery(env, { ...PAID, charged: '3.50' }), env, () => Promise.resolve(null));

    expect(await short?.text()).toBe('success');
    expect(s.order).toMatchObject({ status: 'PENDING', payment_status: 'PENDING' });
    expect(s.outbox).toEqual([]);
  });

  it('takes a payment made in the shopper\'s local currency at the module\'s word', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);
    await openFakepaySession(env);

    // The gateway converts the total itself; this store has no rate to check the converted amount against.
    const response = await tryNativeCheckout(await fakepayDelivery(env, { ...PAID, currency: 'JPY', charged: '5900' }), env, () => Promise.resolve(null));

    expect(await response?.text()).toBe('success');
    expect(s.order).toMatchObject({ status: 'PAID' });
  });

  it('finds the order by the module\'s own session id when the delivery names none', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);
    await openFakepaySession(env);

    const response = await tryNativeCheckout(await fakepayDelivery(env, { event: 'order.completed', id: 'evt_2', paid: true, session: 'cs_ord_1001' }), env, () => Promise.resolve(null));

    expect(await response?.text()).toBe('success');
    expect(s.order).toMatchObject({ status: 'PAID', payment_status: 'PAID' });
    expect(s.sessions[0]).toMatchObject({ status: 'SUCCEEDED', payment_intent_id: 'PAY_1' });
    expect(s.events[0]).toMatchObject({ provider_event_id: 'fakepay:paid:ord_1001' });
  });

  it('answers a module whose gateway reads JSON with the core\'s envelope', async () => {
    const { env, s } = store();
    await configure(env, 'barepay', {});
    await tryNativeCheckout(post('/api/v1/payments/sessions', { paymentMethod: 'barepay', orderId: ORDER, successUrl: RETURN_URL }), env, () => Promise.resolve(null));

    const response = await tryNativeCheckout(new Request(`${ORIGIN}/api/v1/payments/webhook/barepay`, { method: 'POST', body: JSON.stringify({ order_id: ORDER }) }), env, () => Promise.resolve(null));

    expect(await data(response)).toMatchObject({ success: true, data: { applied: true, duplicate: false, normalizedStatus: 'succeeded' } });
    expect(s.sessions[0]).toMatchObject({ provider: 'barepay', status: 'SUCCEEDED', payment_intent_id: 'B_1' });
    expect(s.events[0]).toMatchObject({ provider_event_id: 'barepay:paid:ord_1001' });
  });

  it('is asked directly when the shopper comes back before the delivery does', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', fakepayReady);
    await openFakepaySession(env);
    fake.lookups = [{ status: 'succeeded', paymentId: 'PAY_late' }];

    const response = await tryNativeCheckout(new Request(`${ORIGIN}/api/v1/payments/sessions/fakepay_${ORDER}`, { headers: { authorization: 'Bearer buyer' } }), env, () => Promise.resolve(null));

    expect(await data(response)).toMatchObject({ data: { sessionId: `fakepay_${ORDER}`, orderId: ORDER, status: 'paid', paymentMethod: 'fakepay' } });
    expect(s.order).toMatchObject({ status: 'PAID', payment_status: 'PAID' });
    expect(s.sessions[0]).toMatchObject({ payment_intent_id: 'PAY_late' });
  });

  it('stays unpaid while the module cannot be asked, without failing the shopper', async () => {
    const { env, s } = store();
    await configure(env, 'fakepay', { ...fakepayReady, accountId: 'ACC_unreachable' });
    await openFakepaySession(env);

    const response = await tryNativeCheckout(new Request(`${ORIGIN}/api/v1/payments/verify/fakepay_${ORDER}`, { headers: { authorization: 'Bearer buyer' } }), env, () => Promise.resolve(null));

    expect(response?.status).toBe(200);
    expect(await data(response)).toMatchObject({ data: { status: 'pending' } });
    expect(s.order).toMatchObject({ status: 'PENDING' });
  });
});

describe('an administrator refunds a payment a module took', () => {
  async function paidThrough(env: unknown) {
    await configure(env, 'fakepay', fakepayReady);
    await openFakepaySession(env);
    await tryNativeCheckout(await fakepayDelivery(env, PAID), env, () => Promise.resolve(null));
  }

  it('asks the module, and finishes the refund when the module\'s gateway announces it', async () => {
    const { env, s } = store();
    await paidThrough(env);

    const asked = await askRefund(env);

    // Taken, not confirmed: the order is as it was, and the refund waits with the module's ticket on it.
    expect(asked?.status).toBe(202);
    expect(await data(asked)).toMatchObject({ data: { status: 'PAID', paymentStatus: 'PAID', refundPending: true } });
    expect(s.refunds).toMatchObject([{ status: 'PENDING', amount: 39.5, provider_refund_id: 'TKT_1', payment_session_id: `fakepay_${ORDER}` }]);
    // The module is asked against the payment it named, with the store's own number for the refund.
    expect(fake.refunds).toEqual([{ accountId: 'ACC_1', paymentId: 'PAY_1', amountMinor: 3950, currency: 'USD', reason: 'test order', reference: s.refunds[0]!.id }]);
    expect(s.outbox).toHaveLength(1);

    const announced = await tryNativeCheckout(await fakepayDelivery(env, { event: 'refund.succeeded', id: 'REF_1', order_id: ORDER, reference: String(s.refunds[0]!.id) }), env, () => Promise.resolve(null));
    expect(await announced?.text()).toBe('success');

    expect(s.refunds).toMatchObject([{ status: 'COMPLETED', provider_refund_id: 'REF_1' }]);
    expect(s.order).toMatchObject({ status: 'REFUNDED', payment_status: 'REFUNDED' });
    // A full refund puts the stock back.
    expect(s.stock).toBe(4);
    expect(s.audit).toMatchObject([{ actor_id: 'system:refund-webhook' }]);
    expect(s.outbox.at(-1)).toMatchObject({ event_type: 'order.refunded', payload: { fullyRefunded: true, amount: 39.5, paymentId: 'fakepay_ord_1001' } });
    // The delivery's repeat, and the timer, change nothing.
    expect(await (await tryNativeCheckout(await fakepayDelivery(env, { event: 'refund.succeeded', id: 'REF_1', order_id: ORDER, reference: String(s.refunds[0]!.id) }), env, () => Promise.resolve(null)))?.text()).toBe('success');
    fake.refundOutcome = 'succeeded';
    expect(await processNativePendingRefunds(env as never)).toEqual({ picked: 0, completed: 0, failed: 0 });
    expect(s.outbox).toHaveLength(2);
  });

  it('gives the refund up when the module\'s gateway does, and the order can be refunded again', async () => {
    const { env, s } = store();
    await paidThrough(env);
    expect((await askRefund(env))?.status).toBe(202);

    fake.refundOutcome = 'failed';
    vi.setSystemTime(new Date('2026-11-28T20:02:00.000Z'));
    expect(await processNativePendingRefunds(env as never)).toEqual({ picked: 1, completed: 0, failed: 1 });

    expect(s.refunds).toEqual([]);
    expect(s.order).toMatchObject({ status: 'PAID', payment_status: 'PAID' });
    expect(s.outbox).toHaveLength(1);
    // A delivery about a refund nobody is waiting on any more writes nothing.
    const gone = await fakepayDelivery(env, { event: 'refund.succeeded', id: 'REF_1', order_id: ORDER, reference: 'refund-gone' });
    expect(await (await tryNativeCheckout(gone, env, () => Promise.resolve(null)))?.text()).toBe('success');
    expect(s.order).toMatchObject({ status: 'PAID' });
  });

  it('finishes on the spot a refund the module confirms as it is asked', async () => {
    const { env, s } = store();
    await paidThrough(env);
    fake.refundAnswer = { outcome: 'succeeded', providerRefundId: null };

    const response = await askRefund(env);

    expect(response?.status).toBe(200);
    expect(await data(response)).toMatchObject({ data: { status: 'REFUNDED' } });
    expect(s.refunds).toMatchObject([{ status: 'COMPLETED', provider_refund_id: s.refunds[0]?.id }]);
    expect(s.audit).toMatchObject([{ actor_id: 'admin-1' }]);
  });

  it('waits on a refund the module still has, and finishes it when the timer asks again', async () => {
    const { env, s } = store();
    await paidThrough(env);
    expect((await askRefund(env))?.status).toBe(202);
    expect(await processNativePendingRefunds(env as never)).toEqual({ picked: 0, completed: 0, failed: 0 });

    fake.refundOutcome = 'succeeded';
    vi.setSystemTime(new Date('2026-11-28T20:02:00.000Z'));
    expect(await processNativePendingRefunds(env as never)).toEqual({ picked: 1, completed: 1, failed: 0 });

    expect(s.refunds).toMatchObject([{ status: 'COMPLETED' }]);
    expect(s.order).toMatchObject({ status: 'REFUNDED', payment_status: 'REFUNDED' });
    expect(s.audit).toMatchObject([{ actor_id: 'system:refund-reconciliation' }]);
  });

  it('keeps a refund out that the module refused, and tells the administrator why', async () => {
    const { env, s } = store();
    await paidThrough(env);
    fake.refundAnswer = { outcome: 'failed', providerRefundId: null };

    const response = await askRefund(env);

    expect(response?.status).toBe(502);
    expect((await data(response)).error).toMatchObject({ code: 'PAYMENT_REFUND_FAILED' });
    expect(s.refunds).toEqual([]);
    expect(s.order).toMatchObject({ status: 'PAID' });
  });

  it('refuses, without asking, a refund of a method that cannot return money by itself', async () => {
    const { env, s } = store();
    await configure(env, 'barepay', {});
    await tryNativeCheckout(post('/api/v1/payments/sessions', { paymentMethod: 'barepay', orderId: ORDER, successUrl: RETURN_URL }), env, () => Promise.resolve(null));
    await tryNativeCheckout(new Request(`${ORIGIN}/api/v1/payments/webhook/barepay`, { method: 'POST', body: JSON.stringify({ order_id: ORDER }) }), env, () => Promise.resolve(null));

    const response = await askRefund(env);

    expect(response?.status).toBe(502);
    expect((await data(response)).error).toMatchObject({ code: 'PAYMENT_REFUND_FAILED', message: 'This payment method cannot return money by itself' });
    expect(s.refunds).toEqual([]);
    expect(s.order).toMatchObject({ status: 'PAID' });
  });
});
