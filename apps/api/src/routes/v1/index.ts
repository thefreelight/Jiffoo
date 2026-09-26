/**
 * API Routes v1
 *
 * This module registers all v1 API routes.
 * Routes are registered under the /api/v1 prefix by the parent router.
 */

import { FastifyInstance } from 'fastify';

// Core routes
import { authRoutes } from '@/core/auth/routes';
import { apiTokenRoutes } from '@/core/auth/api-token-routes';
import { accountRoutes } from '@/core/account/routes';
import { productRoutes } from '@/core/product/routes';
import { cartRoutes } from '@/core/cart/routes';
import { orderRoutes } from '@/core/order/routes';
import { paymentRoutes } from '@/core/payment/routes';
import { checkoutRoutes } from '@/core/checkout/routes';

// Admin routes
import { adminUserRoutes } from '@/core/admin/user-management/routes';
import { customerPasswordResetLinkRoutes } from '@/core/admin/user-management/password-reset-link-routes';
import { adminProductRoutes } from '@/core/admin/product-management/routes';
import { adminOrderRoutes } from '@/core/admin/order-management/routes';
import { adminNotificationRoutes } from '@/core/admin/notifications/routes';
import systemSettingsRoutes from '@/core/admin/system-settings/routes';
import { adminDashboardRoutes } from '@/core/admin/dashboard/routes';
import { adminStaffRoutes } from '@/core/admin/staff-management/routes';
import { healthMonitoringRoutes } from '@/core/admin/health-monitoring/routes';
import { adminInventoryRoutes } from '@/core/inventory/routes';
import { webhookRoutes } from '@/core/webhooks/routes';
import { installRoutes } from '@/core/install/routes';

// Extension installer routes
import { extensionInstallerRoutes } from '@/core/admin/extension-installer/routes';
import { publicThemeAssetRoutes } from '@/core/admin/extension-installer/theme-routes';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
// Store routes
import { storeRoutes } from '@/core/store/routes';

/**
 * Register all v1 API routes
 * Note: Parent router adds /api/v1 prefix, so routes here are relative to that
 */
export async function registerV1Routes(fastify: FastifyInstance) {
  // Authentication routes
  await fastify.register(authRoutes, { prefix: '/auth' });

  // User account routes
  await fastify.register(accountRoutes, { prefix: '/account' });

  // Admin routes
  await fastify.register(async (admin) => {
    admin.addHook('onRequest', authMiddleware);
    admin.addHook('onRequest', requireAdmin);
    await admin.register(adminUserRoutes, { prefix: '/users' });
    await admin.register(customerPasswordResetLinkRoutes, { prefix: '/customers' });
    await admin.register(adminProductRoutes, { prefix: '/products' });
    await admin.register(adminOrderRoutes, { prefix: '/orders' });
    await admin.register(adminNotificationRoutes, { prefix: '/notifications' });
    await admin.register(adminStaffRoutes, { prefix: '/staff' });
    await admin.register(adminInventoryRoutes, { prefix: '/inventory' });
    await admin.register(systemSettingsRoutes);
    await admin.register(apiTokenRoutes, { prefix: '/api-tokens' });
    await admin.register(adminDashboardRoutes);
    await admin.register(healthMonitoringRoutes);
    await admin.register(webhookRoutes, { prefix: '/webhooks' });
  }, { prefix: '/admin' });

  // Store context routes
  await fastify.register(storeRoutes, { prefix: '/store' });

  // Public routes
  await fastify.register(productRoutes, { prefix: '/products' });
  await fastify.register(cartRoutes, { prefix: '/cart' });
  await fastify.register(orderRoutes, { prefix: '/orders' });
  await fastify.register(paymentRoutes, { prefix: '/payments' });
  await fastify.register(checkoutRoutes, { prefix: '/checkout' });


  // Extension installer routes
  await fastify.register(extensionInstallerRoutes, { prefix: '/extensions' });
  await fastify.register(publicThemeAssetRoutes);
  await fastify.register(installRoutes, { prefix: '/install' });
}
