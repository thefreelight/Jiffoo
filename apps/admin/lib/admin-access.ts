import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  getDefaultPermissionsForAdminRole,
  hasAnyAdminPermission,
  type AdminPermission,
  type AdminRole,
  type UserProfile,
} from 'shared';

type AdminUser = Pick<UserProfile, 'role' | 'permissions' | 'admin' | 'adminStatus'> | null | undefined;

const LEGACY_ADMIN_ROLE_ALIASES: Record<string, AdminRole> = {
  SUPER_ADMIN: ADMIN_ROLES.OWNER,
  TENANT_ADMIN: ADMIN_ROLES.ADMIN,
};

const ADMIN_ROLE_SET = new Set<AdminRole>(Object.values(ADMIN_ROLES) as AdminRole[]);

function resolveAdminRole(role?: string | null): AdminRole | null {
  if (!role) {
    return null;
  }

  if (role in LEGACY_ADMIN_ROLE_ALIASES) {
    return LEGACY_ADMIN_ROLE_ALIASES[role];
  }

  return ADMIN_ROLE_SET.has(role as AdminRole) ? (role as AdminRole) : null;
}

function normalizeAdminPath(pathname: string, locale: string): string {
  const localePrefix = `/${locale}`;
  const stripped = pathname.startsWith(localePrefix)
    ? pathname.slice(localePrefix.length) || '/'
    : pathname;

  return stripped.replace(/\/+$/, '') || '/';
}

export function getUserPermissions(user: AdminUser): string[] {
  if (user?.permissions && user.permissions.length > 0) {
    return user.permissions;
  }

  const adminRole = resolveAdminRole(user?.role);
  return adminRole ? [...getDefaultPermissionsForAdminRole(adminRole)] : [];
}

export function hasAdminWorkspaceAccess(user: AdminUser): boolean {
  if (user?.admin?.status === 'SUSPENDED' || user?.adminStatus === 'SUSPENDED') {
    return false;
  }

  return getUserPermissions(user).length > 0;
}

export function canAccessAnyPermission(
  user: AdminUser,
  requiredPermissions?: readonly AdminPermission[],
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return hasAdminWorkspaceAccess(user);
  }

  return hasAnyAdminPermission(getUserPermissions(user), requiredPermissions);
}

export function getRequiredPermissionsForAdminPath(
  pathname: string,
  locale: string,
): readonly AdminPermission[] | undefined {
  const path = normalizeAdminPath(pathname, locale);

  if (path === '/' || path === '/dashboard' || path.startsWith('/dashboard/')) {
    return [ADMIN_PERMISSIONS.DASHBOARD_READ];
  }

  if (
    path === '/products/new'
    || path === '/products/create'
    || /^\/products\/[^/]+\/edit(?:\/.*)?$/.test(path)
  ) {
    return [ADMIN_PERMISSIONS.PRODUCTS_WRITE];
  }

  if (path.startsWith('/products')) {
    return [ADMIN_PERMISSIONS.PRODUCTS_READ];
  }

  if (path.startsWith('/inventory/alerts')) {
    return [ADMIN_PERMISSIONS.INVENTORY_FORECAST];
  }

  if (path.startsWith('/inventory')) {
    return [ADMIN_PERMISSIONS.INVENTORY_READ];
  }

  if (path.startsWith('/orders')) {
    return [ADMIN_PERMISSIONS.ORDERS_READ];
  }

  if (path.startsWith('/customers')) {
    return [ADMIN_PERMISSIONS.CUSTOMERS_READ];
  }

  if (path.startsWith('/staff')) {
    return [ADMIN_PERMISSIONS.STAFF_READ];
  }

  if (path.startsWith('/plugins')) {
    return [ADMIN_PERMISSIONS.PLUGINS_READ];
  }

  if (path.startsWith('/themes')) {
    return [ADMIN_PERMISSIONS.THEMES_READ];
  }

  if (path.startsWith('/package') || path.startsWith('/settings') || path.startsWith('/seo')) {
    return [ADMIN_PERMISSIONS.SETTINGS_READ];
  }

  if (path.startsWith('/system/health') || path.startsWith('/errors')) {
    return [ADMIN_PERMISSIONS.HEALTH_READ];
  }

  if (path.startsWith('/system')) {
    return [ADMIN_PERMISSIONS.SETTINGS_READ];
  }

  return undefined;
}

export function getSystemNavHref(user: AdminUser, locale: string): string {
  if (canAccessAnyPermission(user, [ADMIN_PERMISSIONS.SETTINGS_READ])) {
    return `/${locale}/system/updates`;
  }

  if (canAccessAnyPermission(user, [ADMIN_PERMISSIONS.HEALTH_READ])) {
    return `/${locale}/system/health`;
  }

  return `/${locale}/system/updates`;
}

export function getFirstAccessibleAdminPath(user: AdminUser, locale: string): string {
  const candidates: Array<{ href: string; permissions: readonly AdminPermission[] }> = [
    { href: `/${locale}/dashboard`, permissions: [ADMIN_PERMISSIONS.DASHBOARD_READ] },
    { href: `/${locale}/products`, permissions: [ADMIN_PERMISSIONS.PRODUCTS_READ] },
    { href: `/${locale}/inventory`, permissions: [ADMIN_PERMISSIONS.INVENTORY_READ] },
    { href: `/${locale}/orders`, permissions: [ADMIN_PERMISSIONS.ORDERS_READ] },
    { href: `/${locale}/customers`, permissions: [ADMIN_PERMISSIONS.CUSTOMERS_READ] },
    { href: `/${locale}/staff`, permissions: [ADMIN_PERMISSIONS.STAFF_READ] },
    { href: `/${locale}/plugins`, permissions: [ADMIN_PERMISSIONS.PLUGINS_READ] },
    { href: `/${locale}/themes`, permissions: [ADMIN_PERMISSIONS.THEMES_READ] },
    { href: `/${locale}/settings`, permissions: [ADMIN_PERMISSIONS.SETTINGS_READ] },
    { href: `/${locale}/system/health`, permissions: [ADMIN_PERMISSIONS.HEALTH_READ] },
  ];

  const firstVisible = candidates.find((candidate) =>
    canAccessAnyPermission(user, candidate.permissions)
  );

  return firstVisible?.href || `/${locale}/profile`;
}
