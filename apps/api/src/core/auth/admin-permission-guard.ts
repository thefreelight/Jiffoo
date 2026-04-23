import { FastifyReply, FastifyRequest } from 'fastify';
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
  type AdminPermission,
} from 'shared';
import { sendError } from '@/utils/response';
import { hasAdminAccessRole, resolveAdminPermissionsForRole } from './admin-access';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const PUBLIC_ADMIN_ROUTES = new Set([
  '/admin/commercial-package/branding',
  '/admin/integrations/catalog-import/sync-batch',
]);

function normalizeAdminPath(requestUrl: string): string {
  const pathname = requestUrl.split('?')[0] || '/';

  if (pathname.startsWith('/api/v1/')) {
    return pathname.slice('/api/v1'.length) || '/';
  }

  if (pathname.startsWith('/api/')) {
    return pathname.slice('/api'.length) || '/';
  }

  return pathname;
}

function isAdminProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/extensions');
}

function isReadMethod(method: string): boolean {
  return READ_METHODS.has(method.toUpperCase());
}

function isForecastingInventoryPath(pathname: string): boolean {
  return pathname === '/admin/inventory/dashboard'
    || pathname === '/admin/inventory/stats'
    || pathname === '/admin/inventory/forecast'
    || pathname === '/admin/inventory/recompute-all'
    || pathname.startsWith('/admin/inventory/alerts/')
    || pathname.startsWith('/admin/inventory/accuracy/');
}

function resolveRequiredPermission(method: string, pathname: string): AdminPermission | null {
  if (pathname.startsWith('/admin/dashboard')) {
    return ADMIN_PERMISSIONS.DASHBOARD_READ;
  }

  if (pathname.startsWith('/admin/users')) {
    if (pathname.endsWith('/reset-password')) {
      return ADMIN_PERMISSIONS.CUSTOMERS_CREDENTIALS_RESET;
    }

    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.CUSTOMERS_READ
      : ADMIN_PERMISSIONS.CUSTOMERS_WRITE;
  }

  if (pathname.startsWith('/admin/staff')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.STAFF_READ
      : ADMIN_PERMISSIONS.STAFF_WRITE;
  }

  if (pathname.startsWith('/admin/products')) {
    if (pathname.includes('/ack-source-change')) {
      return ADMIN_PERMISSIONS.PRODUCTS_SOURCE_ACK;
    }

    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.PRODUCTS_READ
      : ADMIN_PERMISSIONS.PRODUCTS_WRITE;
  }

  if (pathname.startsWith('/admin/orders')) {
    if (pathname.endsWith('/refund')) {
      return ADMIN_PERMISSIONS.ORDERS_REFUND;
    }

    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.ORDERS_READ
      : ADMIN_PERMISSIONS.ORDERS_WRITE;
  }

  if (pathname.startsWith('/admin/warehouses') || pathname.startsWith('/admin/stock-alerts')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.INVENTORY_READ
      : ADMIN_PERMISSIONS.INVENTORY_WRITE;
  }

  if (pathname.startsWith('/admin/inventory')) {
    if (isForecastingInventoryPath(pathname)) {
      return ADMIN_PERMISSIONS.INVENTORY_FORECAST;
    }

    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.INVENTORY_READ
      : ADMIN_PERMISSIONS.INVENTORY_WRITE;
  }

  if (pathname.startsWith('/admin/themes')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.THEMES_READ
      : ADMIN_PERMISSIONS.THEMES_WRITE;
  }

  if (pathname.startsWith('/extensions')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.PLUGINS_READ
      : ADMIN_PERMISSIONS.PLUGINS_WRITE;
  }

  if (pathname.startsWith('/admin/market')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.MARKET_READ
      : ADMIN_PERMISSIONS.MARKET_INSTALL;
  }

  if (pathname.startsWith('/admin/platform/connection')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.PLATFORM_CONNECTION_READ
      : ADMIN_PERMISSIONS.PLATFORM_CONNECTION_WRITE;
  }

  if (pathname.startsWith('/admin/stores')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.STORE_READ
      : ADMIN_PERMISSIONS.STORE_WRITE;
  }

  if (pathname.startsWith('/admin/settings')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.SETTINGS_READ
      : ADMIN_PERMISSIONS.SETTINGS_WRITE;
  }

  if (pathname.startsWith('/admin/health') || pathname.startsWith('/admin/errors')) {
    return ADMIN_PERMISSIONS.HEALTH_READ;
  }

  if (pathname.startsWith('/admin/webhooks')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.WEBHOOKS_READ
      : ADMIN_PERMISSIONS.WEBHOOKS_WRITE;
  }

  if (pathname.startsWith('/admin/commercial-package')) {
    return isReadMethod(method)
      ? ADMIN_PERMISSIONS.SETTINGS_READ
      : ADMIN_PERMISSIONS.SETTINGS_WRITE;
  }

  return null;
}

export async function adminPermissionGuard(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const pathname = normalizeAdminPath(request.url);

  if (!isAdminProtectedPath(pathname) || PUBLIC_ADMIN_ROUTES.has(pathname)) {
    return;
  }

  if (!request.user) {
    return sendError(reply, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  const permissions =
    request.user.permissions && request.user.permissions.length > 0
      ? request.user.permissions
      : resolveAdminPermissionsForRole(request.user.adminRole ?? request.user.role);

  if (
    !hasAdminAccessRole(request.user.adminRole ?? request.user.role)
    || (request.user.admin && request.user.admin.status !== 'ACTIVE')
    || permissions.length === 0
  ) {
    return sendError(reply, 403, 'FORBIDDEN', 'Admin access required');
  }

  const requiredPermission = resolveRequiredPermission(request.method, pathname);
  if (!requiredPermission) {
    return;
  }

  if (!hasAdminPermission(permissions, requiredPermission)) {
    return sendError(reply, 403, 'FORBIDDEN', `Missing permission: ${requiredPermission}`);
  }
}
