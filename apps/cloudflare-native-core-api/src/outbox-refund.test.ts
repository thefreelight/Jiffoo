import { describe, expect, it, vi } from 'vitest';

// A buyer who is refunded in full takes the commissions of that order with them (2026-11-27). The outbox is the
// place where a refund arrives; what it sends on — mail, webhooks, the other systems — is not what is tested here.
const { authenticateNativeAdmin, authenticateNativeUser } = vi.hoisted(() => ({ authenticateNativeAdmin: vi.fn(), authenticateNativeUser: vi.fn() }));
vi.mock('./auth', () => ({
  authenticateNativeAdmin, authenticateNativeUser,
  getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn(),
}));
vi.mock('./webhooks', () => ({ deliverNativeWebhooks: vi.fn(async () => {}) }));
vi.mock('./external-orders', () => ({ submitNativeOdooOrders: vi.fn(async () => {}) }));
vi.mock('./mail-outbox', () => ({
  enqueueAffiliateCommissionEmail: vi.fn(async () => {}), enqueueOrganizationCommissionEmail: vi.fn(async () => {}),
  enqueueOrderPaidEmail: vi.fn(async () => {}), enqueueRefundEmail: vi.fn(async () => {}),
}));
vi.mock('./remoteradar-entitlements', () => ({ processRemoteRadarPaidOrder: vi.fn(async () => {}) }));
vi.mock('./boss-orders', () => ({ processBossPaidOrder: vi.fn(async () => {}) }));

import { processCheckoutOutbox } from './outbox';

type Event = { id: string; event_type: string; aggregate_id: string; payload: string; attempt_count: number };

/** The database as the outbox asks for it: the pending events, the order, and every statement it writes down. */
function fakeDb(events: Event[]) {
  const written: string[] = [];
  const statement = (sql: string) => ({
    sql,
    bind: () => statement(sql),
    first: async () => (sql.includes('SELECT payload FROM native_order_snapshots')
      ? { payload: JSON.stringify({ id: 'order-1', userId: 'buyer-1', totalAmount: 40, items: [] }) }
      : sql.includes('SELECT currency FROM native_order_metadata') ? { currency: 'USD' } : null),
    all: async () => ({ results: sql.includes('FROM native_checkout_outbox') ? events : [] }),
    run: async () => ({ success: true, meta: { changes: 1 } }),
  });
  return {
    written,
    prepare: (sql: string) => statement(sql),
    batch: async (statements: ReturnType<typeof statement>[]) => { for (const bound of statements) written.push(bound.sql); return statements; },
  };
}
const refund = (fullyRefunded: boolean): Event => ({
  id: `evt-${fullyRefunded}`, event_type: 'order.refunded', aggregate_id: 'order-1', attempt_count: 0,
  payload: JSON.stringify({ amount: 40, fullyRefunded, currency: 'USD', reason: 'test' }),
});
const REVERSED = [
  "UPDATE native_affiliate_commissions SET status = 'reversed' WHERE order_id = ?1 AND status = 'pending'",
  "UPDATE native_affiliate_org_commissions SET status = 'reversed' WHERE order_id = ?1 AND status = 'pending'",
];

describe('a refund and the commissions of the order', () => {
  it('a full refund reverses the commissions that were still waiting to be paid', async () => {
    const db = fakeDb([refund(true)]);
    const run = await processCheckoutOutbox({ DB: db } as never);
    expect(run).toMatchObject({ scanned: 1, delivered: 1, failed: 0 });
    expect(db.written.filter((sql) => REVERSED.includes(sql))).toEqual(REVERSED);
  });

  it('a partial refund leaves the commissions as they are', async () => {
    const db = fakeDb([refund(false)]);
    const run = await processCheckoutOutbox({ DB: db } as never);
    expect(run).toMatchObject({ delivered: 1, failed: 0 });
    expect(db.written.some((sql) => sql.includes("'reversed'"))).toBe(false);
  });
});
