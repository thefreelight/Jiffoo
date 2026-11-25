import { beforeEach, describe, expect, it, vi } from 'vitest';

// Buyer discount of an affiliate (creator) promo code: a percentage that
// stacks on a running promotion, or a fixed amount off the order.
const { authenticateNativeAdmin } = vi.hoisted(() => ({ authenticateNativeAdmin: vi.fn() }));
vi.mock('./auth', () => ({
  authenticateNativeAdmin,
  authenticateNativeUser: vi.fn(),
  getNativeJwtSecret: vi.fn(),
  createNativeSession: vi.fn(),
  tryNativeAuth: vi.fn(),
}));

import { tryNativeAffiliate } from './affiliate';

function adminDb(initial: Record<string, unknown>) {
  const row = { ...initial };
  const updates: Array<{ sql: string; values: unknown[] }> = [];
  return {
    row,
    updates,
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async () => {
          if (sql.includes('FROM native_plugin_instances')) return { enabled: 1 };
          if (sql.includes('SELECT discount_type FROM native_affiliate_partners')) return row ? { discount_type: row.discount_type } : null;
          if (sql.includes('FROM native_affiliate_partners') && sql.includes('WHERE code = ?1')) {
            return values[0] === row?.code ? row : null;
          }
          if (sql.includes('SELECT * FROM native_affiliate_partners WHERE id = ?1')) return row;
          return null;
        },
        run: async () => {
          updates.push({ sql, values });
          return { success: true, meta: { changes: row ? 1 : 0 } };
        },
      }),
      first: async () => null,
      run: async () => ({ success: true, meta: { changes: 0 } }),
      all: async () => ({ results: [] }),
    }),
  };
}

const partner = {
  id: 'partner-1', user_id: 'user-1', code: 'CREATOR10', status: 'active', display_name: 'Creator', email: null,
  commission_rate: 10, currency: 'USD', discount_rate: 10, discount_type: 'percentage', created_at: '', updated_at: '',
};

const request = (method: string, path: string, body?: unknown) => new Request(`https://api.bokmoo.com${path}`, {
  method,
  headers: { 'content-type': 'application/json', authorization: 'Bearer admin' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

beforeEach(() => {
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
});

describe('affiliate partner buyer discount', () => {
  it('switches a code to a fixed amount', async () => {
    const db = adminDb(partner);
    const response = await tryNativeAffiliate(
      request('PATCH', '/api/v1/extensions/plugin/affiliate/api/admin/partners/partner-1', { discountType: 'fixed_amount', discountRate: 5 }),
      { DB: db as never } as never,
    );
    expect(response?.status).toBe(200);
    const update = db.updates.find((entry) => entry.sql.startsWith('UPDATE native_affiliate_partners'));
    expect(update?.sql).toContain('discount_type = ?');
    // rate first, then the type, matching the SET clause order
    expect(update?.values.slice(0, 2)).toEqual([5, 'fixed_amount']);
  });

  it('keeps the current type when only a value is sent', async () => {
    const db = adminDb({ ...partner, discount_type: 'fixed_amount', discount_rate: 5 });
    const response = await tryNativeAffiliate(
      request('PATCH', '/api/v1/extensions/plugin/affiliate/api/admin/partners/partner-1', { discountRate: 8 }),
      { DB: db as never } as never,
    );
    expect(response?.status).toBe(200);
    const update = db.updates.find((entry) => entry.sql.startsWith('UPDATE native_affiliate_partners'));
    expect(update?.values.slice(0, 2)).toEqual([8, 'fixed_amount']);
  });

  it('refuses to reinterpret a value under a new type', async () => {
    const db = adminDb(partner);
    const response = await tryNativeAffiliate(
      request('PATCH', '/api/v1/extensions/plugin/affiliate/api/admin/partners/partner-1', { discountType: 'fixed_amount' }),
      { DB: db as never } as never,
    );
    expect(response?.status).toBe(400);
    expect(db.updates).toHaveLength(0);
  });

  it.each([
    [{ discountType: 'percentage', discountRate: 120 }],
    [{ discountType: 'fixed_amount', discountRate: 5000 }],
    [{ discountType: 'percentage', discountRate: -1 }],
    [{ discountType: 'bogo', discountRate: 5 }],
  ])('rejects an out-of-range value or unknown type (%j)', async (body) => {
    const response = await tryNativeAffiliate(
      request('PATCH', '/api/v1/extensions/plugin/affiliate/api/admin/partners/partner-1', body),
      { DB: adminDb(partner) as never } as never,
    );
    expect(response?.status).toBe(400);
  });

  it('tells the checkout what a code is worth before the buyer pays', async () => {
    const fixed = adminDb({ ...partner, code: 'CREATOR5', discount_rate: 5, discount_type: 'fixed_amount' });
    const fixedPayload = await (await tryNativeAffiliate(
      request('GET', '/api/v1/plugins/affiliate/store/promo/creator5'), { DB: fixed as never } as never,
    ))?.json();
    expect(fixedPayload.data).toEqual({
      valid: true, code: 'CREATOR5', partnerName: 'Creator',
      discountType: 'fixed_amount', discountValue: 5, discountRate: 0,
    });

    const percent = adminDb(partner);
    const percentPayload = await (await tryNativeAffiliate(
      request('GET', '/api/v1/plugins/affiliate/store/promo/CREATOR10'), { DB: percent as never } as never,
    ))?.json();
    expect(percentPayload.data).toMatchObject({ valid: true, discountType: 'percentage', discountValue: 10, discountRate: 10 });

    const unknown = await (await tryNativeAffiliate(
      request('GET', '/api/v1/plugins/affiliate/store/promo/NOPE'), { DB: percent as never } as never,
    ))?.json();
    expect(unknown.data).toEqual({ valid: false });
  });
});
