export const ADMIN_ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  CATALOG_MANAGER: 'CATALOG_MANAGER',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  SUPPORT_AGENT: 'SUPPORT_AGENT',
  ANALYST: 'ANALYST',
} as const;

export type AdminRole = typeof ADMIN_ROLES[keyof typeof ADMIN_ROLES];

export const ADMIN_PERMISSIONS = {
  DASHBOARD_READ: 'dashboard.read',
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_WRITE: 'customers.write',
  CUSTOMERS_CREDENTIALS_RESET: 'customers.credentials.reset',
  STAFF_READ: 'staff.read',
  STAFF_WRITE: 'staff.write',
  PRODUCTS_READ: 'products.read',
  PRODUCTS_WRITE: 'products.write',
  PRODUCTS_SOURCE_ACK: 'products.source.ack',
  ORDERS_READ: 'orders.read',
  ORDERS_WRITE: 'orders.write',
  ORDERS_REFUND: 'orders.refund',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_WRITE: 'inventory.write',
  INVENTORY_FORECAST: 'inventory.forecast',
  THEMES_READ: 'themes.read',
  THEMES_WRITE: 'themes.write',
  PLUGINS_READ: 'plugins.read',
  PLUGINS_WRITE: 'plugins.write',
  MARKET_READ: 'market.read',
  MARKET_INSTALL: 'market.install',
  PLATFORM_CONNECTION_READ: 'platformConnection.read',
  PLATFORM_CONNECTION_WRITE: 'platformConnection.write',
  STORE_READ: 'store.read',
  STORE_WRITE: 'store.write',
  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',
  HEALTH_READ: 'health.read',
  WEBHOOKS_READ: 'webhooks.read',
  WEBHOOKS_WRITE: 'webhooks.write',
  CATALOG_IMPORT_RUN: 'catalogImport.run',
} as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[keyof typeof ADMIN_PERMISSIONS];

export const ADMIN_PERMISSION_GROUPS = {
  DASHBOARD: [ADMIN_PERMISSIONS.DASHBOARD_READ],
  CUSTOMERS: [
    ADMIN_PERMISSIONS.CUSTOMERS_READ,
    ADMIN_PERMISSIONS.CUSTOMERS_WRITE,
    ADMIN_PERMISSIONS.CUSTOMERS_CREDENTIALS_RESET,
  ],
  STAFF: [
    ADMIN_PERMISSIONS.STAFF_READ,
    ADMIN_PERMISSIONS.STAFF_WRITE,
  ],
  PRODUCTS: [
    ADMIN_PERMISSIONS.PRODUCTS_READ,
    ADMIN_PERMISSIONS.PRODUCTS_WRITE,
    ADMIN_PERMISSIONS.PRODUCTS_SOURCE_ACK,
  ],
  ORDERS: [
    ADMIN_PERMISSIONS.ORDERS_READ,
    ADMIN_PERMISSIONS.ORDERS_WRITE,
    ADMIN_PERMISSIONS.ORDERS_REFUND,
  ],
  INVENTORY: [
    ADMIN_PERMISSIONS.INVENTORY_READ,
    ADMIN_PERMISSIONS.INVENTORY_WRITE,
    ADMIN_PERMISSIONS.INVENTORY_FORECAST,
  ],
  THEMES: [
    ADMIN_PERMISSIONS.THEMES_READ,
    ADMIN_PERMISSIONS.THEMES_WRITE,
  ],
  PLUGINS: [
    ADMIN_PERMISSIONS.PLUGINS_READ,
    ADMIN_PERMISSIONS.PLUGINS_WRITE,
  ],
  MARKET: [
    ADMIN_PERMISSIONS.MARKET_READ,
    ADMIN_PERMISSIONS.MARKET_INSTALL,
  ],
  PLATFORM_CONNECTION: [
    ADMIN_PERMISSIONS.PLATFORM_CONNECTION_READ,
    ADMIN_PERMISSIONS.PLATFORM_CONNECTION_WRITE,
  ],
  STORE: [
    ADMIN_PERMISSIONS.STORE_READ,
    ADMIN_PERMISSIONS.STORE_WRITE,
  ],
  SETTINGS: [
    ADMIN_PERMISSIONS.SETTINGS_READ,
    ADMIN_PERMISSIONS.SETTINGS_WRITE,
  ],
  HEALTH: [ADMIN_PERMISSIONS.HEALTH_READ],
  WEBHOOKS: [
    ADMIN_PERMISSIONS.WEBHOOKS_READ,
    ADMIN_PERMISSIONS.WEBHOOKS_WRITE,
  ],
  CATALOG_IMPORT: [ADMIN_PERMISSIONS.CATALOG_IMPORT_RUN],
} as const satisfies Record<string, readonly AdminPermission[]>;

const ALL_ADMIN_PERMISSIONS = Object.values(ADMIN_PERMISSIONS) as AdminPermission[];

export const DEFAULT_ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  OWNER: ALL_ADMIN_PERMISSIONS,
  // Owner-only safeguards are enforced in application logic (for example,
  // preventing non-owners from assigning OWNER or removing the last owner).
  ADMIN: ALL_ADMIN_PERMISSIONS,
  CATALOG_MANAGER: [
    ADMIN_PERMISSIONS.DASHBOARD_READ,
    ADMIN_PERMISSIONS.PRODUCTS_READ,
    ADMIN_PERMISSIONS.PRODUCTS_WRITE,
    ADMIN_PERMISSIONS.PRODUCTS_SOURCE_ACK,
    ADMIN_PERMISSIONS.INVENTORY_READ,
    ADMIN_PERMISSIONS.THEMES_READ,
    ADMIN_PERMISSIONS.THEMES_WRITE,
    ADMIN_PERMISSIONS.MARKET_READ,
  ],
  OPERATIONS_MANAGER: [
    ADMIN_PERMISSIONS.DASHBOARD_READ,
    ADMIN_PERMISSIONS.CUSTOMERS_READ,
    ADMIN_PERMISSIONS.CUSTOMERS_WRITE,
    ADMIN_PERMISSIONS.ORDERS_READ,
    ADMIN_PERMISSIONS.ORDERS_WRITE,
    ADMIN_PERMISSIONS.ORDERS_REFUND,
    ADMIN_PERMISSIONS.INVENTORY_READ,
    ADMIN_PERMISSIONS.INVENTORY_WRITE,
    ADMIN_PERMISSIONS.INVENTORY_FORECAST,
    ADMIN_PERMISSIONS.HEALTH_READ,
  ],
  SUPPORT_AGENT: [
    ADMIN_PERMISSIONS.DASHBOARD_READ,
    ADMIN_PERMISSIONS.CUSTOMERS_READ,
    ADMIN_PERMISSIONS.CUSTOMERS_WRITE,
    ADMIN_PERMISSIONS.CUSTOMERS_CREDENTIALS_RESET,
    ADMIN_PERMISSIONS.ORDERS_READ,
    ADMIN_PERMISSIONS.ORDERS_WRITE,
  ],
  ANALYST: [
    ADMIN_PERMISSIONS.DASHBOARD_READ,
    ADMIN_PERMISSIONS.CUSTOMERS_READ,
    ADMIN_PERMISSIONS.PRODUCTS_READ,
    ADMIN_PERMISSIONS.ORDERS_READ,
    ADMIN_PERMISSIONS.INVENTORY_READ,
    ADMIN_PERMISSIONS.THEMES_READ,
    ADMIN_PERMISSIONS.PLUGINS_READ,
    ADMIN_PERMISSIONS.MARKET_READ,
    ADMIN_PERMISSIONS.HEALTH_READ,
  ],
};

export interface AdminAccessProfile {
  role: AdminRole;
  permissions: readonly AdminPermission[];
  isOwner?: boolean;
  status?: 'ACTIVE' | 'SUSPENDED';
}

export function getDefaultPermissionsForAdminRole(role: AdminRole): readonly AdminPermission[] {
  return DEFAULT_ADMIN_ROLE_PERMISSIONS[role];
}

export function hasAdminPermission(
  grantedPermissions: readonly string[] | undefined,
  requiredPermission: AdminPermission
): boolean {
  if (!grantedPermissions || grantedPermissions.length === 0) {
    return false;
  }

  const granted = new Set(grantedPermissions);
  return granted.has('*') || granted.has(requiredPermission);
}

export function hasAnyAdminPermission(
  grantedPermissions: readonly string[] | undefined,
  requiredPermissions: readonly AdminPermission[]
): boolean {
  if (!grantedPermissions || grantedPermissions.length === 0) {
    return false;
  }

  return requiredPermissions.some((permission) =>
    hasAdminPermission(grantedPermissions, permission)
  );
}

export function hasAllAdminPermissions(
  grantedPermissions: readonly string[] | undefined,
  requiredPermissions: readonly AdminPermission[]
): boolean {
  if (!grantedPermissions || grantedPermissions.length === 0) {
    return false;
  }

  return requiredPermissions.every((permission) =>
    hasAdminPermission(grantedPermissions, permission)
  );
}
