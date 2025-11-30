import { FastifyInstance } from 'fastify';

// Import route modules from core
import { authRoutes } from '@/core/auth/routes';
import { accountRoutes } from '@/core/account/routes';
import { productRoutes } from '@/core/product/routes';
import { cartRoutes } from '@/core/cart/routes';
import { orderRoutes } from '@/core/order/routes';
import { uploadRoutes } from '@/core/upload/routes';
import { cacheRoutes } from '@/core/cache/routes';
import { paymentGatewayRoutes } from '@/core/payment-gateway/routes';
import { emailGatewayRoutes } from '@/core/email-gateway/routes';
import { authGatewayRoutes } from '@/core/auth-gateway/routes';
import { loggerRoutes } from '@/core/logger/routes';

// Mall routes
import { mallContextRoutes } from '@/core/mall/context/routes';

// Admin routes
import { adminUserManagementRoutes } from '@/core/admin/user-management/routes';
import { adminProductRoutes } from '@/core/admin/product-management/routes';
import { adminOrderRoutes } from '@/core/admin/order-management/routes';
import { adminPluginRoutes } from '@/core/admin/plugin-management/routes';
import { domainSettingsRoutes } from '@/core/admin/domain-settings/routes';

// Super admin routes
import { superAdminUserRoutes } from '@/core/super-admin/user-management/routes';
import { superAdminProductRoutes } from '@/core/super-admin/product-management/routes';
import { superAdminOrderRoutes } from '@/core/super-admin/order-management/routes';
import { superAdminTenantRoutes } from '@/core/super-admin/tenant-management/routes';
import pluginManagementRoutes from '@/core/super-admin/plugin-management/routes';

/**
 * Register all API routes
 * This centralizes route registration and provides clear API structure
 */
export async function registerRoutes(fastify: FastifyInstance) {
  // Authentication routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  
  // User account routes
  await fastify.register(accountRoutes, { prefix: '/api/account' });
  
  // File upload routes
  await fastify.register(uploadRoutes, { prefix: '/api/upload' });
  
  // Cache management routes
  await fastify.register(cacheRoutes, { prefix: '/api/cache' });

  // Mall context routes (public, no auth required)
  await fastify.register(mallContextRoutes, { prefix: '/api/mall' });

  // Admin routes
  await fastify.register(adminUserManagementRoutes, { prefix: '/api/admin/users' });
  await fastify.register(adminProductRoutes, { prefix: '/api/admin/products' });
  await fastify.register(adminOrderRoutes, { prefix: '/api/admin/orders' });
  await fastify.register(adminPluginRoutes, { prefix: '/api/admin/plugins' });
  await fastify.register(domainSettingsRoutes, { prefix: '/api/admin/domain-settings' });

  // Super admin routes
  await fastify.register(superAdminUserRoutes, { prefix: '/api/super-admin/users' });
  await fastify.register(superAdminProductRoutes, { prefix: '/api/super-admin/products' });
  await fastify.register(superAdminOrderRoutes, { prefix: '/api/super-admin/orders' });
  await fastify.register(superAdminTenantRoutes, { prefix: '/api/super-admin/tenants' });
  await fastify.register(pluginManagementRoutes, { prefix: '/api/super-admin/plugins' });

  // Public routes
  await fastify.register(productRoutes, { prefix: '/api/products' });
  await fastify.register(cartRoutes, { prefix: '/api/cart' });
  await fastify.register(orderRoutes, { prefix: '/api/orders' });

  // Unified gateway routes
  await fastify.register(paymentGatewayRoutes, { prefix: '/api/payments' });
  await fastify.register(emailGatewayRoutes, { prefix: '/api/emails' });
  await fastify.register(authGatewayRoutes, { prefix: '/api/auth-gateway' });
  
  // Logger routes
  await fastify.register(loggerRoutes, { prefix: '/api/logs' });
}
