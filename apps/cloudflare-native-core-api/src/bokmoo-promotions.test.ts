import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { authenticateNativeAdmin } = vi.hoisted(() => ({ authenticateNativeAdmin: vi.fn() }));
vi.mock('./auth', () => ({
  authenticateNativeAdmin,
  authenticateNativeUser: vi.fn(),
  getNativeJwtSecret: vi.fn(),
  createNativeSession: vi.fn(),
  tryNativeAuth: vi.fn(),
}));

import { promotionPayload, resolveActivePromotion, tryNativeBokmooPromotions } from './bokmoo-promotions';

const validPromotion = {
  slug: 'black-friday-2026',
  name: 'Black Friday',
  startsAt: '2026-11-25T00:00:00.000Z',
  endsAt: '2026-12-01T23:59:59.000Z',
  discountType: 'percent',
  discountValue: 20,
  banner: { en: { title: 'Black Friday', body: '20% off' }, 'zh-Hans': { title: '黑五', body: '8 折' } },
};

function adminDb(rows: Record<string, unknown>[] = []) {
  const table = rows.map((row) => ({ ...row }));
  return {
    table,
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async () => {
          if (sql.includes('WHERE id = ?1')) return table.find((row) => row.id === values[0]) ?? null;
          if (sql.includes('COUNT(*) AS n FROM native_order_metadata')) {
            return { n: table.filter((row) => row.user_id === values[0] && row.promotion_id === values[1]).length };
          }
          return null;
        },
        all: async () => ({ results: [...table] }),
        run: async () => {
          if (sql.startsWith('INSERT INTO native_promotions')) {
            const [id, slug, name, startsAt, endsAt, discountType, discountValue, productIds, perUserLimit, banner, rulesUrl, now] = values;
            table.push({
              id, slug, name, status: 'draft', starts_at: startsAt, ends_at: endsAt,
              discount_type: discountType, discount_value: discountValue,
              product_ids_json: productIds, per_user_limit: perUserLimit,
              banner_json: banner, rules_url: rulesUrl, created_at: now, updated_at: now,
            });
          }
          if (sql.startsWith('UPDATE native_promotions')) {
            const row = table.find((entry) => entry.id === values[4]);
            if (row) Object.assign(row, { status: values[0], starts_at: values[1], ends_at: values[2], updated_at: values[3] });
          }
          return { success: true };
        },
      }),
      all: async () => ({ results: [...table] }),
      first: async () => null,
      run: async () => ({ success: true }),
    }),
  };
}

function env(db: ReturnType<typeof adminDb>) {
  return { DB: db } as never;
}

function request(method: string, path: string, body?: unknown): Request {
  return new Request(`https://api.bokmoo.com${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer admin' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('promotionPayload', () => {
  it('accepts the Black Friday shape and rejects bad slugs, windows and discounts', () => {
    expect(promotionPayload(validPromotion)?.slug).toBe('black-friday-2026');
    expect(promotionPayload({ ...validPromotion, slug: 'Bad Slug' })).toBeNull();
    expect(promotionPayload({ ...validPromotion, endsAt: '2026-11-20T00:00:00.000Z' })).toBeNull();
    expect(promotionPayload({ ...validPromotion, discountType: 'percent', discountValue: 120 })).toBeNull();
    expect(promotionPayload({ ...validPromotion, discountType: 'coupon' })).toBeNull();
  });
});

describe('admin promotions routes', () => {
  it('creates, lists and updates a promotion', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
    const db = adminDb();
    const created = await tryNativeBokmooPromotions(request('POST', '/api/v1/admin/promotions', validPromotion), env(db));
    expect(created.status).toBe(201);
    expect(db.table).toHaveLength(1);
    expect(db.table[0]!.status).toBe('draft');

    const listed = await tryNativeBokmooPromotions(request('GET', '/api/v1/admin/promotions'), env(db));
    const listedPayload = await listed.json();
    expect(listedPayload.data.items).toHaveLength(1);

    const updated = await tryNativeBokmooPromotions(
      request('PATCH', `/api/v1/admin/promotions/${db.table[0]!.id}`, { status: 'active' }),
      env(db),
    );
    const updatedPayload = await updated.json();
    expect(updatedPayload.data.status).toBe('active');
    // publicPromotion returns the locale-picked banner (PATCH path uses 'en')
    expect(updatedPayload.data.banner.title).toBe('Black Friday');
  });

  it('rejects anonymous admin access and invalid payloads', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    expect((await tryNativeBokmooPromotions(request('POST', '/api/v1/admin/promotions', validPromotion), env(adminDb()))).status).toBe(401);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
    expect((await tryNativeBokmooPromotions(request('POST', '/api/v1/admin/promotions', { name: 'x' }), env(adminDb()))).status).toBe(400);
  });


  it('answers CORS preflight for allowed storefront origins only', async () => {
    const preflight = (origin?: string) => new Request('https://api.bokmoo.com/api/v1/promotions/active', {
      method: 'OPTIONS',
      headers: { 'origin': origin ?? '', 'access-control-request-method': 'GET' },
    });
    const allowed = await tryNativeBokmooPromotions(preflight('https://bokmoo.com'), env(adminDb()));
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://bokmoo.com');
    const denied = await tryNativeBokmooPromotions(preflight('https://evil.example'), env(adminDb()));
    expect(denied.status).toBe(403);
  });

  it('marks active-list responses with the storefront CORS origin', async () => {
    const db = adminDb([{
      id: 'p1', slug: 'bf', name: 'BF', status: 'active',
      starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T00:00:00.000Z',
      discount_type: 'percent', discount_value: 20, product_ids_json: null,
      per_user_limit: 0, banner_json: null, rules_url: null, created_at: '', updated_at: '',
    }]);
    const response = await tryNativeBokmooPromotions(
      new Request('https://api.bokmoo.com/api/v1/promotions/active', {
        headers: { origin: 'https://www.bokmoo.com' },
      }), env(db),
    );
    expect(response.headers.get('access-control-allow-origin')).toBe('https://www.bokmoo.com');
  });

  it('serves the active public list with locale-picked banner', async () => {
    const db = adminDb([{
      id: 'p1', slug: 'black-friday-2026', name: 'Black Friday', status: 'active',
      starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T00:00:00.000Z',
      discount_type: 'percent', discount_value: 20, product_ids_json: null,
      per_user_limit: 0,
      banner_json: JSON.stringify({ en: { title: 'BF', body: '20% off' }, 'zh-Hans': { title: '黑五', body: '8 折' } }),
      rules_url: null, created_at: '', updated_at: '',
    }]);
    const response = await tryNativeBokmooPromotions(
      request('GET', '/api/v1/promotions/active?locale=zh-Hans'), env(db),
    );
    const payload = await response.json();
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0].banner.title).toBe('黑五');
    expect(payload.data.items[0].activeNow).toBe(true);
  });
});

describe('resolveActivePromotion', () => {
  const row = {
    id: 'p1', slug: 'bf', name: 'BF', status: 'active',
    starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T00:00:00.000Z',
    discount_type: 'percent', discount_value: 20, product_ids_json: JSON.stringify(['prod-1']),
    per_user_limit: 1, banner_json: null, rules_url: null, created_at: '', updated_at: '',
  };

  it('picks the covered product discount and skips a spent per-user limit', async () => {
    const db = adminDb([row]);
    const resolved = await resolveActivePromotion(
      env(db), ['prod-1', 'prod-2'],
      new Map([['prod-1', 2]]), new Map([['prod-1', 20]]),
      'user-1',
    );
    expect(resolved?.discountAmount).toBe(8);

    const spent = adminDb([{ ...row, user_id: 'user-1', promotion_id: 'p1' }]);
    const none = await resolveActivePromotion(
      env(spent), ['prod-1'], new Map([['prod-1', 2]]), new Map([['prod-1', 20]]), 'user-1',
    );
    expect(none).toBeNull();
  });
});
