import { beforeEach, describe, expect, it, vi } from 'vitest';

// The owner's direction (2026-11-27): "用户注册默认就要给他开通" — every storefront account is a partner by
// default — and "这个大V自己有一个比例，然后他又是机构身份，他链接注册的用户，成交以后，默认还给他返5%":
// an account that registers through the link of a partner who belongs to an organization joins it, and the
// organization's share of its members' sales is 5% unless the store sets another.
const { authenticateNativeAdmin, authenticateNativeUser } = vi.hoisted(() => ({ authenticateNativeAdmin: vi.fn(), authenticateNativeUser: vi.fn() }));
vi.mock('./auth', () => ({
  authenticateNativeAdmin, authenticateNativeUser,
  getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn(),
}));

import { createNativeAffiliateCommission, tryNativeAffiliate } from './affiliate';
import { DEFAULT_ORGANIZATION_COMMISSION, DEFAULT_PARTNER_COMMISSION, openNativeAffiliatePartner } from './affiliate-open';

type Row = Record<string, unknown>;
const ACCOUNTS = {
  'user-1': { id: 'user-1', email: 'owner@example.com', username: 'owner', role: 'USER' },
  'user-2': { id: 'user-2', email: 'sam@example.com', username: 'sam', role: 'USER' },
  'user-3': { id: 'user-3', email: 'kim@example.com', username: 'kim', role: 'USER' },
  // a shopper who checks out without an account: a session of their own, and no partner account
  'guest-1': { id: 'guest-1', email: '0f1e2d3c@guest.bokmoo.invalid', username: 'guest_0f1e2d3c', role: 'GUEST' },
};

/** An in-memory stand-in for the affiliate tables, answering by the statement it is asked. */
function fakeDb() {
  const state = { partners: [] as Row[], scope: [] as Row[], orgs: [] as Row[], members: [] as Row[], applications: [] as Row[], attributions: [] as Row[], commissions: [] as Row[], orgCommissions: [] as Row[] };
  const partnerBy = (key: string, value: unknown) => state.partners.find((row) => row[key] === value) ?? null;
  const orgOf = (id: unknown) => state.orgs.find((org) => org.id === id && org.status === 'active') ?? null;
  const statement = (sql: string, values: unknown[]) => ({
    first: async () => {
      if (sql.includes('FROM native_plugin_instances')) return { enabled: 1 };
      if (sql.includes('SELECT id FROM native_affiliate_partners WHERE user_id')) return partnerBy('user_id', values[0]) ? { id: partnerBy('user_id', values[0])!.id } : null;
      if (sql.includes('SELECT * FROM native_affiliate_partners WHERE user_id')) return partnerBy('user_id', values[0]);
      if (sql.includes('SELECT user_id FROM native_affiliate_partners WHERE id')) { const row = partnerBy('id', values[0]); return row ? { user_id: row.user_id } : null; }
      if (sql.includes('SELECT user_id FROM native_affiliate_org_applications WHERE id')) { const row = state.applications.find((entry) => entry.id === values[0]) ?? null; return row ? { user_id: row.user_id } : null; }
      if (sql.includes('SELECT organization_id FROM native_affiliate_partners WHERE id')) return partnerBy('id', values[0]);
      if (sql.includes('SELECT organization_id, user_id FROM native_affiliate_partners WHERE id')) return partnerBy('id', values[0]);
      // the organization an account is in, as owner or as an active member
      if (sql.includes('LEFT JOIN native_affiliate_org_members members') && sql.includes('ORDER BY organizations.created_at DESC LIMIT 1')) {
        return state.orgs.find((org) => org.status === 'active' && (org.owner_user_id === values[0]
          || state.members.some((member) => member.organization_id === org.id && member.user_id === values[0] && member.status === 'active'))) ?? null;
      }
      if (sql.includes('SELECT role FROM native_affiliate_org_members WHERE organization_id')) {
        return state.members.find((row) => row.organization_id === values[0] && row.user_id === values[1] && row.status === 'active') ?? null;
      }
      if (sql.includes("SELECT owner_user_id FROM native_affiliate_organizations WHERE id")) { const org = orgOf(values[0]); return org ? { owner_user_id: org.owner_user_id } : null; }
      if (sql.includes("SELECT id FROM native_affiliate_org_members WHERE user_id")) return state.members.find((row) => row.user_id === values[0] && row.status === 'active') ?? null;
      if (sql.includes('SELECT partner_id FROM native_affiliate_attributions WHERE visitor_id')) {
        return [...state.attributions].reverse().find((row) => row.visitor_id === values[0] && row.user_id === values[1]) ?? null;
      }
      if (sql.includes('SELECT m.affiliate_partner_id AS partner_id FROM native_order_metadata')) return null;
      if (sql.includes('SELECT partner_id FROM native_affiliate_attributions')) {
        return [...state.attributions].reverse().find((row) => row.user_id === values[0] && ['associated', 'converted'].includes(String(row.status))) ?? null;
      }
      if (sql.includes('SELECT id, partner_id, amount, currency FROM native_affiliate_commissions WHERE order_id')) return state.commissions.find((row) => row.order_id === values[0]) ?? null;
      if (sql.includes('SELECT partners.commission_rate')) {
        const row = partnerBy('id', values[0]);
        if (!row || row.status !== 'active') return null;
        const org = orgOf(row.organization_id);
        return {
          commission_rate: row.commission_rate, currency: row.currency, organization_id: row.organization_id, scope_mode: row.scope_mode,
          partner_user_id: row.user_id, owner_user_id: org?.owner_user_id ?? null, organization_rate: org?.commission_rate ?? null, organization_currency: org?.currency ?? null,
        };
      }
      if (sql.includes('SELECT id, amount, currency, beneficiary_user_id FROM native_affiliate_org_commissions')) return state.orgCommissions.find((row) => row.organization_id === values[0] && row.order_id === values[1]) ?? null;
      // the admin side: owners, applications
      if (sql.includes('SELECT id FROM native_users WHERE id')) return ACCOUNTS[values[0] as keyof typeof ACCOUNTS] ? { id: values[0] } : null;
      if (sql.includes('SELECT * FROM native_affiliate_org_applications WHERE id')) return state.applications.find((row) => row.id === values[0]) ?? null;
      return null;
    },
    all: async () => {
      if (sql.includes('SELECT members.id, members.user_id AS userId')) return { results: state.members.filter((row) => row.organization_id === values[0]) };
      if (sql.includes('SELECT product_id FROM native_affiliate_partner_scope WHERE partner_id')) return { results: state.scope.filter((row) => row.partner_id === values[0]) };
      if (sql.includes("SELECT role FROM native_affiliate_org_members WHERE organization_id")) return { results: state.members.filter((row) => row.organization_id === values[0] && row.user_id === values[1] && row.status === 'active') };
      return { results: [] };
    },
    run: async () => {
      if (sql.includes('INSERT INTO native_affiliate_partners')) {
        // opened by default (… commission, now) or by the older "register" call (… organization, role, now)
        const byRegister = values.length === 8;
        state.partners.push({
          id: values[0], user_id: values[1], code: values[2], status: 'active', display_name: values[3], email: values[4],
          commission_rate: byRegister ? 10 : values[5], currency: 'USD', organization_id: byRegister ? values[5] : null, member_role: byRegister ? values[6] : null,
          scope_mode: 'all', created_at: values[values.length - 1], updated_at: values[values.length - 1],
        });
      } else if (sql.includes('UPDATE native_affiliate_attributions SET user_id')) {
        const row = [...state.attributions].reverse().find((candidate) => candidate.visitor_id === values[1] && candidate.user_id === null);
        if (row) Object.assign(row, { user_id: values[0], status: 'associated', associated_at: 'now' });
        return { success: true, meta: { changes: row ? 1 : 0 } };
      } else if (sql.includes('INSERT INTO native_affiliate_org_members')) {
        state.members.push({ id: values[0], organization_id: values[1], user_id: values[2], role: sql.includes("'INFLUENCER'") ? 'INFLUENCER' : 'OWNER', status: 'active', joined_at: values[3] });
      } else if (sql.includes("UPDATE native_affiliate_partners SET organization_id = ?1, member_role = 'INFLUENCER'")) {
        const row = partnerBy('id', values[2]);
        if (row) Object.assign(row, { organization_id: values[0], member_role: 'INFLUENCER' });
      } else if (sql.includes('UPDATE native_affiliate_partners SET organization_id = ?1, member_role = ?2')) {
        const row = partnerBy('id', values[2]);
        if (row) Object.assign(row, { organization_id: values[0], member_role: values[1] });
      } else if (sql.includes('UPDATE native_affiliate_partners SET organization_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2')) {
        const row = partnerBy('id', values[1]);
        if (row) Object.assign(row, { organization_id: values[0] });
      } else if (sql.includes('INSERT INTO native_affiliate_organizations')) {
        state.orgs.push({ id: values[0], owner_user_id: values[1], code: values[2], name: values[3], status: 'active', commission_rate: values[4], currency: 'USD', created_at: values[5], updated_at: values[5] });
      } else if (sql.includes('INSERT INTO native_affiliate_org_applications')) {
        state.applications.push({ id: values[0], user_id: values[1], organization_name: values[2], contact_name: values[3], email: values[4], phone: values[5], website: values[6], message: values[7], status: 'pending', review_note: null, reviewed_at: null, organization_id: null, created_at: values[8], updated_at: values[8] });
      } else if (sql.includes("UPDATE native_affiliate_org_applications SET status = 'approved'")) {
        Object.assign(state.applications.find((row) => row.id === values[0]) ?? {}, { status: 'approved', review_note: values[1], reviewed_at: values[2], organization_id: values[3] });
      } else if (sql.includes('INSERT INTO native_affiliate_commissions')) {
        state.commissions.push({ id: values[0], partner_id: values[1], order_id: values[2], order_amount: values[3], commission_rate: values[4], amount: values[5], currency: values[6] });
      } else if (sql.includes('INSERT INTO native_affiliate_org_commissions')) {
        state.orgCommissions.push({ id: values[0], organization_id: values[1], partner_id: values[2], order_id: values[3], beneficiary_user_id: values[4], order_amount: values[5], commission_rate: values[6], amount: values[7] });
      }
      return { success: true, meta: { changes: 1 } };
    },
  });
  return {
    state,
    prepare: (sql: string) => {
      // SQLite numbers a bare "?" one past the highest number assigned so far, so a statement that mixes the two
      // styles has fewer parameters than bindings, and D1 refuses it. The real database does; so does this one.
      if (/(?<![\w?])\?(?!\d)/.test(sql) && /\?\d+/.test(sql)) throw new Error(`a statement mixes "?" and "?1" placeholders: ${sql.slice(0, 90)}`);
      return { ...statement(sql, []), bind: (...values: unknown[]) => statement(sql, values) };
    },
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => { for (const bound of statements) await bound.run(); return statements; },
  };
}

type Db = ReturnType<typeof fakeDb>;
const envOf = (db: Db) => ({ DB: db }) as never;
const ADMIN = '/api/v1/extensions/plugin/affiliate/api/admin';
const STORE = '/api/v1/plugins/affiliate/store';
const request = (method: string, path: string, body?: unknown) => new Request(`https://api.bokmoo.com${path}`, {
  method, headers: { 'content-type': 'application/json', authorization: 'Bearer token' }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const call = async (db: Db, method: string, path: string, body?: unknown, as: keyof typeof ACCOUNTS = 'user-2') => {
  authenticateNativeUser.mockResolvedValue(ACCOUNTS[as]);
  const response = await tryNativeAffiliate(request(method, path, body), envOf(db));
  return response ? { status: response.status, body: await response.json() as { success: boolean; data?: Row; error?: { code: string } } } : { status: 0, body: { success: false } };
};
/** The owner of an organization: a partner whose account owns it. */
const ownerWithOrganization = async (db: Db, userId: 'user-1' | 'user-2' | 'user-3', rate = DEFAULT_ORGANIZATION_COMMISSION) => {
  await call(db, 'POST', `${STORE}/partners/register`, { displayName: 'Owner' }, userId);
  await call(db, 'POST', `${STORE}/partners/register`, { displayName: 'Owner' }, userId); // links the owner to it
  db.state.orgs.push({ id: 'org-1', owner_user_id: userId, code: 'ORG-1', name: 'Crew', status: 'active', commission_rate: rate, currency: 'USD', created_at: '', updated_at: '' });
  db.state.members.push({ id: 'm-owner', organization_id: 'org-1', user_id: userId, role: 'OWNER', status: 'active', joined_at: '' });
  Object.assign(db.state.partners.find((row) => row.user_id === userId)!, { organization_id: 'org-1', member_role: 'OWNER' });
};
const arrivedThrough = (db: Db, visitor: string, partnerUserId: string, asUserId: string | null = null) => {
  db.state.attributions.push({ id: `attr-${visitor}`, partner_id: db.state.partners.find((row) => row.user_id === partnerUserId)!.id, code: 'X', visitor_id: visitor, user_id: asUserId, status: asUserId ? 'associated' : 'clicked', created_at: '' });
};
const order = (id: string, buyer: string) => ({ id, userId: buyer, totalAmount: 40, discountAmount: 0, appliedDiscounts: [], items: [{ productId: 'odoo-product-7', unitPrice: 40, quantity: 1 }] });

beforeEach(() => {
  authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
});

describe('every storefront account is a partner by default', () => {
  it('the partner page opens the account of an account that has none', async () => {
    const db = fakeDb();
    const first = await call(db, 'GET', `${STORE}/partners/me`);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ userId: 'user-2', status: 'active', commissionRate: DEFAULT_PARTNER_COMMISSION, discountValue: 0, scopeMode: 'all', organizationId: null });
    expect(String(first.body.data?.code)).toMatch(/^[A-Z0-9]{10}$/);
    // asked again: the same account, and still the only one
    const again = await call(db, 'GET', `${STORE}/partners/me`);
    expect(again.body.data?.id).toBe(first.body.data?.id);
    expect(db.state.partners).toHaveLength(1);
    expect(db.state.partners[0]).toMatchObject({ user_id: 'user-2', display_name: 'sam', email: 'sam@example.com' });
  });

  it('opening is safe to repeat, and names the account as the store knows it', async () => {
    const db = fakeDb();
    const opened = await openNativeAffiliatePartner(envOf(db), { id: 'user-3', email: ' Kim@Example.com ', username: ' Kim ' });
    expect(opened).toMatch(/^[0-9a-f-]{36}$/);
    expect(await openNativeAffiliatePartner(envOf(db), { id: 'user-3', email: 'kim@example.com', username: 'kim' })).toBe(opened);
    expect(db.state.partners).toHaveLength(1);
    expect(db.state.partners[0]).toMatchObject({ display_name: 'Kim', email: 'kim@example.com' });
  });
});

describe('an account that arrives through a partner’s link joins that partner’s organization', () => {
  it('through the owner’s link: a member from then on', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1');
    arrivedThrough(db, 'visitor-1', 'user-1');
    const associated = await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' });
    expect(associated.status).toBe(200);
    expect(associated.body.data).toMatchObject({ userId: 'user-2', organization: 'joined' });
    expect(db.state.members).toEqual([expect.objectContaining({ user_id: 'user-1', role: 'OWNER' }), expect.objectContaining({ organization_id: 'org-1', user_id: 'user-2', role: 'INFLUENCER', status: 'active' })]);
    // the account's partner account — opened by default — sits in the organization
    expect(db.state.partners.find((row) => row.user_id === 'user-2')).toMatchObject({ organization_id: 'org-1', member_role: 'INFLUENCER', commission_rate: 10 });
    // the referral itself is recorded against the account, as before
    expect(db.state.attributions[0]).toMatchObject({ user_id: 'user-2', status: 'associated' });
  });

  it('through a member’s link: the same organization', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1');
    arrivedThrough(db, 'visitor-1', 'user-1');
    await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' });
    arrivedThrough(db, 'visitor-2', 'user-2');
    const third = await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-2' }, 'user-3');
    expect(third.body.data).toMatchObject({ userId: 'user-3', organization: 'joined' });
    expect(db.state.members.map((row) => [row.user_id, row.organization_id, row.role])).toEqual([['user-1', 'org-1', 'OWNER'], ['user-2', 'org-1', 'INFLUENCER'], ['user-3', 'org-1', 'INFLUENCER']]);
  });

  it('not through the link of a partner that belongs to no organization', async () => {
    const db = fakeDb();
    await call(db, 'POST', `${STORE}/partners/register`, { displayName: 'Alone' }, 'user-1');
    arrivedThrough(db, 'visitor-1', 'user-1');
    const associated = await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' });
    expect(associated.body.data).toMatchObject({ organization: 'none' });
    expect(db.state.members).toEqual([]);
    // the referral is still the partner's: the partner earns on this shopper’s own orders
    expect(db.state.attributions[0]).toMatchObject({ user_id: 'user-2', status: 'associated' });
    // no organization, so nothing to join: the account is in none (its partner account opens when it is asked for)
    expect(db.state.partners.find((row) => row.user_id === 'user-2')?.organization_id ?? null).toBeNull();
  });

  it('the owner does not become a member of their own organization', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1');
    arrivedThrough(db, 'visitor-1', 'user-1');
    const own = await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' }, 'user-1');
    expect(own.body.data).toMatchObject({ organization: 'none' });
    expect(db.state.members).toHaveLength(1);
  });

  it('a link never moves an account out of the organization it is in', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1');
    db.state.orgs.push({ id: 'org-2', owner_user_id: 'user-3', code: 'ORG-2', name: 'Other', status: 'active', commission_rate: 5, currency: 'USD', created_at: '', updated_at: '' });
    db.state.members.push({ id: 'm-2', organization_id: 'org-2', user_id: 'user-2', role: 'INFLUENCER', status: 'active', joined_at: '' });
    arrivedThrough(db, 'visitor-1', 'user-1');
    const associated = await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' });
    expect(associated.body.data).toMatchObject({ organization: 'already' });
    expect(db.state.members.filter((row) => row.user_id === 'user-2').map((row) => row.organization_id)).toEqual(['org-2']);
  });

  it('an unknown visitor changes nothing', async () => {
    const db = fakeDb();
    const associated = await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-none' });
    expect(associated.status).toBe(404);
    expect(associated.body.error?.code).toBe('ATTRIBUTION_NOT_FOUND');
    expect(db.state.members).toEqual([]);
  });
});

describe('an organization that came before its accounts’ partner accounts', () => {
  it('the owner is tied to it when they open their partner page', async () => {
    const db = fakeDb();
    // the store opened the organization for an account that has no partner account yet
    db.state.orgs.push({ id: 'org-1', owner_user_id: 'user-1', code: 'ORG-1', name: 'Crew', status: 'active', commission_rate: 5, currency: 'USD', created_at: '', updated_at: '' });
    const page = await call(db, 'GET', `${STORE}/partners/me`, undefined, 'user-1');
    expect(page.body.data).toMatchObject({ userId: 'user-1', organizationId: 'org-1', memberRole: 'OWNER', commissionRate: 10 });
    // and so is a member the owner added
    db.state.members.push({ id: 'm-2', organization_id: 'org-1', user_id: 'user-3', role: 'MANAGER', status: 'active', joined_at: '' });
    const member = await call(db, 'GET', `${STORE}/partners/me`, undefined, 'user-3');
    expect(member.body.data).toMatchObject({ userId: 'user-3', organizationId: 'org-1', memberRole: 'MANAGER' });
  });

  it('a link is followed into the organization of the partner’s account, even when the partner’s row was not tied to it', async () => {
    const db = fakeDb();
    // a partner account opened before the account was given its organization
    await call(db, 'POST', `${STORE}/partners/register`, { displayName: 'Owner' }, 'user-1');
    db.state.orgs.push({ id: 'org-1', owner_user_id: 'user-1', code: 'ORG-1', name: 'Crew', status: 'active', commission_rate: 5, currency: 'USD', created_at: '', updated_at: '' });
    expect(db.state.partners[0]!.organization_id).toBeNull();
    arrivedThrough(db, 'visitor-1', 'user-1');
    const joined = await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' });
    expect(joined.body.data).toMatchObject({ organization: 'joined' });
    expect(db.state.members).toEqual([expect.objectContaining({ organization_id: 'org-1', user_id: 'user-2', role: 'INFLUENCER' })]);
    // the partner's row now says what its account already did
    expect(db.state.partners[0]).toMatchObject({ user_id: 'user-1', organization_id: 'org-1' });
  });
});

describe('what an organization earns', () => {
  it('5% of its members’ sales unless the store sets another share', async () => {
    expect(DEFAULT_ORGANIZATION_COMMISSION).toBe(5);
    const db = fakeDb();
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
    const created = await call(db, 'POST', `${ADMIN}/organizations`, { name: 'Direct Crew', ownerUserId: 'user-1' });
    expect(created.body.data?.organization).toMatchObject({ commissionRate: 5 });
    const applied = await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Crew' }, 'user-3');
    const approved = await call(db, 'POST', `${ADMIN}/applications/${applied.body.data?.id}/approve`);
    expect(approved.body.data?.organization).toMatchObject({ commissionRate: 5 });
    // the store's own number still wins
    const bespoke = await call(db, 'POST', `${ADMIN}/organizations`, { name: 'Second', ownerUserId: 'user-2', commissionRate: 8 });
    expect(bespoke.body.data?.organization).toMatchObject({ commissionRate: 8 });
  });

  it('its share of a member’s sale, beside the member’s own commission', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1', 5);
    arrivedThrough(db, 'visitor-1', 'user-1');
    await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' });
    // user-2, now a member, brings a buyer of their own
    arrivedThrough(db, 'visitor-9', 'user-2', 'user-3');
    const settled = await createNativeAffiliateCommission(envOf(db), order('order-member', 'user-3'));
    expect(settled?.partner).toMatchObject({ amount: 4 });
    expect(settled?.organization).toMatchObject({ amount: 2, beneficiaryUserId: 'user-1' });
    expect(db.state.orgCommissions[0]).toMatchObject({ organization_id: 'org-1', partner_id: db.state.partners.find((row) => row.user_id === 'user-2')!.id, amount: 2, commission_rate: 5 });
  });

  it('nothing on the owner’s own sale: the owner’s commission is all they get', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1', 5);
    arrivedThrough(db, 'visitor-1', 'user-1', 'user-2');
    const settled = await createNativeAffiliateCommission(envOf(db), order('order-own', 'user-2'));
    expect(settled?.partner).toMatchObject({ amount: 4 });
    expect(settled?.organization).toBeNull();
    expect(db.state.orgCommissions).toEqual([]);
  });
});

// ---- 2026-11-27, after the store's tests on the live shop: two levels and no further, nobody earns on their own
// purchase, a guest is no partner, the members of an organization are for its owner, and a followers screenshot.

/** An in-memory stand-in for the bucket that holds the screenshots. */
function fakeAssets() {
  const objects = new Map<string, { bytes: Uint8Array; httpMetadata?: { contentType?: string } }>();
  const keys = (prefix: string) => [...objects.keys()].filter((key) => key.startsWith(prefix));
  return {
    objects,
    list: async ({ prefix }: { prefix: string }) => ({ objects: keys(prefix).map((key) => ({ key })) }),
    get: async (key: string) => (objects.has(key) ? { body: objects.get(key)!.bytes, httpMetadata: objects.get(key)!.httpMetadata } : null),
    put: async (key: string, bytes: Uint8Array, options?: { httpMetadata?: { contentType?: string } }) => { objects.set(key, { bytes, httpMetadata: options?.httpMetadata }); },
    delete: async (key: string) => { objects.delete(key); },
  };
}
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0]);
const upload = (bytes: Uint8Array, type: string) => {
  const form = new FormData();
  form.append('file', new File([bytes as BlobPart], 'followers.bin', { type }));
  return new Request(`https://api.bokmoo.com${STORE}/organizations/applications/screenshot`, { method: 'POST', headers: { authorization: 'Bearer token' }, body: form });
};

describe('two levels, and no further', () => {
  it('the organization earns nothing on the sale of someone a member brought in', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1', 5);
    arrivedThrough(db, 'visitor-1', 'user-1');
    await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' });              // user-2: the owner's own recruit
    arrivedThrough(db, 'visitor-2', 'user-2');
    await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-2' }, 'user-3');    // user-3: user-2's recruit, in the organization too
    expect(db.state.members.map((row) => [row.user_id, row.role])).toEqual([['user-1', 'OWNER'], ['user-2', 'INFLUENCER'], ['user-3', 'INFLUENCER']]);
    arrivedThrough(db, 'visitor-9', 'user-3', 'buyer-9');
    const settled = await createNativeAffiliateCommission(envOf(db), order('order-third', 'buyer-9'));
    // the seller is paid; the owner is not, and neither is the member in between
    expect(settled?.partner).toMatchObject({ amount: 4, partnerId: db.state.partners.find((row) => row.user_id === 'user-3')!.id });
    expect(settled?.organization).toBeNull();
    expect(db.state.orgCommissions).toEqual([]);
  });

  it('a member the owner added by hand still earns the organization its share', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1', 5);
    await call(db, 'GET', `${STORE}/partners/me`, undefined, 'user-2');
    db.state.members.push({ id: 'm-2', organization_id: 'org-1', user_id: 'user-2', role: 'INFLUENCER', status: 'active', joined_at: '' });
    Object.assign(db.state.partners.find((row) => row.user_id === 'user-2')!, { organization_id: 'org-1', member_role: 'INFLUENCER' });
    arrivedThrough(db, 'visitor-9', 'user-2', 'buyer-9');
    const settled = await createNativeAffiliateCommission(envOf(db), order('order-hand', 'buyer-9'));
    expect(settled?.partner).toMatchObject({ amount: 4 });
    expect(settled?.organization).toMatchObject({ amount: 2, beneficiaryUserId: 'user-1' });
  });
});

describe('nobody earns a commission on their own purchase', () => {
  it('a partner who shops with their own code keeps the buyer discount and is paid nothing', async () => {
    const db = fakeDb();
    await call(db, 'POST', `${STORE}/partners/register`, { displayName: 'Sam' }, 'user-2');
    const partner = db.state.partners[0]!;
    arrivedThrough(db, 'visitor-1', 'user-2', 'user-2');
    const settled = await createNativeAffiliateCommission(envOf(db), { ...order('order-self', 'user-2'), totalAmount: 36, appliedDiscounts: [{ kind: 'affiliate', id: partner.id, amount: 4 }] });
    expect(settled).toBeNull();
    expect(db.state.commissions).toEqual([]);
  });

  it('the owner’s own purchase through their own link pays no one', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1', 5);
    arrivedThrough(db, 'visitor-1', 'user-1', 'user-1');
    expect(await createNativeAffiliateCommission(envOf(db), order('order-owner', 'user-1'))).toBeNull();
    expect(db.state.commissions).toEqual([]);
    expect(db.state.orgCommissions).toEqual([]);
  });

  it('a member’s own purchase with their own code pays the organization nothing either', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1', 5);
    arrivedThrough(db, 'visitor-1', 'user-1');
    await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' });
    arrivedThrough(db, 'visitor-2', 'user-2', 'user-2');
    const member = db.state.partners.find((row) => row.user_id === 'user-2')!;
    expect(await createNativeAffiliateCommission(envOf(db), { ...order('order-member-self', 'user-2'), appliedDiscounts: [{ kind: 'affiliate', id: member.id, amount: 4 }] })).toBeNull();
    expect(db.state.commissions).toEqual([]);
    expect(db.state.orgCommissions).toEqual([]);
  });
});

describe('a guest session is no partner account', () => {
  it('opening the partner page as a guest opens nothing, and asks for a sign-in', async () => {
    const db = fakeDb();
    const page = await call(db, 'GET', `${STORE}/partners/me`, undefined, 'guest-1');
    expect(page.status).toBe(403);
    expect(page.body.error?.code).toBe('SIGN_IN_REQUIRED');
    expect(db.state.partners).toEqual([]);
    expect((await call(db, 'GET', `${STORE}/organizations/me`, undefined, 'guest-1')).status).toBe(403);
    expect((await call(db, 'GET', `${STORE}/commissions`, undefined, 'guest-1')).status).toBe(403);
    expect((await call(db, 'POST', `${STORE}/partners/register`, { displayName: 'Guest' }, 'guest-1')).status).toBe(403);
    expect((await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Crew' }, 'guest-1')).status).toBe(403);
    expect(db.state.partners).toEqual([]);
    expect(db.state.applications).toEqual([]);
  });

  it('a guest’s visit is still tied to the partner who brought it, and joins no organization', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1');
    arrivedThrough(db, 'visitor-1', 'user-1');
    const tied = await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' }, 'guest-1');
    expect(tied.status).toBe(200);
    expect(tied.body.data).toMatchObject({ userId: 'guest-1', organization: 'none' });
    expect(db.state.attributions[0]).toMatchObject({ user_id: 'guest-1', status: 'associated' });
    expect(db.state.members).toHaveLength(1);
    expect(db.state.partners).toHaveLength(1);
  });
});

describe('who sees the members of an organization', () => {
  it('the owner sees them and manages them; a member sees the organization and their own place in it', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1');
    arrivedThrough(db, 'visitor-1', 'user-1');
    await call(db, 'POST', `${STORE}/attributions/associate`, { visitorId: 'visitor-1' });
    const asOwner = await call(db, 'GET', `${STORE}/organizations/me`, undefined, 'user-1');
    expect(asOwner.body.data).toMatchObject({ name: 'Crew', viewerRole: 'OWNER', canManageMembers: true });
    expect(asOwner.body.data?.members).toHaveLength(2);
    const asMember = await call(db, 'GET', `${STORE}/organizations/me`, undefined, 'user-2');
    expect(asMember.body.data).toMatchObject({ name: 'Crew', commissionRate: 5, viewerRole: 'INFLUENCER', canManageMembers: false, members: [] });
  });

  it('a manager added by the owner is shown as one, and still does not manage the members', async () => {
    const db = fakeDb();
    await ownerWithOrganization(db, 'user-1');
    db.state.members.push({ id: 'm-3', organization_id: 'org-1', user_id: 'user-3', role: 'MANAGER', status: 'active', joined_at: '' });
    const asManager = await call(db, 'GET', `${STORE}/organizations/me`, undefined, 'user-3');
    expect(asManager.body.data).toMatchObject({ viewerRole: 'MANAGER', canManageMembers: false, members: [] });
  });
});

describe('a followers screenshot sent with an application', () => {
  it('is stored under the account, the latest replacing the earlier one, and read back by the account', async () => {
    const db = fakeDb();
    const assets = fakeAssets();
    const env = { DB: db, ASSETS: assets } as never;
    authenticateNativeUser.mockResolvedValue(ACCOUNTS['user-2']);
    const first = await tryNativeAffiliate(upload(PNG, 'image/png'), env);
    expect(first?.status).toBe(200);
    expect(((await first!.json()) as Row).data).toMatchObject({ uploaded: true, contentType: 'image/png', size: PNG.length });
    expect([...assets.objects.keys()]).toEqual(['private/affiliate/applications/user-2/followers.png']);
    // a JPEG follows: one screenshot per account
    const second = await tryNativeAffiliate(upload(JPEG, 'image/jpeg'), env);
    expect(second?.status).toBe(200);
    expect([...assets.objects.keys()]).toEqual(['private/affiliate/applications/user-2/followers.jpg']);
    const own = await tryNativeAffiliate(request('GET', `${STORE}/organizations/applications/screenshot`), env);
    expect(own?.status).toBe(200);
    expect(own?.headers.get('content-type')).toBe('image/jpeg');
    expect([...new Uint8Array(await own!.arrayBuffer())]).toEqual([...JPEG]);
  });

  it('is refused when it is not a JPEG, PNG, or WebP image, or is larger than 5 MB, and when the bucket is not there', async () => {
    const db = fakeDb();
    authenticateNativeUser.mockResolvedValue(ACCOUNTS['user-2']);
    const env = { DB: db, ASSETS: fakeAssets() } as never;
    const text = await tryNativeAffiliate(upload(Uint8Array.from([60, 104, 116, 109, 108, 62]), 'image/png'), env);
    expect(text?.status).toBe(400);
    expect(((await text!.json()) as Row).error).toMatchObject({ code: 'INVALID_FILE_TYPE' });
    const large = await tryNativeAffiliate(upload(new Uint8Array(5 * 1024 * 1024 + 1), 'image/png'), env);
    expect(large?.status).toBe(400);
    expect(((await large!.json()) as Row).error).toMatchObject({ code: 'FILE_TOO_LARGE' });
    const none = await tryNativeAffiliate(new Request(`https://api.bokmoo.com${STORE}/organizations/applications/screenshot`, { method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, body: '{}' }), env);
    expect(none?.status).toBe(400);
    const noBucket = await tryNativeAffiliate(upload(PNG, 'image/png'), { DB: db } as never);
    expect(noBucket?.status).toBe(503);
  });

  it('is read by the store through the application, and by no one else', async () => {
    const db = fakeDb();
    const assets = fakeAssets();
    const env = { DB: db, ASSETS: assets } as never;
    authenticateNativeUser.mockResolvedValue(ACCOUNTS['user-2']);
    await tryNativeAffiliate(upload(PNG, 'image/png'), env);
    const applied = await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Crew' }, 'user-2');
    // an administrator opens the application's screenshot
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
    const shown = await tryNativeAffiliate(request('GET', `${ADMIN}/applications/${applied.body.data?.id}/screenshot`), env);
    expect(shown?.status).toBe(200);
    expect(shown?.headers.get('content-type')).toBe('image/png');
    // a shopper's session does not open the admin route
    authenticateNativeAdmin.mockResolvedValue(null);
    const refused = await tryNativeAffiliate(request('GET', `${ADMIN}/applications/${applied.body.data?.id}/screenshot`), env);
    expect(refused?.status).toBe(401);
    // an application that is not, and an applicant who sent no screenshot
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
    expect((await tryNativeAffiliate(request('GET', `${ADMIN}/applications/nope/screenshot`), env))?.status).toBe(404);
    const bare = await call(db, 'POST', `${STORE}/organizations/applications`, { organizationName: 'Bare' }, 'user-3');
    const missing = await tryNativeAffiliate(request('GET', `${ADMIN}/applications/${bare.body.data?.id}/screenshot`), env);
    expect(missing?.status).toBe(404);
    expect(((await missing!.json()) as Row).error).toMatchObject({ code: 'SCREENSHOT_NOT_FOUND' });
    // a guest is offered no screenshot route
    authenticateNativeUser.mockResolvedValue(ACCOUNTS['guest-1']);
    expect((await tryNativeAffiliate(upload(PNG, 'image/png'), env))?.status).toBe(403);
  });
});
