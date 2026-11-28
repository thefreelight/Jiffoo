import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A refund the payment provider has not confirmed yet is not a failed refund (2026-11-28): a card refund begins as
// pending and is confirmed a moment later. The administrator's request is answered as "on its way", the refund is
// kept with the provider's number on it, and the timer finishes it once the provider confirms.
const gate = vi.hoisted(() => ({ requireAdminPermission: vi.fn() }));
vi.mock('./admin-access', () => gate);
vi.mock('./plugin-settings', () => ({ getNativeStripeSecret: vi.fn(async () => ({ mode: 'live', value: 'sk_fake' })) }));
vi.mock('./shipments', () => ({ attachShipments: vi.fn() }));
vi.mock('./shipping-carriers', () => ({ getCarrier: vi.fn(), matchCarrierByName: vi.fn(), trackingUrlFor: vi.fn() }));
vi.mock('./shipping', () => ({ subscribeKuaidi100Tracking: vi.fn() }));

import { completeNativeRefund, processNativePendingRefunds, tryNativeAdminWrites } from './admin-writes';

type Env = Parameters<typeof tryNativeAdminWrites>[1];
interface RefundRow { id: string; order_id: string; payment_session_id: string; idempotency_key: string; amount: number; currency: string; status: string; reason: string | null; provider_refund_id: string | null; created_at: string; completed_at: string | null }
interface ProviderRefund { id: string; status: string; metadata?: { orderId?: string } }

const ORDER_ID = 'order-1';
const KEY = 'refund-order-1-1';

/** What the payment provider says: the answer to the refund asked for, and the refund as it stands now. */
const provider = {
  postCalls: 0,
  getCalls: 0,
  created: { id: 're_1', status: 'pending' } as ProviderRefund,
  current: { id: 're_1', status: 'pending' } as ProviderRefund,
  list: [] as ProviderRefund[],
  reject: null as string | null,
  fetch: async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://api.stripe.com/v1/refunds' && init?.method === 'POST') {
      provider.postCalls += 1;
      if (provider.reject) return Response.json({ error: { message: provider.reject } }, { status: 402 });
      return Response.json(provider.created, { status: 200 });
    }
    provider.getCalls += 1;
    if (url.startsWith('https://api.stripe.com/v1/refunds?payment_intent=')) return Response.json({ data: provider.list });
    if (url.startsWith('https://api.stripe.com/v1/refunds/')) {
      return url.endsWith(`/v1/refunds/${provider.current.id}`) ? Response.json(provider.current) : new Response('', { status: 404 });
    }
    if (url.startsWith('https://api.stripe.com/v1/checkout/sessions/')) return Response.json({ payment_intent: 'pi_1' });
    throw new Error(`unexpected request ${url}`);
  },
};

/** The store as the refund path asks for it: an order paid in full, its stock, and every statement written down. */
function fakeEnv(refunds: RefundRow[] = []) {
  const order = {
    id: ORDER_ID,
    payload: { id: ORDER_ID, status: 'PROCESSING', paymentStatus: 'PAID', items: [{ id: 'item-1', productId: 'prod-1', variantId: 'var-1', quantity: 2 }] } as Record<string, unknown>,
    status: 'PROCESSING',
    payment_status: 'PAID',
    total_amount: 20,
    currency: 'USD',
    user_id: 'buyer-1',
  };
  const state = {
    order,
    refunds,
    stock: 5,
    audit: [] as Array<{ order_id: string; actor_id: string; action: string }>,
    outbox: [] as Array<{ event_type: string; aggregate_id: string; payload: Record<string, unknown> }>,
  };
  const sum = () => state.refunds.filter((row) => row.status === 'PENDING' || row.status === 'COMPLETED').reduce((total, row) => total + row.amount, 0);
  const run = (sql: string, args: unknown[]) => {
    let changes = 0;
    if (sql.startsWith('INSERT INTO native_refunds')) {
      state.refunds.push({ id: args[0] as string, order_id: args[1] as string, payment_session_id: args[2] as string, idempotency_key: args[3] as string, amount: args[4] as number, currency: args[5] as string, status: 'PENDING', reason: args[6] as string | null, created_at: args[7] as string, provider_refund_id: null, completed_at: null });
      changes = 1;
    } else if (sql.startsWith('DELETE FROM native_refunds')) {
      const before = state.refunds.length;
      state.refunds = state.refunds.filter((row) => !(row.id === args[0] && row.status === 'PENDING'));
      changes = before - state.refunds.length;
    } else if (sql.startsWith("UPDATE native_refunds SET provider_refund_id = ?1 WHERE id = ?2")) {
      changes = Number(state.refunds.some((row) => row.id === args[1] && row.status === 'PENDING'));
      for (const row of state.refunds) if (row.id === args[1] && row.status === 'PENDING') row.provider_refund_id = args[0] as string;
    } else if (sql.startsWith("UPDATE native_refunds SET status = 'COMPLETED'")) {
      changes = Number(state.refunds.some((row) => row.id === args[2] && row.status === 'PENDING'));
      for (const row of state.refunds) if (row.id === args[2] && row.status === 'PENDING') Object.assign(row, { status: 'COMPLETED', provider_refund_id: args[0], completed_at: args[1] });
    } else if (sql.startsWith('UPDATE native_order_metadata SET payment_status')) {
      order.payment_status = args[0] as string; changes = 1;
    } else if (sql.startsWith('UPDATE native_order_snapshots SET status')) {
      order.status = args[0] as string; order.payload = JSON.parse(args[1] as string); changes = 1;
    } else if (sql.startsWith('UPDATE native_inventory')) {
      state.stock += args[0] as number; changes = 1;
    } else if (sql.startsWith('INSERT INTO native_order_audit')) {
      state.audit.push({ order_id: args[1] as string, actor_id: args[2] as string, action: sql.includes("'order.refund'") ? 'order.refund' : 'order.cancel' }); changes = 1;
    } else if (sql.startsWith('INSERT INTO native_checkout_outbox')) {
      state.outbox.push({ event_type: sql.includes("'order.refunded'") ? 'order.refunded' : 'order.cancelled', aggregate_id: args[1] as string, payload: JSON.parse(args[2] as string) }); changes = 1;
    } else throw new Error(`unexpected statement ${sql}`);
    return { success: true, meta: { changes } };
  };
  const statement = (sql: string) => {
    const bound = (args: unknown[]) => ({ sql, args, run: async () => run(sql, args), first: async () => first(sql, args), all: async () => ({ results: all(sql, args) }) });
    return { sql, bind: (...args: unknown[]) => bound(args) };
  };
  const first = (sql: string, args: unknown[]) => {
    if (sql.includes('FROM native_order_snapshots snapshots JOIN')) return { payload: JSON.stringify(order.payload), status: order.status, payment_status: order.payment_status };
    if (sql.startsWith('SELECT id, status FROM native_refunds WHERE idempotency_key')) {
      const row = state.refunds.find((entry) => entry.idempotency_key === args[0]);
      return row ? { id: row.id, status: row.status } : null;
    }
    if (sql.startsWith('SELECT total_amount, currency, user_id FROM native_order_metadata')) return { total_amount: order.total_amount, currency: order.currency, user_id: order.user_id };
    if (sql.startsWith('SELECT id, payment_intent_id, provider FROM native_payment_sessions WHERE order_id')) return { id: 'cs_1', payment_intent_id: 'pi_1', provider: 'stripe' };
    if (sql.startsWith('SELECT id FROM native_payment_sessions WHERE order_id')) return { id: 'cs_1' };
    if (sql.startsWith('SELECT id, payment_intent_id, provider FROM native_payment_sessions WHERE id')) return args[0] === 'cs_1' ? { id: 'cs_1', payment_intent_id: 'pi_1', provider: 'stripe' } : null;
    if (sql.startsWith('SELECT COALESCE(SUM(amount), 0) AS amount FROM native_refunds')) return { amount: sum() };
    if (sql.startsWith('SELECT id, order_id, payment_session_id, amount, reason, provider_refund_id FROM native_refunds')) {
      return state.refunds.find((row) => row.id === args[0] && row.status === args[1]) ?? null;
    }
    throw new Error(`unexpected query ${sql}`);
  };
  const all = (sql: string, args: unknown[]) => {
    if (sql.startsWith('SELECT product_id, variant_id, quantity FROM native_order_items')) return [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2 }];
    if (sql.startsWith("SELECT id FROM native_refunds WHERE status = 'PENDING' AND created_at < ?1")) return state.refunds.filter((row) => row.status === 'PENDING' && row.created_at < (args[0] as string)).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((row) => ({ id: row.id }));
    throw new Error(`unexpected list ${sql}`);
  };
  type Bound = ReturnType<ReturnType<typeof statement>>;
  const DB = {
    prepare: statement,
    batch: async (statements: Bound[]) => {
      for (const bound of statements) {
        run(bound.sql, bound.args);
      }
      return statements.map(() => ({ success: true, meta: {} }));
    },
  };
  return { env: { DB, STRIPE_SECRET_KEY: undefined } as unknown as Env, state };
}

function ask(key = KEY, extra: Record<string, unknown> = {}) {
  return tryNativeAdminWrites(new Request(`https://api.example.com/api/v1/admin/orders/${ORDER_ID}/refund`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: key, reason: 'test order', ...extra }) }), fakeEnvInstance.env);
}
let fakeEnvInstance: ReturnType<typeof fakeEnv>;
const refundRows = () => fakeEnvInstance.state.refunds;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-28T20:00:00.000Z'));
  vi.stubGlobal('fetch', provider.fetch);
  Object.assign(provider, { postCalls: 0, getCalls: 0, created: { id: 're_1', status: 'pending' }, current: { id: 're_1', status: 'pending' }, list: [], reject: null });
  gate.requireAdminPermission.mockResolvedValue({ ok: true, admin: { id: 'admin-1' }, response: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('an administrator refunds an order', () => {
  it('is refunded at once when the provider confirms the refund as it is asked for', async () => {
    provider.created = provider.current = { id: 're_1', status: 'succeeded' };
    fakeEnvInstance = fakeEnv();
    const response = await ask();
    expect(response?.status).toBe(200);
    expect((await response?.json())?.data).toMatchObject({ status: 'REFUNDED', paymentStatus: 'REFUNDED' });
    expect(refundRows()).toMatchObject([{ status: 'COMPLETED', provider_refund_id: 're_1', amount: 20 }]);
    expect(fakeEnvInstance.state.stock).toBe(7);
    expect(fakeEnvInstance.state.audit).toMatchObject([{ actor_id: 'admin-1', action: 'order.refund' }]);
    expect(fakeEnvInstance.state.outbox).toMatchObject([{ event_type: 'order.refunded', aggregate_id: ORDER_ID, payload: { fullyRefunded: true, amount: 20, currency: 'USD', providerRefundId: 're_1', reason: 'test order', items: [{ orderItemId: 'item-1', quantity: 2 }] } }]);
  });

  it('is answered as on its way while the provider has it pending — the order is as it was, and the timer finishes it', async () => {
    fakeEnvInstance = fakeEnv();
    const response = await ask();
    expect(response?.status).toBe(202);
    expect((await response?.json())?.data).toMatchObject({ status: 'PROCESSING', paymentStatus: 'PAID', refundPending: true });
    expect(refundRows()).toMatchObject([{ status: 'PENDING', provider_refund_id: 're_1', amount: 20 }]);
    expect(fakeEnvInstance.state.outbox).toEqual([]);
    expect(fakeEnvInstance.state.stock).toBe(5);
    // the provider confirms a moment later; the refund is not asked about again within a minute of being asked for
    provider.current = { id: 're_1', status: 'succeeded' };
    expect(await processNativePendingRefunds(fakeEnvInstance.env)).toEqual({ picked: 0, completed: 0, failed: 0 });
    vi.setSystemTime(new Date('2026-11-28T20:02:00.000Z'));
    expect(await processNativePendingRefunds(fakeEnvInstance.env)).toEqual({ picked: 1, completed: 1, failed: 0 });
    expect(refundRows()).toMatchObject([{ status: 'COMPLETED', provider_refund_id: 're_1' }]);
    expect(fakeEnvInstance.state.order).toMatchObject({ status: 'REFUNDED', payment_status: 'REFUNDED' });
    expect(fakeEnvInstance.state.stock).toBe(7);
    expect(fakeEnvInstance.state.audit).toMatchObject([{ actor_id: 'system:refund-reconciliation', action: 'order.refund' }]);
    expect(fakeEnvInstance.state.outbox).toMatchObject([{ event_type: 'order.refunded', payload: { fullyRefunded: true, userId: 'buyer-1', paymentId: 'cs_1' } }]);
    // nothing is left to follow up, and a further pass writes nothing down twice
    expect(await processNativePendingRefunds(fakeEnvInstance.env)).toEqual({ picked: 0, completed: 0, failed: 0 });
    expect(fakeEnvInstance.state.outbox).toHaveLength(1);
  });

  it('asks the provider when the same refund is asked about again, and does not ask it for a second refund', async () => {
    fakeEnvInstance = fakeEnv();
    await ask();
    expect(await ask()).toEqual(expect.objectContaining({ status: 202 }));
    expect(provider.postCalls).toBe(1);
    provider.current = { id: 're_1', status: 'succeeded' };
    const response = await ask();
    expect(response?.status).toBe(200);
    expect((await response?.json())?.data).toMatchObject({ status: 'REFUNDED' });
    expect(provider.postCalls).toBe(1);
    expect(fakeEnvInstance.state.outbox).toHaveLength(1);
  });

  it('finds a refund asked for before its provider number was kept — by the order it names on the payment', async () => {
    provider.list = [{ id: 're_9', status: 'pending', metadata: { orderId: 'another-order' } }, { id: 're_10', status: 'succeeded', metadata: { orderId: ORDER_ID } }];
    fakeEnvInstance = fakeEnv([{ id: 'refund-9', order_id: ORDER_ID, payment_session_id: 'cs_1', idempotency_key: KEY, amount: 20, currency: 'USD', status: 'PENDING', reason: 'test order', provider_refund_id: null, created_at: '2026-11-27T20:10:36.000Z', completed_at: null }]);
    expect(await processNativePendingRefunds(fakeEnvInstance.env)).toEqual({ picked: 1, completed: 1, failed: 0 });
    expect(refundRows()).toMatchObject([{ status: 'COMPLETED', provider_refund_id: 're_10' }]);
    expect(fakeEnvInstance.state.outbox).toMatchObject([{ event_type: 'order.refunded', payload: { fullyRefunded: true } }]);
  });

  it('gives up a refund the provider gave up on, and the order can be refunded again', async () => {
    fakeEnvInstance = fakeEnv();
    await ask();
    provider.current = { id: 're_1', status: 'failed' };
    vi.setSystemTime(new Date('2026-11-28T20:02:00.000Z'));
    expect(await processNativePendingRefunds(fakeEnvInstance.env)).toEqual({ picked: 1, completed: 0, failed: 1 });
    expect(refundRows()).toEqual([]);
    expect(fakeEnvInstance.state.order).toMatchObject({ status: 'PROCESSING', payment_status: 'PAID' });
    expect(fakeEnvInstance.state.outbox).toEqual([]);
    provider.created = provider.current = { id: 're_2', status: 'succeeded' };
    const response = await ask('refund-order-1-2');
    expect(response?.status).toBe(200);
    expect(refundRows()).toMatchObject([{ idempotency_key: 'refund-order-1-2', status: 'COMPLETED', provider_refund_id: 're_2' }]);
  });

  it('waits on a refund the provider still has pending, and one whose payment it cannot look at', async () => {
    fakeEnvInstance = fakeEnv();
    await ask();
    vi.setSystemTime(new Date('2026-11-28T20:02:00.000Z'));
    expect(await processNativePendingRefunds(fakeEnvInstance.env)).toEqual({ picked: 1, completed: 0, failed: 0 });
    provider.current = { id: 're_other', status: 'succeeded' };
    expect(await processNativePendingRefunds(fakeEnvInstance.env)).toEqual({ picked: 1, completed: 0, failed: 0 });
    expect(refundRows()).toMatchObject([{ status: 'PENDING' }]);
    expect(fakeEnvInstance.state.outbox).toEqual([]);
  });

  it('refunds in part without restocking the stock or calling the order refunded', async () => {
    fakeEnvInstance = fakeEnv();
    const response = await ask(KEY, { amount: 5 });
    expect(response?.status).toBe(202);
    provider.current = { id: 're_1', status: 'succeeded' };
    vi.setSystemTime(new Date('2026-11-28T20:02:00.000Z'));
    expect(await processNativePendingRefunds(fakeEnvInstance.env)).toEqual({ picked: 1, completed: 1, failed: 0 });
    expect(fakeEnvInstance.state.order).toMatchObject({ status: 'PROCESSING', payment_status: 'PARTIALLY_REFUNDED' });
    expect(fakeEnvInstance.state.stock).toBe(5);
    expect(fakeEnvInstance.state.outbox).toMatchObject([{ event_type: 'order.refunded', payload: { fullyRefunded: false, amount: 5 } }]);
  });

  it('is not refunded twice when the provider and an administrator answer together', async () => {
    fakeEnvInstance = fakeEnv();
    const input = { orderId: ORDER_ID, refundId: 'refund-1', providerRefundId: 're_1', amount: 20, actorId: 'admin-1', reason: null, items: null };
    fakeEnvInstance.state.refunds.push({ id: 'refund-1', order_id: ORDER_ID, payment_session_id: 'cs_1', idempotency_key: KEY, amount: 20, currency: 'USD', status: 'PENDING', reason: null, provider_refund_id: null, created_at: '2026-11-28T20:00:00.000Z', completed_at: null });
    await Promise.all([completeNativeRefund(fakeEnvInstance.env, input), completeNativeRefund(fakeEnvInstance.env, input)]);
    expect(fakeEnvInstance.state.outbox).toHaveLength(1);
    expect(fakeEnvInstance.state.audit).toHaveLength(1);
    expect(fakeEnvInstance.state.stock).toBe(7);
  });

  it('keeps a refund out the provider refused, and one of an order with nothing left to refund', async () => {
    provider.reject = 'Charge already refunded';
    fakeEnvInstance = fakeEnv();
    const refused = await ask();
    expect(refused?.status).toBe(502);
    expect((await refused?.json())?.error).toMatchObject({ code: 'PAYMENT_REFUND_FAILED', message: 'Charge already refunded' });
    expect(refundRows()).toEqual([]);

    provider.reject = null;
    fakeEnvInstance = fakeEnv([{ id: 'refund-1', order_id: ORDER_ID, payment_session_id: 'cs_1', idempotency_key: 'refund-older', amount: 20, currency: 'USD', status: 'COMPLETED', reason: null, provider_refund_id: 're_0', created_at: '2026-11-27T20:00:00.000Z', completed_at: '2026-11-27T20:00:05.000Z' }]);
    fakeEnvInstance.state.order.payment_status = 'REFUNDED';
    fakeEnvInstance.state.order.status = 'REFUNDED';
    const again = await ask('refund-order-1-3');
    expect(again?.status).toBe(409);
    expect((await again?.json())?.error).toMatchObject({ code: 'ORDER_NOT_PAID' });
    expect(provider.postCalls).toBe(1);
  });
});
