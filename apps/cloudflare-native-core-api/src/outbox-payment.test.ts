import { describe, expect, it, vi } from 'vitest';

// What a paid order sets off (2026-11-27, found with a real payment on the official store). The order went on to
// Odoo, Odoo's login was refused, and that refusal failed the whole event — so the referrer's commission and the
// shopper's receipt waited behind it, and were given up after ten tries. Each thing a payment sets off now stands
// on its own: the commission is recorded first, a refused hand-over is written down and retried by the timer, and
// only a system whose answer the shopper's order needs to be provisioned holds the event for a retry.
const { authenticateNativeAdmin, authenticateNativeUser } = vi.hoisted(() => ({ authenticateNativeAdmin: vi.fn(), authenticateNativeUser: vi.fn() }));
vi.mock('./auth', () => ({
  authenticateNativeAdmin, authenticateNativeUser,
  getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn(),
}));
vi.mock('./webhooks', () => ({ deliverNativeWebhooks: vi.fn(async () => {}) }));
vi.mock('./mail-outbox', () => ({
  enqueueAffiliateCommissionEmail: vi.fn(async () => {}), enqueueOrganizationCommissionEmail: vi.fn(async () => {}),
  enqueueOrderPaidEmail: vi.fn(async () => {}), enqueueRefundEmail: vi.fn(async () => {}), enqueueShipmentEmail: vi.fn(async () => {}),
}));
vi.mock('./remoteradar-entitlements', () => ({ processRemoteRadarPaidOrder: vi.fn(async () => {}) }));
vi.mock('./shipments', () => ({ normalizeShipmentStatus: vi.fn(), upsertSupplierShipment: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativePluginSecret: vi.fn() }));
vi.mock('./boss-orders', () => ({ processBossPaidOrder: vi.fn(async () => ({ placed: 0 })) }));
vi.mock('./odoo', () => ({ createNativeOdooOrder: vi.fn(), readNativeOdooShipments: vi.fn(async () => []) }));
vi.mock('./affiliate', () => ({
  createNativeAffiliateCommission: vi.fn(async () => ({ partner: { commissionId: 'c-1', partnerId: 'p-1', orderId: 'ord-1', amount: 0.15, currency: 'USD' }, organization: null })),
}));

import { createNativeOdooOrder } from './odoo';
import { processBossPaidOrder } from './boss-orders';
import { createNativeAffiliateCommission } from './affiliate';
import { enqueueOrderPaidEmail } from './mail-outbox';
import { processCheckoutOutbox } from './outbox';

type Event = { id: string; event_type: string; aggregate_id: string; payload: string; attempt_count: number };

/** One Bokmoo card, paid US$0.50 with a referral code — the order of the real test. */
const CARD_ORDER = {
  id: 'ord-1', userId: 'buyer-1', totalAmount: 0.5, appliedDiscounts: [{ kind: 'affiliate', id: 'p-1', amount: 16.5 }], status: 'PAID',
  items: [{
    id: 'item-1', productId: 'odoo-product-6', variantId: 'odoo-variant-6', quantity: 1, unitPrice: 0.5, totalPrice: 0.5,
    fulfillmentStatus: 'pending', fulfillmentData: null,
    variantAttributes: { provider: 'odoo', installationId: 'inst-1', externalVariantCode: 'BOKMOO-CARD-V1' },
  }],
};
const PAID: Event = { id: 'evt-paid', event_type: 'payment.succeeded', aggregate_id: 'ord-1', payload: JSON.stringify({ orderId: 'ord-1', sessionId: 'cs_1', providerEventId: 'evt_1' }), attempt_count: 0 };

/** The database as the outbox and the hand-over ask for it: the pending event, the order, and every statement written. */
function fakeDb(events: Event[]) {
  const written: string[] = [];
  const statement = (sql: string) => ({
    sql,
    bind: (...bound: unknown[]) => statement(sql, bound),
    first: async () => {
      if (sql.includes('SELECT payload FROM native_order_snapshots')) return { payload: JSON.stringify(CARD_ORDER) };
      if (sql.includes('SELECT sync_status FROM native_external_order_links')) return null;
      if (sql.includes('SELECT currency FROM native_order_metadata')) return { currency: 'USD' };
      return null;
    },
    all: async () => ({ results: sql.includes('FROM native_checkout_outbox') ? events : [] }),
    run: async () => { written.push(sql); return { success: true, meta: { changes: 1 } }; },
  });
  return {
    written,
    prepare: (sql: string) => statement(sql, []),
    batch: async (statements: ReturnType<typeof statement>[]) => { for (const bound of statements) written.push(bound.sql); return statements; },
  };
}

describe('what a paid order sets off', () => {
  it('the referrer’s commission is recorded, then the order goes on, and the shopper’s receipt is queued', async () => {
    vi.mocked(createNativeOdooOrder).mockResolvedValue({ orderId: 7, orderName: 'S/00207', externalStatus: 'sale' });
    vi.mocked(createNativeAffiliateCommission).mockClear();
    vi.mocked(enqueueOrderPaidEmail).mockClear();
    const db = fakeDb([PAID]);
    const run = await processCheckoutOutbox({ DB: db } as never);
    expect(run).toMatchObject({ scanned: 1, delivered: 1, failed: 0 });
    expect(vi.mocked(createNativeAffiliateCommission)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createNativeAffiliateCommission).mock.calls[0]![1]).toMatchObject({ id: 'ord-1', userId: 'buyer-1', totalAmount: 0.5 });
    expect(vi.mocked(enqueueOrderPaidEmail)).toHaveBeenCalledTimes(1);
    expect(db.written.some((sql) => sql.includes("sync_status = 'SUBMITTED'"))).toBe(true);
  });

  it('a refused Odoo login is written down and retried by the timer; the commission and the receipt go on', async () => {
    vi.mocked(createNativeOdooOrder).mockRejectedValue(new Error('Odoo authentication failed'));
    vi.mocked(createNativeAffiliateCommission).mockClear();
    vi.mocked(enqueueOrderPaidEmail).mockClear();
    const db = fakeDb([PAID]);
    const run = await processCheckoutOutbox({ DB: db } as never);
    expect(run).toMatchObject({ delivered: 1, failed: 0 });
    const refused = db.written.find((sql) => sql.includes("sync_status = 'FAILED'"));
    expect(refused).toBeTruthy();
    expect(refused).toContain('attempt_count = attempt_count + 1');
    expect(vi.mocked(createNativeAffiliateCommission)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enqueueOrderPaidEmail)).toHaveBeenCalledTimes(1);
  });

  it('while the system that provisions the order is unavailable the event waits for a retry — but the commission is already recorded', async () => {
    vi.mocked(createNativeOdooOrder).mockResolvedValue({ orderId: 7, orderName: 'S/00207', externalStatus: 'sale' });
    vi.mocked(processBossPaidOrder).mockRejectedValueOnce(new Error('provisioning unavailable (test)'));
    vi.mocked(createNativeAffiliateCommission).mockClear();
    vi.mocked(enqueueOrderPaidEmail).mockClear();
    const first = await processCheckoutOutbox({ DB: fakeDb([PAID]) } as never);
    expect(first).toMatchObject({ delivered: 0, failed: 1 });
    expect(vi.mocked(createNativeAffiliateCommission)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enqueueOrderPaidEmail)).not.toHaveBeenCalled();
    // the retry, with the system back: the receipt goes out, and nothing is recorded twice
    const again = await processCheckoutOutbox({ DB: fakeDb([PAID]) } as never);
    expect(again).toMatchObject({ delivered: 1, failed: 0 });
    expect(vi.mocked(enqueueOrderPaidEmail)).toHaveBeenCalledTimes(1);
  });
});
