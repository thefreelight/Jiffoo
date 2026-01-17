/**
 * Admin Unified Logger Configuration
 */

import { createDefaultBrowserAdapter, type ILogger } from 'shared/src/logger/index.browser';

// Get backend API base URL (for log uploading)
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Browser environment: NEXT_PUBLIC_API_URL already includes /api prefix
    return process.env.NEXT_PUBLIC_API_URL || '/api';
  }
  // Server-side rendering environment
  return process.env.API_URL || 'http://localhost:3001/api';
};

// Lazy initialize logger to avoid duplicate warnings during module loading
let _logger: ILogger | null = null;

const getLogger = (): ILogger => {
  if (!_logger) {
    // Decide whether to enable remote log reporting based on environment variables
    const enableRemoteLogs = process.env.NEXT_PUBLIC_ENABLE_REMOTE_LOGS === 'true';
    const remoteEndpoint = enableRemoteLogs ? `${getApiBaseUrl()}/logs/batch` : undefined;

    _logger = createDefaultBrowserAdapter(
      'admin',
      remoteEndpoint
    );
  }
  return _logger;
};

// Export logger getter
export const logger: ILogger = new Proxy({} as ILogger, {
  get: (target, prop) => {
    return getLogger()[prop as keyof ILogger];
  }
});

// Export logger type
export type { ILogger };

// Convenient logging methods
export const log = {
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  error: (message: string | Error, meta?: any) => logger.error(message, meta),

  // Admin action logs
  adminAction: (action: string, resource: string, details?: any) => {
    logger.info('Admin Action', {
      type: 'admin_action',
      action,
      resource,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // Audit logs
  audit: (event: string, userId?: string, details?: any) => {
    logger.info('Audit Event', {
      type: 'audit',
      event,
      userId,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // System configuration change logs
  configChange: (setting: string, oldValue: any, newValue: any, userId?: string) => {
    logger.info('Configuration Change', {
      type: 'config_change',
      setting,
      oldValue,
      newValue,
      userId,
      timestamp: new Date().toISOString()
    });
  },

  // User management logs
  userManagement: (action: string, targetUserId: string, details?: any) => {
    logger.info('User Management', {
      type: 'user_management',
      action,
      targetUserId,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // Product management logs
  productManagement: (action: string, productId: string, details?: any) => {
    logger.info('Product Management', {
      type: 'product_management',
      action,
      productId,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // Order management logs
  orderManagement: (action: string, orderId: string, details?: any) => {
    logger.info('Order Management', {
      type: 'order_management',
      action,
      orderId,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // Plugin management logs
  pluginManagement: (action: string, pluginId: string, details?: any) => {
    logger.info('Plugin Management', {
      type: 'plugin_management',
      action,
      pluginId,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // Security event logs
  security: (event: string, details?: any) => {
    logger.logSecurity(event, details);
  },

  // Performance monitoring
  performance: (metric: string, value: number, details?: any) => {
    logger.logPerformance(metric, value, {
      details,
      timestamp: new Date().toISOString()
    });
  }
};

// Initialize logger
export const initializeLogger = () => {
  // Log admin startup
  logger.info('Admin application started', {
    type: 'app_lifecycle',
    event: 'startup',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    timestamp: new Date().toISOString()
  });

  // Log page performance metrics
  if (typeof window !== 'undefined' && 'performance' in window) {
    setTimeout(() => {
      const navigation = (performance as any).getEntriesByType('navigation')[0];
      if (navigation) {
        logger.logPerformance('admin_page_load', navigation.loadEventEnd - navigation.fetchStart, {
          type: 'page_performance',
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          url: window.location.href
        });
      }
    }, 1000);
  }
};

export default logger;