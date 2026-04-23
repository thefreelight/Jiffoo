import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  getDefaultPermissionsForAdminRole,
  type AdminPermission,
  type AdminRole,
} from 'shared';

const LEGACY_ADMIN_ROLE_ALIASES: Record<string, AdminRole> = {
  SUPER_ADMIN: ADMIN_ROLES.OWNER,
  TENANT_ADMIN: ADMIN_ROLES.ADMIN,
};

const ADMIN_ROLE_SET = new Set<AdminRole>(Object.values(ADMIN_ROLES) as AdminRole[]);
const KNOWN_ADMIN_PERMISSION_SET = new Set<string>(Object.values(ADMIN_PERMISSIONS));

export interface ResolvedAdminAccess {
  role: AdminRole;
  status: 'ACTIVE' | 'SUSPENDED';
  isOwner: boolean;
  permissions: AdminPermission[];
  extraPermissions: string[];
  revokedPermissions: string[];
}

export function resolveAdminRole(role?: string | null): AdminRole | null {
  if (!role) {
    return null;
  }

  if (role in LEGACY_ADMIN_ROLE_ALIASES) {
    return LEGACY_ADMIN_ROLE_ALIASES[role];
  }

  return ADMIN_ROLE_SET.has(role as AdminRole) ? (role as AdminRole) : null;
}

export function hasAdminAccessRole(role?: string | null): boolean {
  return resolveAdminRole(role) !== null;
}

export function isOwnerAdminRole(role?: string | null): boolean {
  return resolveAdminRole(role) === ADMIN_ROLES.OWNER;
}

export function resolveAdminPermissionsForRole(role?: string | null): AdminPermission[] {
  const adminRole = resolveAdminRole(role);
  return adminRole ? [...getDefaultPermissionsForAdminRole(adminRole)] : [];
}

export function normalizeAdminStatus(status?: string | null): 'ACTIVE' | 'SUSPENDED' {
  return status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
}

export function normalizePermissionList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && KNOWN_ADMIN_PERMISSION_SET.has(item))
    )
  );
}

export function resolveAdminAccess(input: {
  role?: string | null;
  status?: string | null;
  isOwner?: boolean | null;
  extraPermissions?: unknown;
  revokedPermissions?: unknown;
}): ResolvedAdminAccess | null {
  const adminRole = resolveAdminRole(input.role);
  if (!adminRole) {
    return null;
  }

  const basePermissions = new Set(resolveAdminPermissionsForRole(adminRole));
  const extraPermissions = normalizePermissionList(input.extraPermissions);
  const revokedPermissions = normalizePermissionList(input.revokedPermissions);

  for (const permission of extraPermissions) {
    basePermissions.add(permission as AdminPermission);
  }

  for (const permission of revokedPermissions) {
    basePermissions.delete(permission as AdminPermission);
  }

  return {
    role: adminRole,
    status: normalizeAdminStatus(input.status),
    isOwner: Boolean(input.isOwner) || adminRole === ADMIN_ROLES.OWNER,
    permissions: Array.from(basePermissions) as AdminPermission[],
    extraPermissions,
    revokedPermissions,
  };
}
