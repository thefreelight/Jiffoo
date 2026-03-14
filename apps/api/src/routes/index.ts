/**
 * API Routes (Single Merchant Version)
 */

import { FastifyInstance } from 'fastify';

// Versioned routes
import { registerV1Routes } from './v1';

// Core routes (for backward compatibility)
import { authRoutes } from '@/core/auth/routes';
import { accountRoutes } from '@/core/account/routes';
import { productRoutes } from '@/core/product/routes';
import { cartRoutes } from '@/core/cart/routes';
import { orderRoutes } from '@/core/order/routes';
import { paymentRoutes as legacyPaymentRoutes } from '@/core/payment/routes';
import { paymentsRoutes as stripePaymentRoutes } from './payments'; // NEW explicit stripe intent routes
import { notificationRoutes } from '@/core/notification/routes';
import currencyRoutes from '@/core/currency/routes';
import { discountRoutes } from '@/core/discount/routes';
import { recommendationRoutes } from '@/core/recommendations/routes';

import { upgradeRoutes } from '@/core/upgrade/routes';

// Admin routes
import { adminUserRoutes } from '@/core/admin/user-management/routes';
import { adminProductRoutes } from '@/core/admin/product-management/routes';
import { adminOrderRoutes } from '@/core/admin/order-management/routes';
import { adminThemeRoutes, publicThemeRoutes } from '@/core/admin/theme-management/routes';
import systemSettingsRoutes from '@/core/admin/system-settings/routes';
import platformConnectionRoutes from '@/core/admin/platform-connection/routes';
import { adminDashboardRoutes } from '@/core/admin/dashboard/routes';
import { healthMonitoringRoutes } from '@/core/admin/health-monitoring/routes';
import { errorTrackingRoutes } from '@/core/error-tracking/routes';
import { adminStoreManagementRoutes } from '@/core/admin/store-management/routes';
import { adminCatalogImportRoutes } from '@/core/admin/catalog-import/routes';

// SEO routes
import { seoRoutes, sitemapRoute } from '@/core/seo/routes';
import { adminWarehouseRoutes } from '@/core/warehouse/routes';
import { adminInventoryRoutes } from '@/core/inventory/routes';
import { adminStockAlertRoutes } from '@/core/stock-alert/routes';
// B2B routes
import { companyRoutes } from '@/core/b2b/company/routes';
import { companyUserRoutes } from '@/core/b2b/company-user/routes';
import { customerGroupRoutes } from '@/core/b2b/customer-group/routes';
import { pricingRoutes } from '@/core/b2b/pricing/routes';
import { quoteRoutes } from '@/core/b2b/quote/routes';
import { purchaseOrderRoutes } from '@/core/b2b/purchase-order/routes';
import { paymentTermRoutes } from '@/core/b2b/payment-term/routes';

import { forecastingRoutes } from '@/core/inventory/forecasting/routes';

// Extension installer routes
import { extensionInstallerRoutes } from '@/core/admin/extension-installer/routes';
import { adminExternalOrdersIntegrationRoutes } from '@/core/admin/external-orders-integration/routes';
// Market integration routes
import { marketRoutes } from '@/core/admin/market/routes';
// Theme App Gateway routes
import { themeAppGatewayRoutes } from '@/core/admin/theme-app-runtime/gateway';
// Webhook admin routes
import { webhookRoutes } from '@/core/webhooks/routes';
// Store routes
import { storeRoutes } from '@/core/store/routes';
// Install routes (Restored)
import { installRoutes } from '@/core/install/routes';

/**
 * Register all API routes
 */
export async function registerRoutes(fastify: FastifyInstance) {
  // Register v1 routes (versioned)
  await fastify.register(registerV1Routes, { prefix: '/api/v1' });

  // Backward compatibility: Register unversioned routes
  // These will eventually be deprecated in favor of versioned routes

  // Upgrade routes (admin only)
  await fastify.register(upgradeRoutes, { prefix: '/api/upgrade' });

  // Authentication routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });

  // User account routes
  await fastify.register(accountRoutes, { prefix: '/api/account' });

  // Admin routes
  await fastify.register(adminUserRoutes, { prefix: '/api/admin/users' });
  await fastify.register(adminProductRoutes, { prefix: '/api/admin/products' });
  await fastify.register(adminOrderRoutes, { prefix: '/api/admin/orders' });
  await fastify.register(adminThemeRoutes, { prefix: '/api/admin/themes' });
  await fastify.register(adminWarehouseRoutes, { prefix: '/api/admin/warehouses' });
  await fastify.register(adminInventoryRoutes, { prefix: '/api/admin/inventory' });
  await fastify.register(forecastingRoutes, { prefix: '/api/admin/inventory' });
  await fastify.register(adminStockAlertRoutes, { prefix: '/api/admin/stock-alerts' });
  await fastify.register(systemSettingsRoutes, { prefix: '/api/admin' });
  await fastify.register(platformConnectionRoutes, { prefix: '/api/admin/platform/connection' });
  await fastify.register(adminStoreManagementRoutes, { prefix: '/api/admin/stores' });
  await fastify.register(adminCatalogImportRoutes, { prefix: '/api/admin/integrations/catalog-import' });

  // Dashboard routes
  await fastify.register(adminDashboardRoutes, { prefix: '/api/admin' });

  // Health monitoring routes
  await fastify.register(healthMonitoringRoutes, { prefix: '/api/admin' });
  // Error tracking routes
  await fastify.register(errorTrackingRoutes, { prefix: '/api/admin/errors' });

  // Webhook management routes
  await fastify.register(webhookRoutes, { prefix: '/api/admin/webhooks' });

  // Store context routes
  await fastify.register(storeRoutes, { prefix: '/api/store' });

  // B2B routes
  await fastify.register(companyRoutes, { prefix: '/api/b2b/companies' });
  await fastify.register(companyUserRoutes, { prefix: '/api/b2b/companies' });
  await fastify.register(customerGroupRoutes, { prefix: '/api/b2b/customer-groups' });
  await fastify.register(pricingRoutes, { prefix: '/api/b2b/pricing' });
  await fastify.register(quoteRoutes, { prefix: '/api/b2b/quotes' });
  await fastify.register(purchaseOrderRoutes, { prefix: '/api/b2b/purchase-orders' });
  await fastify.register(paymentTermRoutes, { prefix: '/api/b2b/payment-terms' });

  // Public routes
  await fastify.register(productRoutes, { prefix: '/api/products' });
  await fastify.register(cartRoutes, { prefix: '/api/cart' });
  await fastify.register(orderRoutes, { prefix: '/api/orders' });
  await fastify.register(legacyPaymentRoutes, { prefix: '/api/payments' });
  // Keep the legacy Stripe direct-intent path alive for the current shop checkout.
  await fastify.register(stripePaymentRoutes, { prefix: '/api/payments' });
  await fastify.register(stripePaymentRoutes, { prefix: '/api/payments/stripe' });
  await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
  await fastify.register(publicThemeRoutes, { prefix: '/api/themes' });
  await fastify.register(currencyRoutes, { prefix: '/api/currency' });

  // SEO routes
  await fastify.register(seoRoutes, { prefix: '/api/seo' });
  await fastify.register(sitemapRoute, { prefix: '/api' });
  await fastify.register(discountRoutes, { prefix: '/api/discounts' });
  await fastify.register(recommendationRoutes, { prefix: '/api/recommendations' });

  // Extension installer routes
  await fastify.register(extensionInstallerRoutes, { prefix: '/api/extensions' });

  // Official Market integration routes (§4.9)
  await fastify.register(marketRoutes, { prefix: '/api/admin/market' });

  // Theme App Gateway (reverse proxy to running Theme Apps)
  // This allows frontends to access Theme Apps through the API server
  await fastify.register(themeAppGatewayRoutes, { prefix: '/theme-app' });

  // Install routes
  await fastify.register(installRoutes, { prefix: '/api/install' });
}
