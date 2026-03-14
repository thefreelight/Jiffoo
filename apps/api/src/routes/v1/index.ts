/**
 * API Routes v1
 *
 * This module registers all v1 API routes.
 * Routes are registered under the /api/v1 prefix by the parent router.
 */

import { FastifyInstance } from 'fastify';

// Core routes
import { authRoutes } from '@/core/auth/routes';
import { accountRoutes } from '@/core/account/routes';
import { productRoutes } from '@/core/product/routes';
import { cartRoutes } from '@/core/cart/routes';
import { orderRoutes } from '@/core/order/routes';
import { paymentRoutes } from '@/core/payment/routes';

import { upgradeRoutes } from '@/core/upgrade/routes';

// Admin routes
import { adminUserRoutes } from '@/core/admin/user-management/routes';
import { adminProductRoutes } from '@/core/admin/product-management/routes';
import { adminOrderRoutes } from '@/core/admin/order-management/routes';
import { adminThemeRoutes, publicThemeRoutes } from '@/core/admin/theme-management/routes';
import systemSettingsRoutes from '@/core/admin/system-settings/routes';
import platformConnectionRoutes from '@/core/admin/platform-connection/routes';
import { adminDashboardRoutes } from '@/core/admin/dashboard/routes';
import { adminCatalogImportRoutes } from '@/core/admin/catalog-import/routes';

// Extension installer routes
import { extensionInstallerRoutes } from '@/core/admin/extension-installer/routes';
// Theme App Gateway routes
import { themeAppGatewayRoutes } from '@/core/admin/theme-app-runtime/gateway';
// Store routes
import { storeRoutes } from '@/core/store/routes';

/**
 * Register all v1 API routes
 * Note: Parent router adds /api/v1 prefix, so routes here are relative to that
 */
export async function registerV1Routes(fastify: FastifyInstance) {
  // Upgrade routes (admin only)
  await fastify.register(upgradeRoutes, { prefix: '/upgrade' });

  // Authentication routes
  await fastify.register(authRoutes, { prefix: '/auth' });

  // User account routes
  await fastify.register(accountRoutes, { prefix: '/account' });

  // Admin routes
  await fastify.register(adminUserRoutes, { prefix: '/admin/users' });
  await fastify.register(adminProductRoutes, { prefix: '/admin/products' });
  await fastify.register(adminOrderRoutes, { prefix: '/admin/orders' });
  await fastify.register(adminThemeRoutes, { prefix: '/admin/themes' });
  await fastify.register(systemSettingsRoutes, { prefix: '/admin' });
  await fastify.register(platformConnectionRoutes, { prefix: '/admin/platform/connection' });
  await fastify.register(adminCatalogImportRoutes, { prefix: '/admin/integrations/catalog-import' });

  // Dashboard routes
  await fastify.register(adminDashboardRoutes, { prefix: '/admin' });

  // Store context routes
  await fastify.register(storeRoutes, { prefix: '/store' });

  // Public routes
  await fastify.register(productRoutes, { prefix: '/products' });
  await fastify.register(cartRoutes, { prefix: '/cart' });
  await fastify.register(orderRoutes, { prefix: '/orders' });
  await fastify.register(paymentRoutes, { prefix: '/payments' });
  await fastify.register(publicThemeRoutes, { prefix: '/themes' });

  // Extension installer routes
  await fastify.register(extensionInstallerRoutes, { prefix: '/extensions' });

  // Theme App Gateway (reverse proxy to running Theme Apps)
  // This allows frontends to access Theme Apps through the API server
  await fastify.register(themeAppGatewayRoutes, { prefix: '/theme-app' });
}
