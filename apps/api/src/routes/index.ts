/**
 * API Routes (单商户版本)
 */

import { FastifyInstance } from 'fastify';

// Core routes
import { authRoutes } from '@/core/auth/routes';
import { accountRoutes } from '@/core/account/routes';
import { productRoutes } from '@/core/product/routes';
import { cartRoutes } from '@/core/cart/routes';
import { orderRoutes } from '@/core/order/routes';
import { paymentRoutes } from '@/core/payment/routes';
import { uploadRoutes } from '@/core/upload/routes';
import { cacheRoutes } from '@/core/cache/routes';
import { loggerRoutes } from '@/core/logger/routes';
import { installRoutes } from '@/core/install/routes';
import { upgradeRoutes } from '@/core/upgrade/routes';

// Admin routes
import { adminUserRoutes } from '@/core/admin/user-management/routes';
import { adminProductRoutes } from '@/core/admin/product-management/routes';
import { adminOrderRoutes } from '@/core/admin/order-management/routes';
import { adminThemeRoutes, publicThemeRoutes } from '@/core/admin/theme-management/routes';
import { adminPluginRoutes } from '@/core/admin/plugin-management/routes';
import { registerLicenseRoutes } from '@/core/admin/license-management/routes';
import backupRoutes from '@/core/admin/backup/routes';

// Public plugin routes
import { publicPluginRoutes } from '@/core/plugins/public-routes';

// Extension installer routes
import { extensionInstallerRoutes } from '@/services/extension-installer/routes';

// Marketplace BFF routes
import { marketplaceRoutes } from '@/services/marketplace/routes';

/**
 * Register all API routes
 */
export async function registerRoutes(fastify: FastifyInstance) {
  // Installation routes (no auth required)
  await fastify.register(installRoutes, { prefix: '/api/install' });

  // Upgrade routes (admin only)
  await fastify.register(upgradeRoutes, { prefix: '/api/upgrade' });

  // Authentication routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  
  // User account routes
  await fastify.register(accountRoutes, { prefix: '/api/account' });
  
  // File upload routes
  await fastify.register(uploadRoutes, { prefix: '/api/upload' });
  
  // Cache management routes
  await fastify.register(cacheRoutes, { prefix: '/api/cache' });

  // Admin routes
  await fastify.register(adminUserRoutes, { prefix: '/api/admin/users' });
  await fastify.register(adminProductRoutes, { prefix: '/api/admin/products' });
  await fastify.register(adminOrderRoutes, { prefix: '/api/admin/orders' });
  await fastify.register(adminThemeRoutes, { prefix: '/api/admin/themes' });
  await fastify.register(adminPluginRoutes, { prefix: '/api/admin/plugins' });

  // License management routes (at /api root since they handle /api/admin/licenses and /api/admin/plugins/:slug/license)
  await registerLicenseRoutes(fastify);

  // Backup management routes
  await fastify.register(backupRoutes, { prefix: '/api/admin/backups' });

  // Public routes
  await fastify.register(productRoutes, { prefix: '/api/products' });
  await fastify.register(cartRoutes, { prefix: '/api/cart' });
  await fastify.register(orderRoutes, { prefix: '/api/orders' });
  await fastify.register(paymentRoutes, { prefix: '/api/payments' });
  await fastify.register(publicPluginRoutes, { prefix: '/api/plugins' });
  await fastify.register(publicThemeRoutes, { prefix: '/api/themes' });
  
  // Logger routes
  await fastify.register(loggerRoutes, { prefix: '/api/logs' });

  // Extension installer routes
  await fastify.register(extensionInstallerRoutes, { prefix: '/api/extensions' });

  // Marketplace BFF routes
  await fastify.register(marketplaceRoutes, { prefix: '/api/marketplace' });
}
