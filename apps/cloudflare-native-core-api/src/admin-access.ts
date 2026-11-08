/**
 * Admin access resolution + permission gate for native admin routes.
 *
 * Loads the caller's effective access (role defaults + extra_permissions −
 * revoked_permissions) from native_admin_memberships, falling back to the
 * legacy native_users.role for accounts created before memberships existed.
 * Use requireAdminPermission in route families to enforce RBAC — admin
 * membership roles (e.g. SUPPORT_AGENT) only authenticate, they do not
 * automatically get every admin surface.
 */

import type { NativeAuthEnv, PublicUser } from './auth';
import {
  type AdminPermission,
  type ResolvedAdminAccess,
  resolveAdminAccess,
} from './native-rbac';

interface MembershipRow {
  role: string;
  status: string;
  is_owner: number;
  extra_permissions: string;
  revoked_permissions: string;
}

export async function resolveNativeAdminAccess(
  env: NativeAuthEnv,
  adminUserId: string,
  fallbackRole?: string | null,
): Promise<ResolvedAdminAccess | null> {
  let membership: MembershipRow | null = null;
  try {
    membership = env.DB
      ? await env.DB.prepare(
          'SELECT role, status, is_owner, extra_permissions, revoked_permissions FROM native_admin_memberships WHERE user_id = ?1',
        ).bind(adminUserId).first<MembershipRow>()
      : null;
  } catch {
    // Probe failure falls back to the legacy role below (fail-soft to the
    // pre-membership behavior rather than locking operators out).
    membership = null;
  }
  if (membership) {
    return resolveAdminAccess({
      role: membership.role,
      status: membership.status,
      isOwner: membership.is_owner === 1,
      extraPermissions: membership.extra_permissions,
      revokedPermissions: membership.revoked_permissions,
    });
  }
  if (fallbackRole) {
    return resolveAdminAccess({ role: fallbackRole });
  }
  return null;
}

export function adminHasPermission(
  access: ResolvedAdminAccess | null,
  permission: AdminPermission,
): boolean {
  if (!access) return false;
  if (access.status !== 'ACTIVE') return false;
  return access.permissions.includes(permission);
}

export type AdminPermissionGate =
  | { ok: true; admin: PublicUser; access: ResolvedAdminAccess }
  | { ok: false; response: Response };

export async function requireAdminPermission(
  request: Request,
  env: NativeAuthEnv,
  permission: AdminPermission,
): Promise<AdminPermissionGate> {
  // Lazy import: a static dependency would drag the auth -> email -> SMTP
  // (cloudflare:sockets) chain into every consumer, breaking vitest suites
  // for route families that never touch auth.
  const { authenticateNativeAdmin } = await import('./auth');
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } },
        { status: 401, headers: { 'cache-control': 'no-store' } },
      ),
    };
  }
  const access = await resolveNativeAdminAccess(env, admin.id, admin.role);
  if (!access || !adminHasPermission(access, permission)) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: `Permission required: ${permission}` } },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      ),
    };
  }
  return { ok: true, admin, access };
}
