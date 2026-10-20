import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
const findNativeUserById = vi.fn();
const findNativeUserByEmail = vi.fn();
const createNativeUser = vi.fn();
const sendNativeVerificationCode = vi.fn(async () => undefined);

vi.mock('./auth', () => ({
  authenticateNativeAdmin,
  findNativeUserById,
  findNativeUserByEmail,
  createNativeUser,
}));
vi.mock('./email-verification', () => ({ sendNativeVerificationCode }));

const { tryNativeAdminStaff } = await import('./admin-staff');

interface UserRow {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar: string | null;
  is_active: number;
  email_verified: number;
  migrated_at: string;
  updated_at: string;
}

interface MembershipRow {
  id: string;
  user_id: string;
  role: string;
  status: string;
  is_owner: number;
  extra_permissions: string;
  revoked_permissions: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

function fakeState() {
  const users: UserRow[] = [
    { id: 'u-owner', email: 'owner@jiffoo.test', username: 'owner', role: 'SUPER_ADMIN', avatar: null, is_active: 1, email_verified: 1, migrated_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: 'u-analyst', email: 'analyst@jiffoo.test', username: 'analyst', role: 'USER', avatar: null, is_active: 1, email_verified: 0, migrated_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
    { id: 'u-plain', email: 'plain@jiffoo.test', username: 'plainuser', role: 'USER', avatar: null, is_active: 1, email_verified: 1, migrated_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  ];
  const memberships: MembershipRow[] = [];
  const audit: Array<Record<string, unknown>> = [];
  return { users, memberships, audit };
}

function joined(state: ReturnType<typeof fakeState>, membership: MembershipRow) {
  const user = state.users.find((u) => u.id === membership.user_id)!;
  return {
    ...membership,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    account_role: user.role,
    is_active: user.is_active,
    email_verified: user.email_verified,
    account_created_at: user.migrated_at,
    account_updated_at: user.updated_at,
  };
}

function envFor(state: ReturnType<typeof fakeState>) {
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => {
        if (sql.includes('SELECT count(*) AS n FROM native_admin_memberships m JOIN')) {
          return { n: filterMemberships(state, sql, args).length };
        }
        if (sql.includes('native_admin_staff_audit_logs') && sql.includes('count(*)')) {
          return { n: state.audit.filter((a) => a.staff_user_id === args[0]).length };
        }
        if (sql.includes('WHERE user_id != ?1 AND is_owner = 1')) {
          return { n: state.memberships.filter((m) => m.user_id !== args[0] && m.is_owner === 1 && m.status === 'ACTIVE').length };
        }
        if (sql.includes('SELECT m.id, m.user_id') && sql.includes('WHERE m.user_id = ?1')) {
          const membership = state.memberships.find((m) => m.user_id === args[0]);
          return membership ? joined(state, membership) : null;
        }
        if (sql.includes('SELECT id FROM native_admin_memberships WHERE user_id = ?1')) {
          return state.memberships.some((m) => m.user_id === args[0]) ? { id: 'x' } : null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes('native_admin_staff_audit_logs') && sql.includes('ORDER BY created_at DESC')) {
          const items = state.audit.filter((a) => a.staff_user_id === args[0]);
          return { results: items.slice(Number(args[1] ?? 20) ? 0 : 0) };
        }
        if (sql.includes('ORDER BY m.is_owner')) {
          const rows = filterMemberships(state, sql, args)
            .sort((a, b) => Number(b.is_owner) - Number(a.is_owner))
            .map((m) => joined(state, m));
          const limit = Number(args[args.length - 2] ?? 20);
          const offset = Number(args[args.length - 1] ?? 0);
          return { results: rows.slice(offset, offset + limit) };
        }
        return { results: [] };
      },
      run: async () => {
        if (sql.includes('INSERT INTO native_admin_memberships') && sql.includes('randomblob')) {
          for (const user of state.users.filter((u) => ['SUPER_ADMIN', 'ADMIN'].includes(u.role) && u.is_active === 1)) {
            if (!state.memberships.some((m) => m.user_id === user.id)) {
              state.memberships.push({
                id: `backfill-${user.id}`, user_id: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'OWNER' : 'ADMIN', status: 'ACTIVE',
                is_owner: user.role === 'SUPER_ADMIN' ? 1 : 0,
                extra_permissions: '[]', revoked_permissions: '[]',
                created_by_user_id: null, updated_by_user_id: null,
                created_at: '2026-09-14T00:00:00.000Z', updated_at: '2026-09-14T00:00:00.000Z',
              });
            }
          }
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO native_admin_memberships')) {
          state.memberships.push({
            id: String(args[0]), user_id: String(args[1]), role: String(args[2]), status: String(args[3]),
            is_owner: Number(args[4]), extra_permissions: String(args[5]), revoked_permissions: String(args[6]),
            created_by_user_id: String(args[7]), updated_by_user_id: String(args[7]),
            created_at: String(args[8]), updated_at: String(args[8]),
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE native_admin_memberships')) {
          const membership = state.memberships.find((m) => m.user_id === args[7]);
          if (membership) {
            membership.role = String(args[0]);
            membership.status = String(args[1]);
            membership.is_owner = Number(args[2]);
            membership.extra_permissions = String(args[3]);
            membership.revoked_permissions = String(args[4]);
            membership.updated_by_user_id = String(args[5]);
            membership.updated_at = String(args[6]);
          }
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes('DELETE FROM native_admin_memberships')) {
          const index = state.memberships.findIndex((m) => m.user_id === args[0]);
          if (index >= 0) state.memberships.splice(index, 1);
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO native_admin_staff_audit_logs')) {
          state.audit.push({
            id: args[0], staff_user_id: args[1], staff_email: args[2], staff_username: args[3],
            actor_user_id: args[4], action: args[7], metadata: args[8], created_at: args[9],
          });
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 0 } };
      },
    }),
  });
  return { DB: { prepare } } as never;
}

function filterMemberships(state: ReturnType<typeof fakeState>, sql: string, bindings: unknown[]): MembershipRow[] {
  let rows = [...state.memberships];
  let cursor = 0;
  if (sql.includes('m.role = ?')) { rows = rows.filter((m) => m.role === bindings[cursor]); cursor += 1; }
  if (sql.includes('m.status = ?')) { rows = rows.filter((m) => m.status === bindings[cursor]); cursor += 1; }
  if (sql.includes('lower(u.email) LIKE ?')) {
    const needle = String(bindings[cursor]).replace(/%/g, '').toLowerCase();
    rows = rows.filter((m) => {
      const user = state.users.find((u) => u.id === m.user_id);
      return !!user && (user.email.toLowerCase().includes(needle) || user.username.toLowerCase().includes(needle));
    });
  }
  return rows;
}

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://api.example${path}`, init);
}

function jsonBody(value: unknown): RequestInit {
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) };
}

describe('native admin staff', () => {
  let state: ReturnType<typeof fakeState>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = fakeState();
    findNativeUserById.mockImplementation(async (env: unknown, id: string) => state.users.find((u) => u.id === id) ?? null);
    findNativeUserByEmail.mockImplementation(async (env: unknown, email: string) => state.users.find((u) => u.email === email) ?? null);
    createNativeUser.mockImplementation(async (env: unknown, user: { id: string; email: string; username: string; role: string; avatar: string | null }) => {
      state.users.push({ id: user.id, email: user.email, username: user.username, role: 'USER', avatar: null, is_active: 1, email_verified: 0, migrated_at: '2026-09-14T00:00:00Z', updated_at: '2026-09-14T00:00:00Z' });
    });
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-owner', email: 'owner@jiffoo.test', username: 'owner', role: 'SUPER_ADMIN' });
  });

  it('rejects unauthenticated callers', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff'), envFor(state));
    expect(response?.status).toBe(401);
  });

  it('rejects staff users without staff permissions (analyst cannot even list)', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-plain', email: 'plain@jiffoo.test', username: 'plainuser', role: 'USER' });
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff'), envFor(state));
    expect(response?.status).toBe(403);
  });

  it('ignores unrelated paths and unknown subroutes', async () => {
    expect(await tryNativeAdminStaff(request('/api/v1/admin/orders'), envFor(state))).toBeNull();
    expect(await tryNativeAdminStaff(request('/api/v1/admin/staff/roles/extra'), envFor(state))).toBeNull();
    expect(await tryNativeAdminStaff(request('/api/v1/admin/staff/a/b/c'), envFor(state))).toBeNull();
  });

  it('serves the role and permission catalogs from the shared RBAC matrix', async () => {
    const roles = await (await tryNativeAdminStaff(request('/api/v1/admin/staff/roles'), envFor(state)) as Response).json() as { data: Array<{ role: string; permissions: string[] }> };
    expect(roles.data.map((r) => r.role)).toEqual(['OWNER', 'ADMIN', 'CATALOG_MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'ANALYST']);
    expect(roles.data.find((r) => r.role === 'OWNER')!.permissions.length).toBeGreaterThan(25);
    const permissions = await (await tryNativeAdminStaff(request('/api/v1/admin/staff/permissions'), envFor(state)) as Response).json() as { data: Array<{ group: string; permissions: Array<{ key: string }> }> };
    expect(permissions.data.find((g) => g.group === 'STAFF')!.permissions.map((p) => p.key)).toEqual(['staff.read', 'staff.write']);
  });

  it('backfills the legacy bootstrap owner and lists them', async () => {
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff?page=1&limit=20'), envFor(state));
    expect(response?.status).toBe(200);
    const payload = await response!.json() as { data: { items: Array<Record<string, unknown>>; total: number } };
    expect(payload.data.total).toBe(1);
    expect(payload.data.items[0]).toMatchObject({ userId: 'u-owner', adminRole: 'OWNER', isOwner: true, status: 'ACTIVE' });
    expect(state.memberships.some((m) => m.user_id === 'u-owner' && m.role === 'OWNER' && m.is_owner === 1)).toBe(true);
  });

  it('owner grants staff access with an audit entry', async () => {
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'ANALYST' }) }), envFor(state));
    expect(response?.status).toBe(201);
    const payload = await response!.json() as { data: Record<string, unknown> };
    expect(payload.data).toMatchObject({ userId: 'u-analyst', adminRole: 'ANALYST', isOwner: false });
    expect(Array.isArray(payload.data.effectivePermissions)).toBe(true);
    const grant = state.audit.find((a) => a.action === 'STAFF_ACCESS_GRANTED');
    expect(grant).toBeTruthy();
    expect(JSON.parse(String(grant!.metadata))).toMatchObject({ adminRole: 'ANALYST', invitationSkipped: null });
  });

  it('rejects duplicate grants with a conflict', async () => {
    await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'ANALYST' }) }), envFor(state));
    const second = await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'ADMIN' }) }), envFor(state));
    expect(second?.status).toBe(409);
    await expect(second!.json()).resolves.toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('refuses to grant a role the actor cannot hold and owner access to non-owners', async () => {
    // analyst actor without staff permissions is blocked earlier (403); an
    // ADMIN (all permissions, not owner) may not mint another OWNER.
    state.memberships.push({
      id: 'seed-admin', user_id: 'u-plain', role: 'ADMIN', status: 'ACTIVE', is_owner: 0,
      extra_permissions: '[]', revoked_permissions: '[]', created_by_user_id: null, updated_by_user_id: null,
      created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
    });
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-plain', email: 'plain@jiffoo.test', username: 'plainuser', role: 'USER' });
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'OWNER' }) }), envFor(state));
    expect(response?.status).toBe(403);
    await expect(response!.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('validates the role value before touching data', async () => {
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'WIZARD' }) }), envFor(state));
    expect(response?.status).toBe(400);
    expect(state.memberships.length).toBe(0);
  });

  it('owner updates a membership with previous/next audit metadata', async () => {
    await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'ANALYST' }) }), envFor(state));
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff/u-analyst', { method: 'PATCH', ...jsonBody({ role: 'SUPPORT_AGENT', status: 'SUSPENDED' }) }), envFor(state));
    expect(response?.status).toBe(200);
    const payload = await response!.json() as { data: Record<string, unknown> };
    expect(payload.data).toMatchObject({ adminRole: 'SUPPORT_AGENT', status: 'SUSPENDED' });
    const update = state.audit.find((a) => a.action === 'STAFF_ACCESS_UPDATED');
    expect(JSON.parse(String(update!.metadata))).toMatchObject({ previous: { adminRole: 'ANALYST' }, next: { adminRole: 'SUPPORT_AGENT', status: 'SUSPENDED' } });
  });

  it('refuses to suspend the last owner', async () => {
    await tryNativeAdminStaff(request('/api/v1/admin/staff?page=1'), envFor(state)); // backfill owner membership
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff/u-owner', { method: 'PATCH', ...jsonBody({ role: 'OWNER', status: 'SUSPENDED' }) }), envFor(state));
    expect(response?.status).toBe(409);
    await expect(response!.json()).resolves.toMatchObject({ error: { code: 'LAST_OWNER_REQUIRED' } });
  });

  it('removes a non-owner membership with an audit trail', async () => {
    await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'ANALYST' }) }), envFor(state));
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff/u-analyst', { method: 'DELETE' }), envFor(state));
    expect(response?.status).toBe(200);
    await expect(response!.json()).resolves.toMatchObject({ data: { userId: 'u-analyst', removed: true } });
    expect(state.memberships.some((m) => m.user_id === 'u-analyst')).toBe(false);
    expect(state.audit.some((a) => a.action === 'STAFF_ACCESS_REMOVED')).toBe(true);
  });

  it('resends invitations only for unverified staff accounts', async () => {
    await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'ANALYST' }) }), envFor(state));
    const invited = await tryNativeAdminStaff(request('/api/v1/admin/staff/u-analyst/invite', { method: 'POST' }), envFor(state));
    expect(invited?.status).toBe(200);
    expect(sendNativeVerificationCode).toHaveBeenCalled();

    const verified = await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-plain', role: 'ANALYST' }) }), envFor(state));
    expect(verified?.status).toBe(201);
    const blocked = await tryNativeAdminStaff(request('/api/v1/admin/staff/u-plain/invite', { method: 'POST' }), envFor(state));
    expect(blocked?.status).toBe(409);
    await expect(blocked!.json()).resolves.toMatchObject({ error: { code: 'ALREADY_VERIFIED' } });
  });

  it('creates a new staff account when the email is unknown', async () => {
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ email: 'new-staff@jiffoo.test', username: 'newstaff', role: 'ANALYST' }) }), envFor(state));
    expect(response?.status).toBe(201);
    expect(createNativeUser).toHaveBeenCalled();
    const payload = await response!.json() as { data: Record<string, unknown> };
    expect(payload.data.email).toBe('new-staff@jiffoo.test');
    expect(payload.data.emailVerified).toBe(false);
    expect(sendNativeVerificationCode).toHaveBeenCalled();
  });

  it('lists members with search filters over email and username', async () => {
    await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'ANALYST' }) }), envFor(state));
    await tryNativeAdminStaff(request('/api/v1/admin/staff?page=1'), envFor(state)); // backfill owner
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff?search=analyst&page=1&limit=20'), envFor(state));
    const payload = await response!.json() as { data: { items: Array<Record<string, unknown>>; total: number } };
    expect(payload.data.total).toBe(1);
    expect(payload.data.items[0].userId).toBe('u-analyst');
  });

  it('returns 404 for unknown members on detail and mutations', async () => {
    const detail = await tryNativeAdminStaff(request('/api/v1/admin/staff/u-ghost'), envFor(state));
    expect(detail?.status).toBe(404);
    const patch = await tryNativeAdminStaff(request('/api/v1/admin/staff/u-ghost', { method: 'PATCH', ...jsonBody({ role: 'ANALYST' }) }), envFor(state));
    expect(patch?.status).toBe(404);
  });

  it('rejects unsupported methods with 405', async () => {
    await tryNativeAdminStaff(request('/api/v1/admin/staff', { method: 'POST', ...jsonBody({ userId: 'u-analyst', role: 'ANALYST' }) }), envFor(state));
    const response = await tryNativeAdminStaff(request('/api/v1/admin/staff/u-analyst', { method: 'PUT' }), envFor(state));
    expect(response?.status).toBe(405);
  });
});
