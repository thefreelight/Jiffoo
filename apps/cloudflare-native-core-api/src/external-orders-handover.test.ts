import { describe, expect, it, vi } from 'vitest';

// Handing a paid order over to Odoo (2026-11-27): its login was refused on the official store, and the refusal
// failed the whole payment event. A hand-over that does not go through is now written on the link and retried by
// the timer; it is never thrown out of here.
vi.mock('./mail-outbox', () => ({ enqueueShipmentEmail: vi.fn(async () => {}) }));
vi.mock('./shipments', () => ({ normalizeShipmentStatus: vi.fn(), upsertSupplierShipment: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativePluginSecret: vi.fn() }));
vi.mock('./odoo', () => ({ createNativeOdooOrder: vi.fn(), readNativeOdooShipments: vi.fn(async () => []) }));

import { createNativeOdooOrder } from './odoo';
import { processNativeExternalOrderRetries, submitNativeOdooOrders } from './external-orders';

const item = (attributes: Record<string, unknown>) => ({
  id: 'item-1', productId: 'odoo-product-6', variantId: 'odoo-variant-6', quantity: 1, unitPrice: 0.5, totalPrice: 0.5,
  fulfillmentStatus: 'pending', fulfillmentData: null, variantAttributes: attributes,
});
const ORDER = { id: 'ord-1', userId: 'buyer-1', totalAmount: 0.5, items: [item({ provider: 'odoo', installationId: 'inst-1', externalVariantCode: 'BOKMOO-CARD-V1' })] };

/** The statements the hand-over writes, answered by what they ask for. */
function fakeDb(order: Record<string, unknown>, options: { link?: { sync_status: string } | null; failed?: Array<{ order_id: string }> } = {}) {
  const written: string[] = [];
  const asked: string[] = [];
  const statement = (sql: string) => ({
    sql,
    bind: () => statement(sql),
    first: async () => {
      if (sql.includes('SELECT payload FROM native_order_snapshots')) return { payload: JSON.stringify(order) };
      if (sql.includes('SELECT sync_status FROM native_external_order_links')) return options.link === undefined ? null : options.link;
      return null;
    },
    all: async () => { asked.push(sql); return { results: sql.includes('SELECT order_id FROM native_external_order_links') ? (options.failed ?? []) : [] }; },
    run: async () => { written.push(sql); return { success: true, meta: { changes: 1 } }; },
  });
  return { written, asked, prepare: (sql: string) => statement(sql) };
}

describe('handing a paid order over to Odoo', () => {
  it('a refused login is written on the link and is the end of it', async () => {
    vi.mocked(createNativeOdooOrder).mockRejectedValue(new Error('Odoo authentication failed'));
    const db = fakeDb(ORDER);
    await expect(submitNativeOdooOrders({ DB: db } as never, 'ord-1')).resolves.toBeUndefined();
    expect(db.written.some((sql) => sql.includes('INSERT INTO native_external_order_links') && sql.includes("'PENDING'"))).toBe(true);
    const refused = db.written.find((sql) => sql.includes("sync_status = 'FAILED'"));
    expect(refused).toBeTruthy();
    expect(refused).toContain('last_error = ?1');
    expect(refused).toContain('attempt_count = attempt_count + 1');
  });

  it('the timer hands the order over again, and records it when Odoo takes it', async () => {
    vi.mocked(createNativeOdooOrder).mockResolvedValue({ orderId: 7, orderName: 'S/00207', externalStatus: 'sale' });
    const db = fakeDb(ORDER, { link: { sync_status: 'FAILED' }, failed: [{ order_id: 'ord-1' }] });
    const result = await processNativeExternalOrderRetries({ DB: db } as never);
    expect(result).toEqual({ picked: 1, handedOver: 1 });
    expect(db.asked.some((sql) => /provider = 'odoo' AND sync_status = 'FAILED' AND attempt_count < 12 AND last_synced_at < \?1/.test(sql))).toBe(true);
    expect(db.written.some((sql) => sql.includes("sync_status = 'SUBMITTED'"))).toBe(true);
  });

  it('an order Odoo already took is not handed over again', async () => {
    vi.mocked(createNativeOdooOrder).mockClear();
    const db = fakeDb(ORDER, { link: { sync_status: 'SUBMITTED' } });
    await submitNativeOdooOrders({ DB: db } as never, 'ord-1');
    expect(vi.mocked(createNativeOdooOrder)).not.toHaveBeenCalled();
    expect(db.written.some((sql) => sql.includes('INSERT INTO native_external_order_links'))).toBe(false);
  });

  it('an item the catalog gave no Odoo identity is skipped, and is not a reason to stop', async () => {
    vi.mocked(createNativeOdooOrder).mockClear();
    const db = fakeDb({ ...ORDER, items: [item({ provider: 'odoo' })] });
    await expect(submitNativeOdooOrders({ DB: db } as never, 'ord-1')).resolves.toBeUndefined();
    expect(vi.mocked(createNativeOdooOrder)).not.toHaveBeenCalled();
    expect(db.written.some((sql) => sql.includes('INSERT INTO native_external_order_links'))).toBe(false);
  });
});
