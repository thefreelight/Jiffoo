import { describe, expect, it } from 'vitest';
import { ADMIN_PERMISSIONS, ADMIN_ROLES } from 'shared';

import {
  canAccessAnyPermission,
  getFirstAccessibleAdminPath,
  getRequiredPermissionsForAdminPath,
  getSystemNavHref,
  getUserPermissions,
  hasAdminWorkspaceAccess,
} from '../../lib/admin-access';

function adminUser(overrides: Record<string, unknown> = {}) {
  return {
    role: ADMIN_ROLES.ANALYST,
    permissions: [],
    ...overrides,
  } as any;
}

describe('Admin access policy', () => {
  it('derives permissions from modern and legacy admin roles', () => {
    expect(getUserPermissions(adminUser({ role: ADMIN_ROLES.ANALYST }))).toContain(
      ADMIN_PERMISSIONS.PLUGINS_READ,
    );
    expect(getUserPermissions(adminUser({ role: 'TENANT_ADMIN' }))).toContain(
      ADMIN_PERMISSIONS.STAFF_WRITE,
    );
    expect(getUserPermissions(adminUser({ role: 'SUPER_ADMIN' }))).toContain(
      ADMIN_PERMISSIONS.SETTINGS_WRITE,
    );
  });

  it('uses explicit permission grants ahead of role defaults', () => {
    expect(getUserPermissions(adminUser({
      role: ADMIN_ROLES.OWNER,
      permissions: [ADMIN_PERMISSIONS.THEMES_READ],
    }))).toEqual([ADMIN_PERMISSIONS.THEMES_READ]);
  });

  it('denies suspended staff even when they still have grants', () => {
    const suspended = adminUser({
      adminStatus: 'SUSPENDED',
      permissions: [ADMIN_PERMISSIONS.DASHBOARD_READ],
    });

    expect(hasAdminWorkspaceAccess(suspended)).toBe(false);
    expect(canAccessAnyPermission(suspended, [ADMIN_PERMISSIONS.DASHBOARD_READ])).toBe(false);
  });

  it.each([
    ['/en/dashboard', ADMIN_PERMISSIONS.DASHBOARD_READ],
    ['/en/products', ADMIN_PERMISSIONS.PRODUCTS_READ],
    ['/en/products/new', ADMIN_PERMISSIONS.PRODUCTS_WRITE],
    ['/en/products/sku_123/edit', ADMIN_PERMISSIONS.PRODUCTS_WRITE],
    ['/en/inventory/alerts', ADMIN_PERMISSIONS.INVENTORY_FORECAST],
    ['/en/orders', ADMIN_PERMISSIONS.ORDERS_READ],
    ['/en/customers', ADMIN_PERMISSIONS.CUSTOMERS_READ],
    ['/en/staff', ADMIN_PERMISSIONS.STAFF_READ],
    ['/en/plugins', ADMIN_PERMISSIONS.PLUGINS_READ],
    ['/en/themes', ADMIN_PERMISSIONS.THEMES_READ],
    ['/en/settings', ADMIN_PERMISSIONS.SETTINGS_READ],
    ['/en/system/updates', ADMIN_PERMISSIONS.SETTINGS_READ],
    ['/en/system/health', ADMIN_PERMISSIONS.HEALTH_READ],
    ['/en/errors', ADMIN_PERMISSIONS.HEALTH_READ],
  ])('maps %s to %s', (pathname, permission) => {
    expect(getRequiredPermissionsForAdminPath(pathname, 'en')).toEqual([permission]);
  });

  it('leaves profile-style pages unrestricted by route map', () => {
    expect(getRequiredPermissionsForAdminPath('/en/profile', 'en')).toBeUndefined();
  });

  it('routes system navigation to the first surface the staff member can actually read', () => {
    expect(getSystemNavHref(adminUser({
      permissions: [ADMIN_PERMISSIONS.SETTINGS_READ],
    }), 'en')).toBe('/en/system/updates');

    expect(getSystemNavHref(adminUser({
      permissions: [ADMIN_PERMISSIONS.HEALTH_READ],
    }), 'en')).toBe('/en/system/health');
  });

  it('chooses the first accessible Admin landing path by permission order', () => {
    expect(getFirstAccessibleAdminPath(adminUser({
      permissions: [ADMIN_PERMISSIONS.PLUGINS_READ],
    }), 'en')).toBe('/en/plugins');

    expect(getFirstAccessibleAdminPath(adminUser({
      permissions: [ADMIN_PERMISSIONS.HEALTH_READ],
    }), 'en')).toBe('/en/system/health');

    expect(getFirstAccessibleAdminPath(adminUser({
      permissions: [],
      role: 'USER',
    }), 'en')).toBe('/en/profile');
  });
});
