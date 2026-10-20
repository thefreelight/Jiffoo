import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

// Node WebCrypto lacks the Workers-only crypto.subtle.timingSafeEqual used by
// the Stripe signature verifier; only the final digest comparison is polyfilled.
type SubtleWithTimingSafeEqual = typeof crypto.subtle & { timingSafeEqual?: (left: ArrayBuffer, right: ArrayBuffer) => boolean };
const subtle = crypto.subtle as SubtleWithTimingSafeEqual;
subtle.timingSafeEqual ??= (left: ArrayBuffer, right: ArrayBuffer): boolean => {
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index]! ^ rightBytes[index]!;
  return difference === 0;
};

const { processRemoteRadarPaidOrder, getNativeStripeSecret } = vi.hoisted(() => ({
  processRemoteRadarPaidOrder: vi.fn(),
  getNativeStripeSecret: vi.fn(),
}));
vi.mock('./remoteradar-entitlements', () => ({ processRemoteRadarPaidOrder }));
vi.mock('./plugin-settings', () => ({
  getNativeStripeSecret,
  getNativePluginSecret: vi.fn(async () => null),
}));
vi.mock('./webhooks', () => ({ deliverNativeWebhooks: vi.fn(async () => undefined) }));
vi.mock('./external-orders', () => ({ submitNativeOdooOrders: vi.fn(async () => undefined) }));
vi.mock('./affiliate', () => ({ createNativeAffiliateCommission: vi.fn(async () => null) }));
vi.mock('./mail-outbox', () => ({
  enqueueOrderPaidEmail: vi.fn(async () => undefined),
  enqueueRefundEmail: vi.fn(async () => undefined),
  enqueueAffiliateCommissionEmail: vi.fn(async () => undefined),
  enqueueOrganizationCommissionEmail: vi.fn(async () => undefined),
}));

import { processCheckoutOutbox } from './outbox';
import { tryNativeCheckout } from './checkout';

const orderPayload = JSON.stringify({ id: 'order-1', items: [], status: 'PENDING' });

function recorderDb() {
  const bound: Array<{ sql: string; values: unknown[] }> = [];
  const batches: unknown[][] = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => {
        bound.push({ sql, values });
        if (sql.includes('FROM native_checkout_outbox')) {
          return { all: async () => ({ results: [] }) };
        }
        if (sql.includes('FROM native_order_snapshots WHERE id = ?1')) {
          return { first: async () => ({ payload: orderPayload }) };
        }
        if (sql.includes('FROM native_inventory_reservations')) {
          return { all: async () => ({ results: [] }) };
        }
        if (sql.includes('FROM native_payment_sessions WHERE id = ?1 AND order_id = ?2')) {
          return { first: async () => ({ id: 'cs_test_1' }) };
        }
        if (sql.includes('FROM native_payment_events')) {
          return { first: async () => null };
        }
        return { first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true, meta: { changes: 1 } }) };
      },
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({ success: true, meta: { changes: 1 } }),
    }),
    batch: async (statements: unknown[]) => { batches.push(statements); return []; },
  } as never;
  return { db, bound, batches };
}

function outboxEventRow(id: string, payload: string) {
  return { id, event_type: 'payment.succeeded', aggregate_id: 'order-1', payload, attempt_count: 0 };
}

describe('RemoteRadar paid-order grant wiring', () => {
  it('grants the RemoteRadar entitlement while processing payment.succeeded and delivers the event', async () => {
    processRemoteRadarPaidOrder.mockReset().mockResolvedValue({ applied: true, productCode: 'remoteradar-credit-pack-10' });
    const harness = recorderDb();
    const originalPrepare = (harness.db as unknown as { prepare: (sql: string) => unknown }).prepare.bind(harness.db);
    (harness.db as unknown as { prepare: (sql: string) => unknown }).prepare = (sql: string) => {
      const prepared = originalPrepare(sql);
      if (sql.includes('FROM native_checkout_outbox')) {
        return {
          bind: () => ({
            all: async () => ({
              results: [outboxEventRow('outbox-1', JSON.stringify({ orderId: 'order-1', sessionId: 'cs_1', providerEventId: 'evt_1' }))],
            }),
          }),
        };
      }
      return prepared;
    };
    const result = await processCheckoutOutbox({ DB: harness.db } as never);
    expect(result).toEqual({ scanned: 1, delivered: 1, failed: 0 });
    expect(processRemoteRadarPaidOrder).toHaveBeenCalledTimes(1);
    expect(processRemoteRadarPaidOrder).toHaveBeenCalledWith(expect.anything(), 'order-1', 'evt_1');
    expect(harness.bound.some((statement) => statement.sql.includes('SET delivered_at'))).toBe(true);
  });

  it('falls back to the outbox event id for legacy payloads without a provider event id', async () => {
    processRemoteRadarPaidOrder.mockReset().mockResolvedValue({ applied: true, productCode: 'remoteradar-pro-monthly' });
    const harness = recorderDb();
    const originalPrepare = (harness.db as unknown as { prepare: (sql: string) => unknown }).prepare.bind(harness.db);
    (harness.db as unknown as { prepare: (sql: string) => unknown }).prepare = (sql: string) => {
      const prepared = originalPrepare(sql);
      if (sql.includes('FROM native_checkout_outbox')) {
        return {
          bind: () => ({
            all: async () => ({
              results: [outboxEventRow('outbox-legacy', JSON.stringify({ orderId: 'order-1', sessionId: 'cs_1' }))],
            }),
          }),
        };
      }
      return prepared;
    };
    const result = await processCheckoutOutbox({ DB: harness.db } as never);
    expect(result).toEqual({ scanned: 1, delivered: 1, failed: 0 });
    expect(processRemoteRadarPaidOrder).toHaveBeenCalledWith(expect.anything(), 'order-1', 'outbox-legacy');
  });

  it('still delivers non-RemoteRadar paid orders without a grant failure', async () => {
    processRemoteRadarPaidOrder.mockReset().mockRejectedValue(new Error('REMOTERADAR_ORDER_NOT_ELIGIBLE'));
    const harness = recorderDb();
    const originalPrepare = (harness.db as unknown as { prepare: (sql: string) => unknown }).prepare.bind(harness.db);
    (harness.db as unknown as { prepare: (sql: string) => unknown }).prepare = (sql: string) => {
      const prepared = originalPrepare(sql);
      if (sql.includes('FROM native_checkout_outbox')) {
        return {
          bind: () => ({
            all: async () => ({
              results: [outboxEventRow('outbox-2', JSON.stringify({ orderId: 'order-1', sessionId: 'cs_1', providerEventId: 'evt_2' }))],
            }),
          }),
        };
      }
      return prepared;
    };
    const result = await processCheckoutOutbox({ DB: harness.db } as never);
    expect(result).toEqual({ scanned: 1, delivered: 1, failed: 0 });
    expect(processRemoteRadarPaidOrder).toHaveBeenCalledTimes(1);
  });

  it('retries grant failures instead of marking the event delivered', async () => {
    processRemoteRadarPaidOrder.mockReset().mockRejectedValue(new Error('REMOTERADAR_ORDER_NOT_PAID'));
    const harness = recorderDb();
    const originalPrepare = (harness.db as unknown as { prepare: (sql: string) => unknown }).prepare.bind(harness.db);
    (harness.db as unknown as { prepare: (sql: string) => unknown }).prepare = (sql: string) => {
      const prepared = originalPrepare(sql);
      if (sql.includes('FROM native_checkout_outbox')) {
        return {
          bind: () => ({
            all: async () => ({
              results: [outboxEventRow('outbox-3', JSON.stringify({ orderId: 'order-1', sessionId: 'cs_1', providerEventId: 'evt_3' }))],
            }),
          }),
        };
      }
      return prepared;
    };
    const result = await processCheckoutOutbox({ DB: harness.db } as never);
    expect(result).toEqual({ scanned: 1, delivered: 0, failed: 1 });
    expect(harness.bound.some((statement) => statement.sql.includes('last_error = ?2'))).toBe(true);
    expect(harness.bound.some((statement) => statement.sql.includes('SET delivered_at'))).toBe(false);
  });

  it('records the Stripe provider event id on the payment.succeeded outbox row', async () => {
    const raw = JSON.stringify({
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      livemode: false,
      data: { object: { id: 'cs_test_1', payment_status: 'paid', metadata: { orderId: 'order-1' } } },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode('whsec_test'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${raw}`)))]
      .map((value) => value.toString(16).padStart(2, '0')).join('');
    getNativeStripeSecret.mockReset().mockResolvedValue({ mode: 'test', value: 'whsec_test' });

    const harness = recorderDb();
    const request = new Request('https://api.example/api/v1/payments/webhook/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': `t=${timestamp},v1=${signature}` },
      body: raw,
    });
    const response = await tryNativeCheckout(request, { DB: harness.db } as never, () => Promise.resolve(null));
    expect(response?.status).toBe(200);
    const body = await response?.json() as { data?: { applied?: boolean } };
    expect(body.data?.applied).toBe(true);

    const outboxStatement = harness.bound.find((statement) => statement.sql.includes("'payment.succeeded'"));
    expect(outboxStatement).toBeTruthy();
    const payload = JSON.parse(String(outboxStatement?.values[2])) as { orderId?: string; sessionId?: string; providerEventId?: string };
    expect(payload).toEqual({ orderId: 'order-1', sessionId: 'cs_test_1', providerEventId: 'evt_checkout_1' });
  });
});
