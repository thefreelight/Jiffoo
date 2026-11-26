import { beforeEach, describe, expect, it, vi } from 'vitest';

// Organizations are opened by the store, not by the shopper alone: the shopper applies on the storefront
// and the store approves, or the store opens one with an owner of its choice. A promo (creator) code
// applies to what the store says — everything, only the picked products, or everything but them — both
// in the discount it gives and in the commission it earns.
const { authenticateNativeAdmin, authenticateNativeUser } = vi.hoisted(() => ({ authenticateNativeAdmin: vi.fn(), authenticateNativeUser: vi.fn() }));
vi.mock('./auth', () => ({
  authenticateNativeAdmin, authenticateNativeUser,
  getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn(),
}));
vi.mock('./plugin-settings', () => ({
  getNativeStripeSecret: vi.fn(), getNativePluginConfig: vi.fn(), getNativePluginSecret: vi.fn(),
}));
vi.mock('./native-wallet', () => ({ settleNativeWalletCheckout: vi.fn() }));

import { createNativeAffiliateCommission, tryNativeAffiliate } from './affiliate';
import { tryNativeCheckout } from './checkout';
import { affiliateScopeAllows, affiliateScopeMode, priceOrderDiscounts } from './order-discounts';

type Row = Record<string, unknown>;

/** An in-memory stand-in for the affiliate tables, answering by the statement it is asked. */
function fakeDb(seed: { partners?: Row[]; scope?: Row[] } = {}) {
  const state = {
    partners: (seed.partners ?? []).map((row) => ({
      created_at: '', updated_at: '', organization_id: null, member_role: null, discount_type: 'percentage', scope_mode: 'all', ...row,
    })),
    scope: [...(seed.scope ?? [])],
    users: [{ id: 'user-1', email: 'owner@example.com', username: 'owner' }, { id: 'user-2', email: 'someone@example.com', username: 'someone' }],
    orgs: [] as Row[], members: [] as Row[], applications: [] as Row[],
    commissions: [] as Row[], orgCommissions: [] as Row[], attributions: [] as Row[],
  };
  const partnerBy = (key: 'id' | 'code' | 'user_id', value: unknown) => state.partners.find((row) => row[key] === value) ?? null;
  const userBy = (key: 'id' | 'email', value: unknown) => state.users.find((user) => user[key] === value) ?? null;
  const organizationOf = (userId: unknown) => state.orgs.find((org) => org.status === 'active' && (org.owner_user_id === userId
    || state.members.some((member) => member.organization_id === org.id && member.user_id === userId && member.status === 'active'))) ?? null;
  /** `UPDATE … SET a = ?, b = ?3, c = 'x', d = CURRENT_TIMESTAMP WHERE …`, applied to the stored row. */
  const applySet = (row: Row, sql: string, values: unknown[]) => {
    const clause = sql.slice(sql.indexOf(' SET ') + 5, sql.indexOf(' WHERE '));
    let next = 0;
    for (const part of clause.split(', ')) {
      const [column, value] = part.split(' = ') as [string, string];
      row[column] = /^\?$/.test(value) ? values[next++]
        : /^\?\d+$/.test(value) ? values[Number(value.slice(1)) - 1]
          : value === 'CURRENT_TIMESTAMP' ? 'now' : value.replace(/^'|'$/g, '');
    }
  };
  const statement = (sql: string, values: unknown[]) => ({
    first: async () => {
      if (sql.includes('FROM native_plugin_instances')) return { enabled: 1 };
      if (sql.includes('SELECT id, code, discount_rate, discount_type, display_name, scope_mode FROM native_affiliate_partners')) {
        const row = partnerBy('code', values[0]);
        return row && row.status === 'active' && Number(row.discount_rate) > 0 ? row : null;
      }
      if (sql.includes('SELECT * FROM native_affiliate_partners WHERE user_id')) return partnerBy('user_id', values[0]);
      if (sql.includes('SELECT id FROM native_affiliate_partners WHERE id')) return partnerBy('id', values[0]) ? { id: values[0] } : null;
      if (sql.includes('SELECT * FROM native_affiliate_partners WHERE id')) return partnerBy('id', values[0]);
      if (sql.includes('SELECT discount_type FROM native_affiliate_partners WHERE id')) return partnerBy('id', values[0]);
      if (sql.includes('SELECT id FROM native_users WHERE id')) return userBy('id', values[0]);
      if (sql.includes('SELECT id FROM native_users WHERE email')) return userBy('email', values[0]);
      if (sql.includes('LEFT JOIN native_affiliate_org_members members') && sql.includes('ORDER BY organizations.created_at DESC LIMIT 1')) return organizationOf(values[0]);
      if (sql.includes('SELECT id FROM native_affiliate_org_applications WHERE user_id')) return state.applications.find((row) => row.user_id === values[0] && row.status === 'pending') ?? null;
      if (sql.includes('SELECT * FROM native_affiliate_org_applications WHERE user_id')) return [...state.applications].reverse().find((row) => row.user_id === values[0]) ?? null;
      if (sql.includes('SELECT * FROM native_affiliate_org_applications WHERE id')) return state.applications.find((row) => row.id === values[0]) ?? null;
      if (sql.includes('SELECT m.affiliate_partner_id AS partner_id FROM native_order_metadata')) return null;
      if (sql.includes('SELECT partner_id FROM native_affiliate_attributions')) return state.attributions.find((row) => row.user_id === values[0]) ?? null;
      if (sql.includes('SELECT id, partner_id, amount, currency FROM native_affiliate_commissions WHERE order_id')) return state.commissions.find((row) => row.order_id === values[0]) ?? null;
      if (sql.includes('SELECT partners.commission_rate, partners.currency, partners.organization_id, partners.scope_mode')) {
        const row = partnerBy('id', values[0]);
        if (!row || row.status !== 'active') return null;
        const org = state.orgs.find((candidate) => candidate.id === row.organization_id && candidate.status === 'active');
        return {
          commission_rate: row.commission_rate, currency: row.currency, organization_id: row.organization_id, scope_mode: row.scope_mode,
          owner_user_id: org?.owner_user_id ?? null, organization_rate: org?.commission_rate ?? null, organization_currency: org?.currency ?? null,
        };
      }
      if (sql.includes('SELECT id, amount, currency, beneficiary_user_id FROM native_affiliate_org_commissions')) return state.orgCommissions.find((row) => row.organization_id === values[0] && row.order_id === values[1]) ?? null;
      return null;
    },
    all: async () => {
      if (sql.includes('SELECT product_id FROM native_affiliate_partner_scope WHERE partner_id')) {
        return { results: state.scope.filter((row) => row.partner_id === values[0]).map((row) => ({ product_id: row.product_id })) };
      }
      if (sql.includes('SELECT partner_id, product_id FROM native_affiliate_partner_scope')) {
        return { results: state.scope.map((row) => ({ partner_id: row.partner_id, product_id: row.product_id })) };
      }
      if (sql.includes('FROM native_affiliate_org_members members') && sql.includes('JOIN native_users users')) {
        return {
          results: state.members.filter((row) => row.organization_id === values[0]).map((row) => {
            const user = userBy('id', row.user_id);
            const partner = partnerBy('user_id', row.user_id);
            return {
              id: row.id, userId: row.user_id, role: row.role, status: row.status, joinedAt: row.joined_at,
              username: user?.username ?? null, email: user?.email ?? null, partnerId: partner?.id ?? null, partnerCode: partner?.code ?? null,
            };
          }),
        };
      }
      if (sql.includes('SELECT p.id, p.code, p.status, p.display_name')) return { results: state.partners.map((row) => ({ ...row })) };
      if (sql.includes('SELECT c.id, p.code AS partner_code')) return { results: state.commissions.map((row) => ({ ...row })) };
      if (sql.includes('SELECT a.id, p.code AS partner_code, a.visitor_id')) return { results: [] };
      if (sql.includes('SELECT o.id, o.code, o.name, o.status')) {
        return { results: state.orgs.map((org) => ({ ...org, owner_email: userBy('id', org.owner_user_id)?.email ?? null })) };
      }
      if (sql.includes('SELECT a.id, a.organization_name')) {
        return { results: state.applications.map((row) => ({ ...row, username: userBy('id', row.user_id)?.username ?? null })) };
      }
      return { results: [] };
    },
    run: async () => {
      let changes = 1;
      if (sql.includes('INSERT INTO native_affiliate_org_applications')) {
        state.applications.push({ id: values[0], user_id: values[1], organization_name: values[2], contact_name: values[3], email: values[4], phone: values[5], website: values[6], message: values[7], status: 'pending', review_note: null, reviewed_at: null, organization_id: null, created_at: values[8], updated_at: values[8] });
      } else if (sql.includes('UPDATE native_affiliate_org_applications')) {
        const row = state.applications.find((candidate) => candidate.id === values[0]);
        if (row) applySet(row, sql, values); else changes = 0;
      } else if (sql.includes('INSERT INTO native_affiliate_organizations')) {
        state.orgs.push({ id: values[0], owner_user_id: values[1], code: values[2], name: values[3], status: 'active', commission_rate: values[4], currency: 'USD', created_at: values[5], updated_at: values[5] });
      } else if (sql.includes('INSERT INTO native_affiliate_org_members')) {
        const owner = sql.includes("'OWNER'");
        state.members.push({ id: values[0], organization_id: values[1], user_id: values[2], role: owner ? 'OWNER' : values[3], status: 'active', joined_at: owner ? values[3] : values[4] });
      } else if (sql.includes('UPDATE native_affiliate_partners SET')) {
        const row = partnerBy('id', values[values.length - 1]);
        if (row) applySet(row, sql, values); else changes = 0;
      } else if (sql.includes('DELETE FROM native_affiliate_partner_scope')) {
        state.scope = state.scope.filter((row) => row.partner_id !== values[0]);
      } else if (sql.includes('INSERT INTO native_affiliate_partner_scope')) {
        state.scope.push({ id: values[0], partner_id: values[1], product_id: values[2] });
      } else if (sql.includes('INSERT INTO native_affiliate_commissions')) {
        state.commissions.push({ id: values[0], partner_id: values[1], order_id: values[2], order_amount: values[3], commission_rate: values[4], amount: values[5], currency: values[6] });
      } else if (sql.includes('INSERT INTO native_affiliate_org_commissions')) {
        state.orgCommissions.push({ id: values[0], organization_id: values[1], partner_id: values[2], order_id: values[3], beneficiary_user_id: values[4], order_amount: values[5], amount: values[7] });
      }
      return { success: true, meta: { changes } };
    },
  });
  return {
    state,
    // a statement may be asked with or without bound values
    prepare: (sql: string) => ({ ...statement(sql, []), bind: (...values: unknown[]) => statement(sql, values) }),
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => { for (const bound of statements) await bound.run(); return statements; },
  };
}

type Db = ReturnType<typeof fakeDb>;
const envOf = (db: Db) => ({ DB: db, NATIVE_JWT_SECRET: 'test-secret' }) as never;
const request = (method: string, path: string, body?: unknown) => new Request(`https://api.bokmoo.com${path}`, {
  method, headers: { 'content-type': 'application/json', authorization: 'Bearer token' }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const call = async (db: Db, method: string, path: string, body?: unknown) => {
  const response = await tryNativeAffiliate(request(method, path, body), envOf(db));
  return response ? { status: response.status, body: await response.json() as { success: boolean; data?: Row; error?: { code: string } } } : { status: 0, body: { success: false } };
};
const PARTNER = { id: 'partner-1', user_id: 'user-2', code: 'CREATOR10', status: 'active', display_name: 'Creator', email: null, commission_rate: 10, currency: 'USD', discount_rate: 10 };
const ADMIN = '/api/v1/extensions/plugin/affiliate/api/admin';
const STORE = '/api/v1/plugins/affiliate/store';

beforeEach(() => {
  authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
  authenticateNativeUser.mockResolvedValue({ id: 'user-2', email: 'someone@example.com', username: 'someone', role: 'USER' });
});

describe('a shopper no longer opens an organization alone', () => {
  it('the old "create organization" call is refused', async () => {
    const result = await call(fakeDb(), 'POST', `${STORE}/organizations`, { name: 'Self-made' });
    expect(result.status).toBe(403);
    expect(result.body.error?.code).toBe('ORGANIZATION_APPLICATION_REQUIRED');
  });

  it('a shopper applies, and sees the application wait for the store', async () => {
    const db = fakeDb();
    const applied = await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: '  Travel Crew ', contactName: 'Sam', phone: '+86 138 0000 0000', website: 'https://travelcrew.example', message: 'We run a travel channel.' });
    expect(applied.status).toBe(201);
    expect(applied.body.data).toMatchObject({ organizationName: 'Travel Crew', contactName: 'Sam', email: 'someone@example.com', phone: '+86 138 0000 0000', website: 'https://travelcrew.example', status: 'pending', organizationId: null });

    const again = await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Another one' });
    expect(again.status).toBe(409);
    expect(again.body.error?.code).toBe('APPLICATION_PENDING');

    const mine = await call(db, 'GET', `${STORE}/organizations/applications/mine`);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toMatchObject({ id: applied.body.data?.id, status: 'pending' });
    // nothing was opened yet
    expect(db.state.orgs).toEqual([]);
    expect(db.state.members).toEqual([]);
  });

  it('an application needs a name; a contact e-mail is taken from the account when none is given', async () => {
    const db = fakeDb();
    expect((await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'X' })).body.error?.code).toBe('VALIDATION_ERROR');
    expect((await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Travel Crew', email: 'not-an-email' })).body.error?.code).toBe('VALIDATION_ERROR');
    const applied = await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Travel Crew' });
    expect(applied.body.data).toMatchObject({ email: 'someone@example.com', contactName: 'someone' });
    expect((await call(fakeDb(), 'GET', `${STORE}/organizations/applications/mine`)).body.error?.code).toBe('APPLICATION_NOT_FOUND');
  });

  it('an account that already belongs to an organization does not apply', async () => {
    const db = fakeDb();
    db.state.orgs.push({ id: 'org-1', owner_user_id: 'user-1', code: 'ORG-1', name: 'Existing', status: 'active', commission_rate: 2.5, currency: 'USD', created_at: '', updated_at: '' });
    db.state.members.push({ id: 'm-1', organization_id: 'org-1', user_id: 'user-2', role: 'INFLUENCER', status: 'active', joined_at: '' });
    const applied = await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Travel Crew' });
    expect(applied.status).toBe(409);
    expect(applied.body.error?.code).toBe('USER_ALREADY_ORGANIZED');
    expect(db.state.applications).toEqual([]);
  });
});

describe('the store opens organizations', () => {
  it('directly, with an owner found by e-mail address', async () => {
    const db = fakeDb();
    const created = await call(db, 'POST', `${ADMIN}/organizations`, { name: 'Travel Crew', ownerEmail: 'Owner@Example.com', commissionRate: 8 });
    expect(created.status).toBe(201);
    expect(created.body.data?.organization).toMatchObject({ name: 'Travel Crew', ownerUserId: 'user-1', commissionRate: 8, status: 'active', members: [{ userId: 'user-1', role: 'OWNER', status: 'active', email: 'owner@example.com' }] });
    expect(String((created.body.data?.organization as Row).code)).toMatch(/^ORG-[A-Z0-9]{8}$/);
  });

  it('not for an unknown owner, a nameless organization, or an owner already in one', async () => {
    const db = fakeDb();
    const unknown = await call(db, 'POST', `${ADMIN}/organizations`, { name: 'Crew', ownerEmail: 'nobody@example.com' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error?.code).toBe('USER_NOT_FOUND');
    expect((await call(db, 'POST', `${ADMIN}/organizations`, { name: 'C', ownerUserId: 'user-1' })).body.error?.code).toBe('VALIDATION_ERROR');
    expect((await call(db, 'POST', `${ADMIN}/organizations`, { ownerUserId: 'user-1' })).body.error?.code).toBe('VALIDATION_ERROR');
    expect((await call(db, 'POST', `${ADMIN}/organizations`, { name: 'Crew', ownerUserId: 'user-1', commissionRate: 95 })).body.error?.code).toBe('VALIDATION_ERROR');
    expect((await call(db, 'POST', `${ADMIN}/organizations`, { name: 'Crew' })).body.error?.code).toBe('VALIDATION_ERROR');
    await call(db, 'POST', `${ADMIN}/organizations`, { name: 'First', ownerUserId: 'user-1' });
    const second = await call(db, 'POST', `${ADMIN}/organizations`, { name: 'Second', ownerUserId: 'user-1' });
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe('USER_ALREADY_ORGANIZED');
    expect(db.state.orgs).toHaveLength(1);
  });

  it('by approving a shopper’s application: the shopper becomes the owner', async () => {
    const db = fakeDb();
    const applied = await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Travel Crew' });
    const approved = await call(db, 'POST', `${ADMIN}/applications/${applied.body.data?.id}/approve`, { commissionRate: 6, note: 'Welcome' });
    expect(approved.status).toBe(200);
    expect(approved.body.data?.application).toMatchObject({ status: 'approved', reviewNote: 'Welcome' });
    const organization = approved.body.data?.organization as Row;
    expect(organization).toMatchObject({ name: 'Travel Crew', ownerUserId: 'user-2', commissionRate: 6 });
    expect(organization.members).toEqual([expect.objectContaining({ userId: 'user-2', role: 'OWNER', username: 'someone', email: 'someone@example.com' })]);
    expect(db.state.applications[0]).toMatchObject({ status: 'approved', organization_id: organization.id });
    expect(db.state.members).toHaveLength(1);

    const ownerSeesIt = await call(db, 'GET', `${STORE}/organizations/me`);
    expect(ownerSeesIt.body.data).toMatchObject({ id: organization.id, name: 'Travel Crew', ownerUserId: 'user-2' });

    const reviewedAgain = await call(db, 'POST', `${ADMIN}/applications/${applied.body.data?.id}/approve`);
    expect(reviewedAgain.status).toBe(409);
    expect(reviewedAgain.body.error?.code).toBe('APPLICATION_ALREADY_REVIEWED');
    expect(db.state.orgs).toHaveLength(1);
    // approved at the default rate when none is given
    expect(db.state.orgs[0]!.commission_rate).toBe(6);
  });

  it('or by declining it, with the reason', async () => {
    const db = fakeDb();
    const applied = await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Travel Crew' });
    const rejected = await call(db, 'POST', `${ADMIN}/applications/${applied.body.data?.id}/reject`, { note: 'Not a fit yet' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data).toMatchObject({ status: 'rejected', reviewNote: 'Not a fit yet' });
    expect(db.state.orgs).toEqual([]);
    // declined, the shopper may apply again
    expect((await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Travel Crew 2' })).status).toBe(201);
    expect((await call(db, 'POST', `${ADMIN}/applications/no-such-id/approve`)).status).toBe(404);
    expect((await call(db, 'POST', `${ADMIN}/applications/no-such-id/approve`, { commissionRate: 95 })).status).toBe(404);
  });

  it('the admin overview lists applications and the pending count', async () => {
    const db = fakeDb({ partners: [PARTNER, { ...PARTNER, id: 'partner-2', code: 'OTHER20' }] });
    await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Crew A' });
    await call(db, 'POST', `${ADMIN}/applications/${db.state.applications[0]!.id}/reject`);
    await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Crew B' });
    const overview = await call(db, 'GET', `${ADMIN}/overview`);
    expect(overview.status).toBe(200);
    expect(overview.body.data?.totals).toMatchObject({ partnerCount: 2, organizationCount: 0, applicationPending: 1 });
    expect(overview.body.data?.applications).toEqual([
      expect.objectContaining({ organization_name: 'Crew A', status: 'rejected', username: 'someone' }),
      expect.objectContaining({ organization_name: 'Crew B', status: 'pending', username: 'someone' }),
    ]);
  });

  it('only for an administrator', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    expect((await call(fakeDb(), 'POST', `${ADMIN}/organizations`, { name: 'Crew', ownerUserId: 'user-1' })).status).toBe(401);
    expect((await call(fakeDb(), 'POST', `${ADMIN}/applications/app-1/approve`)).status).toBe(401);
    expect((await call(fakeDb(), 'PATCH', `${ADMIN}/partners/partner-1`, { scope: { mode: 'all' } })).status).toBe(401);
  });
});

describe('a promo code applies to the products the store picked', () => {
  const item = (productId: string, salePrice: number, quantity = 1, eligible?: boolean) => ({ productId, variantId: `v-${productId}`, salePrice, quantity, ...(eligible === undefined ? {} : { eligible }) });
  const CREATOR = { id: 'partner-1', discount_type: 'percentage', discount_rate: 10 };

  it('scope helpers', () => {
    expect(affiliateScopeMode(undefined)).toBe('all');
    expect(affiliateScopeMode('selected')).toBe('selected');
    expect(affiliateScopeMode('nonsense')).toBe('all');
    expect(affiliateScopeAllows({ mode: 'all', productIds: ['x'] }, 'y')).toBe(true);
    expect(affiliateScopeAllows({ mode: 'selected', productIds: ['x'] }, 'x')).toBe(true);
    expect(affiliateScopeAllows({ mode: 'selected', productIds: ['x'] }, 'y')).toBe(false);
    expect(affiliateScopeAllows({ mode: 'except', productIds: ['x'] }, 'x')).toBe(false);
    expect(affiliateScopeAllows({ mode: 'except', productIds: ['x'] }, 'y')).toBe(true);
  });

  it('the discount is taken off the products in reach only', () => {
    // a $40 card and a $10 plan, 10% off
    expect(priceOrderDiscounts({ items: [item('card', 40), item('plan', 10)], promotion: null, affiliate: CREATOR }).affiliateDiscount).toBe(5);
    expect(priceOrderDiscounts({ items: [item('card', 40), item('plan', 10, 1, false)], promotion: null, affiliate: CREATOR }).affiliateDiscount).toBe(4);
    expect(priceOrderDiscounts({ items: [item('card', 40, 1, false), item('plan', 10)], promotion: null, affiliate: CREATOR }).affiliateDiscount).toBe(1);
    expect(priceOrderDiscounts({ items: [item('card', 40, 2, false), item('plan', 10, 3, false)], promotion: null, affiliate: CREATOR }).affiliateDiscount).toBe(0);
    const fixed = { ...CREATOR, discount_type: 'fixed_amount', discount_rate: 100 };
    expect(priceOrderDiscounts({ items: [item('card', 40, 1, false), item('plan', 10)], promotion: null, affiliate: fixed }).affiliateDiscount).toBe(10);
  });

  it('the code still stacks on a promotion, on the promoted products it reaches', () => {
    const promotion = {
      id: 'promo', slug: 'bf', name: 'Black Friday', status: 'active', starts_at: '', ends_at: '',
      discount_type: 'percent', discount_value: 20, product_ids_json: JSON.stringify(['card']), per_user_limit: 0, banner_json: null, rules_url: null, created_at: '', updated_at: '',
    };
    // card $40 -> $32; the code takes 10% of the card, and nothing off the plan the sale leaves out
    expect(priceOrderDiscounts({ items: [item('card', 40), item('plan', 10)], promotion, affiliate: CREATOR })).toMatchObject({ promotionDiscount: 8, affiliateDiscount: 3.2 });
    // limited to the plan, the code reaches nothing the promotion covered
    expect(priceOrderDiscounts({ items: [item('card', 40, 1, false), item('plan', 10)], promotion, affiliate: CREATOR }).affiliateDiscount).toBe(0);
  });

  it('the public lookup tells the checkout which products the code reaches', async () => {
    const all = await call(fakeDb({ partners: [PARTNER] }), 'GET', `${STORE}/promo/CREATOR10`);
    expect(all.body.data).toMatchObject({ valid: true, scopeMode: 'all', scopeProductIds: [] });
    const limited = await call(fakeDb({ partners: [{ ...PARTNER, scope_mode: 'selected' }], scope: [{ partner_id: 'partner-1', product_id: 'odoo-product-6' }, { partner_id: 'partner-1', product_id: 'odoo-product-7' }] }), 'GET', `${STORE}/promo/creator10`);
    expect(limited.body.data).toMatchObject({ valid: true, scopeMode: 'selected', scopeProductIds: ['odoo-product-6', 'odoo-product-7'] });
    expect((await call(fakeDb(), 'GET', `${STORE}/promo/NOPE000000`)).body.data).toEqual({ valid: false });
  });

  it('the store sets and replaces the scope from the admin', async () => {
    const db = fakeDb({ partners: [PARTNER] });
    const set = await call(db, 'PATCH', `${ADMIN}/partners/partner-1`, { scope: { mode: 'selected', productIds: ['odoo-product-6', 'odoo-product-7', 'odoo-product-6', ' bad id '] } });
    expect(set.status).toBe(200);
    expect(set.body.data?.partner).toMatchObject({ scopeMode: 'selected', scopeProductIds: ['odoo-product-6', 'odoo-product-7'] });
    expect(db.state.partners[0]!.scope_mode).toBe('selected');

    const except = await call(db, 'PATCH', `${ADMIN}/partners/partner-1`, { scope: { mode: 'except', productIds: ['boss-JP-1GB-7D'] }, commissionRate: 12 });
    expect(except.body.data?.partner).toMatchObject({ scopeMode: 'except', scopeProductIds: ['boss-JP-1GB-7D'], commissionRate: 12 });
    expect(db.state.scope).toEqual([{ id: expect.any(String), partner_id: 'partner-1', product_id: 'boss-JP-1GB-7D' }]);

    const everything = await call(db, 'PATCH', `${ADMIN}/partners/partner-1`, { scope: { mode: 'all' } });
    expect(everything.body.data?.partner).toMatchObject({ scopeMode: 'all', scopeProductIds: [] });
    expect(db.state.scope).toEqual([]);

    expect((await call(db, 'PATCH', `${ADMIN}/partners/partner-1`, { scope: { mode: 'selected', productIds: [] } })).body.error?.code).toBe('VALIDATION_ERROR');
    expect((await call(db, 'PATCH', `${ADMIN}/partners/partner-1`, { scope: { mode: 'selected', productIds: ['x'.repeat(65)] } })).body.error?.code).toBe('VALIDATION_ERROR');
    expect((await call(db, 'PATCH', `${ADMIN}/partners/no-partner`, { scope: { mode: 'all' } })).status).toBe(404);
    // the partner's own page shows what the code reaches
    expect((await call(db, 'PATCH', `${ADMIN}/partners/partner-1`, { scope: { mode: 'selected', productIds: ['odoo-product-6'] } })).status).toBe(200);
    const mine = await call(db, 'GET', `${STORE}/partners/me`);
    expect(mine.body.data).toMatchObject({ code: 'CREATOR10', scopeMode: 'selected', scopeProductIds: ['odoo-product-6'] });
  });

  it('the overview carries each code’s products', async () => {
    const overview = await call(fakeDb({ partners: [{ ...PARTNER, scope_mode: 'except' }], scope: [{ partner_id: 'partner-1', product_id: 'x' }] }), 'GET', `${ADMIN}/overview`);
    expect(overview.body.data?.partners).toEqual([expect.objectContaining({ code: 'CREATOR10', scope_mode: 'except', scope_product_ids: ['x'] })]);
    expect(overview.body.data?.organizations).toEqual([]);
  });
});

describe('a limited code earns on the products it reaches', () => {
  const order = {
    id: 'order-1', userId: 'user-2', totalAmount: 45, discountAmount: 5, appliedDiscounts: [{ kind: 'affiliate', id: 'partner-1', amount: 5 }],
    items: [{ productId: 'card', unitPrice: 40, quantity: 1 }, { productId: 'plan', unitPrice: 10, quantity: 1 }],
  };
  const attributed = (partners: Row[], scope: Row[] = []) => {
    const db = fakeDb({ partners, scope });
    db.state.attributions.push({ user_id: 'user-2', partner_id: 'partner-1', status: 'associated' });
    return db;
  };

  it('on the whole order when the code applies to everything', async () => {
    const db = attributed([PARTNER]);
    const result = await createNativeAffiliateCommission(envOf(db), order);
    expect(result?.partner).toMatchObject({ amount: 4.5 });
    expect(db.state.commissions[0]).toMatchObject({ order_amount: 45, amount: 4.5, commission_rate: 10 });
  });

  it('on its products only, less the discount it gave', async () => {
    const db = attributed([{ ...PARTNER, scope_mode: 'selected' }], [{ partner_id: 'partner-1', product_id: 'card' }]);
    const result = await createNativeAffiliateCommission(envOf(db), order);
    // the $40 card, less the $5 the code took off it
    expect(result?.partner).toMatchObject({ amount: 3.5 });
    expect(db.state.commissions[0]).toMatchObject({ order_amount: 35, amount: 3.5 });
  });

  it('nothing when nothing in the order is in its reach', async () => {
    const db = attributed([{ ...PARTNER, scope_mode: 'except' }], [{ partner_id: 'partner-1', product_id: 'card' }, { partner_id: 'partner-1', product_id: 'plan' }]);
    expect(await createNativeAffiliateCommission(envOf(db), order)).toBeNull();
    expect(db.state.commissions).toEqual([]);
  });

  it('the organization’s share follows the same base', async () => {
    const db = attributed([{ ...PARTNER, scope_mode: 'selected', organization_id: 'org-1' }], [{ partner_id: 'partner-1', product_id: 'card' }]);
    db.state.orgs.push({ id: 'org-1', owner_user_id: 'user-1', code: 'ORG-1', name: 'Crew', status: 'active', commission_rate: 2, currency: 'USD', created_at: '', updated_at: '' });
    const result = await createNativeAffiliateCommission(envOf(db), order);
    expect(result?.organization).toMatchObject({ amount: 0.7, beneficiaryUserId: 'user-1' });
  });
});

describe('the checkout prices a code on the products it reaches', () => {
  // Two cards with variant ids that differ from their product ids, as on every real product.
  const CARD = { id: 'odoo-product-6', name: 'Bokmoo Card V1', productKind: 'goods', currency: 'USD', stock: 94, variants: [{ id: 'odoo-variant-6', salePrice: 20, isActive: true }] };
  const BLUETOOTH = { id: 'odoo-product-7', name: 'Bokmoo Bluetooth Card', productKind: 'goods', currency: 'USD', stock: 94, variants: [{ id: 'odoo-variant-7', salePrice: 40, isActive: true }] };
  const CREATOR = { id: 'partner-1', code: 'CREATOR10', discount_rate: 10, discount_type: 'percentage' };

  function checkoutDb({ partner = null as Row | null, scope = [] as string[] } = {}) {
    const metadataInserts: unknown[][] = [];
    return {
      metadataInserts,
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => {
          if (sql.includes('INSERT INTO native_order_metadata')) metadataInserts.push(values);
          return {
            first: async () => {
              if (sql.includes('FROM native_affiliate_partners')) return values[0] === partner?.code ? partner : null;
              if (sql.includes('native_order_number_sequences')) return { seq: 1 };
              return null;
            },
            all: async () => ({ results: sql.includes('FROM native_affiliate_partner_scope') ? scope.map((product_id) => ({ product_id })) : [] }),
            run: async () => ({ success: true }),
          };
        },
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
      batch: async (statements: unknown[]) => statements,
    };
  }

  async function place(db: ReturnType<typeof checkoutDb>, affiliateCode?: string) {
    const response = await tryNativeCheckout(
      new Request('https://api.example/api/v1/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: CARD.id, variantId: 'odoo-variant-6', quantity: 1 }, { productId: BLUETOOTH.id, variantId: 'odoo-variant-7', quantity: 1 }],
          shippingAddress: { firstName: 'Sale', lastName: 'Test', phone: '+10000000000', addressLine1: '1 Test Way', city: 'Testville', state: 'CA', postalCode: '90000', country: 'US' },
          ...(affiliateCode ? { affiliateCode } : {}),
        }),
      }),
      { DB: db as never, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
      (id: string) => Promise.resolve(id === BLUETOOTH.id ? BLUETOOTH : CARD),
    );
    const order = (await (response as Response).json()).data as { items: Array<{ unitPrice: number }>; appliedDiscounts: unknown[]; totalAmount: number };
    return { status: response?.status, order };
  }

  it('takes the code off the picked product only', async () => {
    const db = checkoutDb({ partner: { ...CREATOR, scope_mode: 'selected' }, scope: [BLUETOOTH.id] });
    const { status, order } = await place(db, 'CREATOR10');
    expect(status).toBe(201);
    // $20 card at list price, $40 card less 10%
    expect(order.items.map((item) => item.unitPrice)).toEqual([20, 40]);
    expect(order.appliedDiscounts).toEqual([{ kind: 'affiliate', id: 'partner-1', amount: 4 }]);
    expect(order.totalAmount).toBe(56);
    expect(db.metadataInserts[0]!.slice(5)).toEqual(['partner-1', null]);
  });

  it('takes it off everything but the excluded product', async () => {
    const db = checkoutDb({ partner: { ...CREATOR, scope_mode: 'except' }, scope: [BLUETOOTH.id] });
    const { order } = await place(db, 'CREATOR10');
    expect(order.appliedDiscounts).toEqual([{ kind: 'affiliate', id: 'partner-1', amount: 2 }]);
    expect(order.totalAmount).toBe(58);
  });

  it('gives nothing, and earns nothing, when the cart holds none of its products', async () => {
    const db = checkoutDb({ partner: { ...CREATOR, scope_mode: 'selected' }, scope: ['boss-JP-1GB-7D'] });
    const { order } = await place(db, 'CREATOR10');
    expect(order.totalAmount).toBe(60);
    expect(order.appliedDiscounts).toEqual([]);
    expect(db.metadataInserts[0]!.slice(5)).toEqual([null, null]);
  });

  it('still takes it off the whole cart when nothing was picked against it', async () => {
    const db = checkoutDb({ partner: { ...CREATOR, scope_mode: 'all' } });
    const { order } = await place(db, 'CREATOR10');
    expect(order.totalAmount).toBe(54);
    expect(db.metadataInserts[0]!.slice(5)).toEqual(['partner-1', null]);
  });
});
