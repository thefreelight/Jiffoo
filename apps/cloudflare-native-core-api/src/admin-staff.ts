import {
  authenticateNativeAdmin,
  createNativeUser,
  findNativeUserByEmail,
  findNativeUserById,
  type NativeAuthEnv,
} from './auth';
import { sendNativeVerificationCode } from './email-verification';
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_GROUPS,
  ADMIN_ROLES,
  getDefaultPermissionsForAdminRole,
  normalizePermissionList,
  resolveAdminAccess,
  resolveAdminRole,
  titleCaseFromKey,
  type AdminRole,
  type ResolvedAdminAccess,
} from './native-rbac';

type StaffEnv = NativeAuthEnv;

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
  email: string;
  username: string;
  avatar: string | null;
  account_role: string;
  is_active: number;
  email_verified: number;
  account_created_at: string;
  account_updated_at: string;
}

interface StaffActor {
  userId: string;
  permissions: readonly string[];
  isOwner: boolean;
}

class StaffError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode: number) {
    super(message);
  }
}

const STAFF_MANAGEMENT_PERMISSIONS = new Set<string>([
  ADMIN_PERMISSIONS.STAFF_READ,
  ADMIN_PERMISSIONS.STAFF_WRITE,
]);

function json(data: unknown, status = 200, message?: string): Response {
  return Response.json(
    { success: true, data, ...(message ? { message } : {}) },
    { status, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-staff', 'cache-control': 'no-store' } },
  );
}

function fail(code: string, message: string, status: number): Response {
  return Response.json(
    { success: false, error: { code, message } },
    { status, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-staff', 'cache-control': 'no-store' } },
  );
}

function parseList(value: string | null): unknown[] {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function membershipAccess(row: MembershipRow): ResolvedAdminAccess | null {
  return resolveAdminAccess({
    role: row.role,
    status: row.status,
    isOwner: row.is_owner === 1,
    extraPermissions: parseList(row.extra_permissions),
    revokedPermissions: parseList(row.revoked_permissions),
  });
}

function serialize(row: MembershipRow): Record<string, unknown> {
  const access = membershipAccess(row);
  if (!access) throw new StaffError('Staff membership is invalid', 'INTERNAL_SERVER_ERROR', 500);
  return {
    membershipId: row.id,
    userId: row.user_id,
    email: row.email,
    username: row.username,
    avatar: row.avatar,
    accountRole: row.account_role,
    accountActive: row.is_active === 1,
    emailVerified: row.email_verified === 1,
    adminRole: access.role,
    status: access.status,
    isOwner: access.isOwner,
    extraPermissions: access.extraPermissions,
    revokedPermissions: access.revokedPermissions,
    effectivePermissions: access.permissions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    membershipCreatedByUserId: row.created_by_user_id,
    membershipUpdatedByUserId: row.updated_by_user_id,
    accountCreatedAt: row.account_created_at,
    accountUpdatedAt: row.account_updated_at,
  };
}

const MEMBERSHIP_SELECT = `SELECT m.id, m.user_id, m.role, m.status, m.is_owner, m.extra_permissions,
    m.revoked_permissions, m.created_by_user_id, m.updated_by_user_id, m.created_at, m.updated_at,
    u.email, u.username, u.avatar, u.role AS account_role, u.is_active, u.email_verified,
    u.migrated_at AS account_created_at, u.updated_at AS account_updated_at
  FROM native_admin_memberships m JOIN native_users u ON u.id = m.user_id`;

// Cloudflare-native installs bootstrap the first administrator through the
// install flow (a native_users SUPER_ADMIN row) without a membership record,
// while the Node api resolves access through the admin-membership-compat
// legacy fallback. Materialize that fallback as a real membership row once per
// read so the Staff panel can list and manage the owner consistently.
async function backfillLegacyAdmins(env: StaffEnv): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_admin_memberships (id, user_id, role, status, is_owner, extra_permissions, revoked_permissions, created_at, updated_at)
     SELECT lower(hex(randomblob(16))), u.id,
            CASE WHEN u.role = 'SUPER_ADMIN' THEN 'OWNER' ELSE 'ADMIN' END, 'ACTIVE',
            CASE WHEN u.role = 'SUPER_ADMIN' THEN 1 ELSE 0 END, '[]', '[]', ?1, ?1
     FROM native_users u
     WHERE u.role IN ('SUPER_ADMIN', 'ADMIN') AND u.is_active = 1
       AND NOT EXISTS (SELECT 1 FROM native_admin_memberships m WHERE m.user_id = u.id)`,
  ).bind(now).run();
}

async function getMembership(env: StaffEnv, userId: string): Promise<MembershipRow | null> {
  return env.DB.prepare(`${MEMBERSHIP_SELECT} WHERE m.user_id = ?1`).bind(userId).first<MembershipRow>();
}

async function writeAuditLog(
  env: StaffEnv,
  input: {
    staffUserId: string;
    staffEmail: string;
    staffUsername?: string | null;
    actorUserId: string;
    action: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const actor = await findNativeUserById(env, input.actorUserId);
  await env.DB.prepare(
    `INSERT INTO native_admin_staff_audit_logs
      (id, staff_user_id, staff_email, staff_username, actor_user_id, actor_email, actor_username, action, metadata, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
  ).bind(
    crypto.randomUUID(),
    input.staffUserId,
    input.staffEmail,
    input.staffUsername ?? null,
    actor?.id ?? input.actorUserId,
    actor?.email ?? null,
    actor?.username ?? null,
    input.action,
    input.metadata ? JSON.stringify(input.metadata) : null,
    new Date().toISOString(),
  ).run();
}

function normalizeOverrides(
  role: AdminRole,
  extraPermissions: unknown,
  revokedPermissions: unknown,
): { extraPermissions: string[]; revokedPermissions: string[] } {
  const base = new Set<string>(getDefaultPermissionsForAdminRole(role));
  const revoked = normalizePermissionList(revokedPermissions).filter((permission) => base.has(permission));
  const revokedSet = new Set(revoked);
  const extra = normalizePermissionList(extraPermissions).filter((permission) => !base.has(permission) && !revokedSet.has(permission));
  return { extraPermissions: extra, revokedPermissions: revoked };
}

function assertValidRole(value: unknown): AdminRole {
  const role = resolveAdminRole(typeof value === 'string' ? value : null);
  if (!role) throw new StaffError('Invalid admin role', 'VALIDATION_ERROR', 400);
  return role;
}

function assertActorCanManageResolvedAccess(actor: StaffActor, target: ResolvedAdminAccess): void {
  if (actor.isOwner) return;
  if (target.isOwner) throw new StaffError('Only owners can assign owner access', 'FORBIDDEN', 403);
  if (target.permissions.some((permission) => STAFF_MANAGEMENT_PERMISSIONS.has(permission))) {
    throw new StaffError('Only owners can grant staff management permissions', 'FORBIDDEN', 403);
  }
  const actorSet = new Set(actor.permissions);
  for (const permission of target.permissions) {
    if (!actorSet.has(permission)) throw new StaffError(`Cannot assign permission you do not have: ${permission}`, 'FORBIDDEN', 403);
  }
}

function assertActorCanManageExisting(actor: StaffActor, existing: MembershipRow): void {
  if (actor.isOwner) return;
  const existingAccess = membershipAccess(existing);
  if (!existingAccess) throw new StaffError('Staff membership is invalid', 'INTERNAL_SERVER_ERROR', 500);
  if (existingAccess.isOwner) throw new StaffError('Only owners can manage owner memberships', 'FORBIDDEN', 403);
  if (existingAccess.permissions.some((permission) => STAFF_MANAGEMENT_PERMISSIONS.has(permission))) {
    throw new StaffError('Only owners can manage staff managers', 'FORBIDDEN', 403);
  }
  const actorSet = new Set(actor.permissions);
  for (const permission of existingAccess.permissions) {
    if (!actorSet.has(permission)) throw new StaffError('Cannot manage staff with broader permissions than your own', 'FORBIDDEN', 403);
  }
}

async function ensureNotRemovingLastOwner(env: StaffEnv, userId: string): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT count(*) AS n FROM native_admin_memberships WHERE user_id != ?1 AND is_owner = 1 AND status = 'ACTIVE'`,
  ).bind(userId).first<{ n: number }>();
  if (Number(row?.n ?? 0) === 0) {
    throw new StaffError('At least one active owner must remain', 'LAST_OWNER_REQUIRED', 409);
  }
}

function integerParam(raw: string | null, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}

async function listStaff(env: StaffEnv, url: URL): Promise<Response> {
  const page = integerParam(url.searchParams.get('page'), 1, 1_000_000);
  const limit = integerParam(url.searchParams.get('limit'), 20, 100);
  const search = url.searchParams.get('search')?.trim();
  const role = url.searchParams.get('role')?.trim();
  const status = url.searchParams.get('status')?.trim();

  await backfillLegacyAdmins(env);

  const clauses = ['1 = 1'];
  const bindings: unknown[] = [];
  if (role) { bindings.push(role); clauses.push(`m.role = ?${bindings.length}`); }
  if (status === 'ACTIVE' || status === 'SUSPENDED') { bindings.push(status); clauses.push(`m.status = ?${bindings.length}`); }
  if (search) {
    bindings.push(`%${search.toLowerCase()}%`);
    clauses.push(`(lower(u.email) LIKE ?${bindings.length} OR lower(u.username) LIKE ?${bindings.length})`);
  }
  const where = clauses.join(' AND ');
  const total = await env.DB.prepare(
    `SELECT count(*) AS n FROM native_admin_memberships m JOIN native_users u ON u.id = m.user_id WHERE ${where}`,
  ).bind(...bindings).first<{ n: number }>();
  const rows = await env.DB.prepare(
    `${MEMBERSHIP_SELECT} WHERE ${where}
     ORDER BY m.is_owner DESC, m.updated_at DESC, m.created_at DESC
     LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
  ).bind(...bindings, limit, (page - 1) * limit).all<MembershipRow>();
  const count = Number(total?.n ?? 0);
  return json({
    items: (rows.results ?? []).map(serialize),
    page,
    limit,
    total: count,
    totalPages: Math.ceil(count / limit),
  });
}

async function staffByUserId(env: StaffEnv, userId: string): Promise<Response> {
  const membership = await getMembership(env, userId);
  if (!membership) return fail('NOT_FOUND', 'Staff membership not found', 404);
  return json(serialize(membership));
}

async function auditLogs(env: StaffEnv, userId: string, url: URL): Promise<Response> {
  const page = integerParam(url.searchParams.get('page'), 1, 1_000_000);
  const limit = integerParam(url.searchParams.get('limit'), 20, 100);
  const total = await env.DB.prepare(
    `SELECT count(*) AS n FROM native_admin_staff_audit_logs WHERE staff_user_id = ?1`,
  ).bind(userId).first<{ n: number }>();
  const rows = await env.DB.prepare(
    `SELECT id, staff_user_id, staff_email, staff_username, actor_user_id, actor_email, actor_username, action, metadata, created_at
     FROM native_admin_staff_audit_logs WHERE staff_user_id = ?1
     ORDER BY created_at DESC LIMIT ?2 OFFSET ?3`,
  ).bind(userId, limit, (page - 1) * limit).all<Record<string, string | null>>();
  const count = Number(total?.n ?? 0);
  return json({
    items: (rows.results ?? []).map((row) => {
      let metadata: unknown = null;
      if (row.metadata) {
        try { metadata = JSON.parse(row.metadata); } catch { metadata = null; }
      }
      return {
        id: row.id,
        staffUserId: row.staff_user_id,
        staffEmail: row.staff_email,
        staffUsername: row.staff_username,
        actorUserId: row.actor_user_id,
        actorEmail: row.actor_email,
        actorUsername: row.actor_username,
        action: row.action,
        metadata,
        createdAt: row.created_at,
      };
    }),
    page,
    limit,
    total: count,
    totalPages: Math.ceil(count / limit),
  });
}

async function createStaff(env: StaffEnv, actor: StaffActor, body: Record<string, unknown>): Promise<Response> {
  const adminRole = assertValidRole(body.role);
  const { extraPermissions, revokedPermissions } = normalizeOverrides(adminRole, body.extraPermissions, body.revokedPermissions);
  const resolved = resolveAdminAccess({
    role: adminRole,
    status: typeof body.status === 'string' ? body.status : null,
    isOwner: Boolean(body.isOwner),
    extraPermissions,
    revokedPermissions,
  });
  if (!resolved) throw new StaffError('Failed to resolve admin access', 'VALIDATION_ERROR', 400);
  assertActorCanManageResolvedAccess(actor, resolved);

  const normalizedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const normalizedUsername = typeof body.username === 'string' ? body.username.trim() : '';
  if (!body.userId && !normalizedEmail) {
    throw new StaffError('email or userId is required', 'VALIDATION_ERROR', 400);
  }
  const existingUser = body.userId
    ? await findNativeUserById(env, String(body.userId))
    : normalizedEmail
      ? await findNativeUserByEmail(env, normalizedEmail)
      : null;

  let userId = existingUser?.id;
  if (!existingUser) {
    if (!normalizedEmail || normalizedUsername.length < 3) {
      throw new StaffError('email and username are required when creating a new staff account', 'VALIDATION_ERROR', 400);
    }
    const temporaryPassword = typeof body.password === 'string' && body.password ? body.password : `staff-${crypto.randomUUID()}`;
    const createdId = crypto.randomUUID();
    await createNativeUser(
      env,
      { id: createdId, email: normalizedEmail, username: normalizedUsername, role: 'USER', avatar: null },
      temporaryPassword,
    );
    userId = createdId;
  }
  if (!userId) throw new StaffError('Unable to resolve user account for staff membership', 'INTERNAL_SERVER_ERROR', 500);

  const existingMembership = await env.DB.prepare('SELECT id FROM native_admin_memberships WHERE user_id = ?1').bind(userId).first();
  if (existingMembership) throw new StaffError('User already has staff access', 'CONFLICT', 409);

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_admin_memberships
      (id, user_id, role, status, is_owner, extra_permissions, revoked_permissions, created_by_user_id, updated_by_user_id, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9, ?9)`,
  ).bind(
    crypto.randomUUID(), userId, resolved.role, resolved.status, resolved.isOwner ? 1 : 0,
    JSON.stringify(resolved.extraPermissions), JSON.stringify(resolved.revokedPermissions),
    actor.userId, now,
  ).run();

  const staffUser = await findNativeUserById(env, userId);
  const serialized = serialize((await getMembership(env, userId))!);
  let invitationSent = false;
  let invitationSkipped: string | null = null;
  let invitationError: string | null = null;
  if (staffUser && staffUser.email_verified !== 1) {
    try {
      await sendNativeVerificationCode(env, { id: staffUser.id, email: staffUser.email, username: staffUser.username });
      invitationSent = true;
    } catch (cause) {
      invitationError = cause instanceof Error ? cause.message : 'invitation failed';
    }
  } else if (staffUser) {
    invitationSkipped = 'already_verified';
  }
  await writeAuditLog(env, {
    staffUserId: userId,
    staffEmail: String(serialized.email),
    staffUsername: String(serialized.username),
    actorUserId: actor.userId,
    action: 'STAFF_ACCESS_GRANTED',
    metadata: {
      adminRole: serialized.adminRole,
      status: serialized.status,
      isOwner: serialized.isOwner,
      effectivePermissions: serialized.effectivePermissions,
      extraPermissions: serialized.extraPermissions,
      revokedPermissions: serialized.revokedPermissions,
      invitationSent,
      invitationSkipped,
      invitationError,
    },
  });
  return json(serialized, 201);
}

async function updateStaff(env: StaffEnv, actor: StaffActor, userId: string, body: Record<string, unknown>): Promise<Response> {
  const existing = await getMembership(env, userId);
  if (!existing) return fail('NOT_FOUND', 'Staff membership not found', 404);
  assertActorCanManageExisting(actor, existing);

  const adminRole = assertValidRole(body.role);
  const { extraPermissions, revokedPermissions } = normalizeOverrides(adminRole, body.extraPermissions, body.revokedPermissions);
  const resolved = resolveAdminAccess({
    role: adminRole,
    status: typeof body.status === 'string' ? body.status : null,
    isOwner: body.isOwner === undefined ? existing.is_owner === 1 : Boolean(body.isOwner),
    extraPermissions,
    revokedPermissions,
  });
  if (!resolved) throw new StaffError('Failed to resolve admin access', 'VALIDATION_ERROR', 400);
  assertActorCanManageResolvedAccess(actor, resolved);

  const currentAccess = membershipAccess(existing);
  if (currentAccess?.isOwner && (!resolved.isOwner || resolved.status !== 'ACTIVE')) {
    await ensureNotRemovingLastOwner(env, userId);
  }

  const previous = serialize(existing);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE native_admin_memberships
     SET role = ?1, status = ?2, is_owner = ?3, extra_permissions = ?4, revoked_permissions = ?5,
         updated_by_user_id = ?6, updated_at = ?7
     WHERE user_id = ?8`,
  ).bind(
    resolved.role, resolved.status, resolved.isOwner ? 1 : 0,
    JSON.stringify(resolved.extraPermissions), JSON.stringify(resolved.revokedPermissions),
    actor.userId, now, userId,
  ).run();
  const serialized = serialize((await getMembership(env, userId))!);
  await writeAuditLog(env, {
    staffUserId: userId,
    staffEmail: String(serialized.email),
    staffUsername: String(serialized.username),
    actorUserId: actor.userId,
    action: 'STAFF_ACCESS_UPDATED',
    metadata: {
      previous: { adminRole: previous.adminRole, status: previous.status, isOwner: previous.isOwner, effectivePermissions: previous.effectivePermissions },
      next: { adminRole: serialized.adminRole, status: serialized.status, isOwner: serialized.isOwner, effectivePermissions: serialized.effectivePermissions },
    },
  });
  return json(serialized);
}

async function removeStaff(env: StaffEnv, actor: StaffActor, userId: string): Promise<Response> {
  const existing = await getMembership(env, userId);
  if (!existing) return fail('NOT_FOUND', 'Staff membership not found', 404);
  assertActorCanManageExisting(actor, existing);
  const access = membershipAccess(existing);
  if (access?.isOwner) await ensureNotRemovingLastOwner(env, userId);
  const serialized = serialize(existing);
  await env.DB.prepare('DELETE FROM native_admin_memberships WHERE user_id = ?1').bind(userId).run();
  await writeAuditLog(env, {
    staffUserId: userId,
    staffEmail: String(serialized.email),
    staffUsername: String(serialized.username),
    actorUserId: actor.userId,
    action: 'STAFF_ACCESS_REMOVED',
    metadata: {
      adminRole: serialized.adminRole,
      status: serialized.status,
      isOwner: serialized.isOwner,
      effectivePermissions: serialized.effectivePermissions,
    },
  });
  return json({ userId, removed: true });
}

async function resendInvite(env: StaffEnv, actor: StaffActor, userId: string): Promise<Response> {
  const existing = await getMembership(env, userId);
  if (!existing) return fail('NOT_FOUND', 'Staff membership not found', 404);
  assertActorCanManageExisting(actor, existing);
  if (existing.email_verified === 1) {
    throw new StaffError('Staff account email is already verified', 'ALREADY_VERIFIED', 409);
  }
  try {
    await sendNativeVerificationCode(env, { id: existing.user_id, email: existing.email, username: existing.username });
  } catch (cause) {
    throw new StaffError(cause instanceof Error ? cause.message : 'Failed to send staff invitation', 'INVITE_SEND_FAILED', 502);
  }
  const serialized = serialize(existing);
  await writeAuditLog(env, {
    staffUserId: existing.user_id,
    staffEmail: existing.email,
    staffUsername: existing.username,
    actorUserId: actor.userId,
    action: 'STAFF_INVITE_RESENT',
    metadata: { adminRole: serialized.adminRole, status: serialized.status },
  });
  return json({ userId, invited: true, invitedAt: new Date().toISOString() });
}

function roleCatalog() {
  return Object.values(ADMIN_ROLES).map((role) => ({
    role,
    label: titleCaseFromKey(role.toLowerCase()),
    permissions: [...getDefaultPermissionsForAdminRole(role)],
  }));
}

function permissionCatalog() {
  return Object.entries(ADMIN_PERMISSION_GROUPS).map(([group, permissions]) => ({
    group,
    label: titleCaseFromKey(group.toLowerCase()),
    permissions: permissions.map((permission) => ({
      key: permission,
      label: titleCaseFromKey(permission),
      description: `Allows ${titleCaseFromKey(permission).toLowerCase()}`,
    })),
  }));
}

async function actorFor(env: StaffEnv, userId: string): Promise<StaffActor> {
  const membership = await getMembership(env, userId);
  const access = membership ? membershipAccess(membership) : null;
  if (access) return { userId, permissions: access.permissions, isOwner: access.isOwner };
  const user = await findNativeUserById(env, userId);
  const legacy = resolveAdminAccess({ role: user?.role ?? null });
  return { userId, permissions: legacy?.permissions ?? [], isOwner: legacy?.isOwner ?? false };
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.clone().json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function tryNativeAdminStaff(request: Request, env: StaffEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/v1/admin/staff')) return null;

  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return fail('UNAUTHORIZED', 'Administrator authentication is required', 401);

  const method = request.method;
  const isCollection = url.pathname === '/api/v1/admin/staff';
  const isRoles = url.pathname === '/api/v1/admin/staff/roles' && method === 'GET';
  const isPermissions = url.pathname === '/api/v1/admin/staff/permissions' && method === 'GET';
  const subMatch = url.pathname.match(/^\/api\/v1\/admin\/staff\/([^/]+?)(\/(audit|invite))?$/);
  if (!isCollection && !isRoles && !isPermissions && !subMatch) return null;

  const actor = await actorFor(env, admin.id);
  const requiredPermission = method === 'GET' ? ADMIN_PERMISSIONS.STAFF_READ : ADMIN_PERMISSIONS.STAFF_WRITE;
  if (!actor.permissions.includes(requiredPermission)) {
    return fail('FORBIDDEN', 'Staff management permission is required', 403);
  }

  try {
    if (isRoles) return json(roleCatalog());
    if (isPermissions) return json(permissionCatalog());
    if (isCollection && method === 'GET') return await listStaff(env, url);
    if (isCollection && method === 'POST') return await createStaff(env, actor, await readBody(request));
    if (subMatch && !isRoles && !isPermissions) {
      const userId = decodeURIComponent(subMatch[1]!);
      const segment = subMatch[3];
      if (segment === 'audit' && method === 'GET') return await auditLogs(env, userId, url);
      if (segment === 'invite' && method === 'POST') return await resendInvite(env, actor, userId);
      if (!segment && method === 'GET') return await staffByUserId(env, userId);
      if (!segment && method === 'PATCH') return await updateStaff(env, actor, userId, await readBody(request));
      if (!segment && method === 'DELETE') return await removeStaff(env, actor, userId);
    }
    return fail('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
  } catch (error) {
    if (error instanceof StaffError) return fail(error.code, error.message, error.statusCode);
    throw error;
  }
}
