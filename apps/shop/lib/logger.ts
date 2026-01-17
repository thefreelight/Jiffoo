/**
 * Frontend Unified Logger Configuration
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
      'frontend',
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

  // Business logging methods
  userAction: (action: string, details?: any) => {
    logger.info('User Action', {
      type: 'user_action',
      action,
      details,
      timestamp: new Date().toISOString()
    });
  },

  pageView: (page: string, referrer?: string) => {
    logger.info('Page View', {
      type: 'page_view',
      page,
      referrer,
      timestamp: new Date().toISOString()
    });
  },

  apiCall: (endpoint: string, method: string, status: number, duration: number) => {
    const level = status >= 400 ? 'warn' : 'info';
    logger[level]('API Call', {
      type: 'api_call',
      endpoint,
      method,
      status,
      duration,
      timestamp: new Date().toISOString()
    });
  },

  performance: (metric: string, value: number, details?: any) => {
    logger.logPerformance(metric, value, {
      details,
      timestamp: new Date().toISOString()
    });
  },

  ecommerce: (event: string, details: any) => {
    logger.logBusiness(event, {
      category: 'ecommerce',
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

// Initialize logger
export const initializeLogger = () => {
  // Log application startup
  logger.info('Frontend application started', {
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
        logger.logPerformance('page_load', navigation.loadEventEnd - navigation.fetchStart, {
          type: 'page_performance',
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          url: window.location.href
        });
      }
    }, 1000);
  }
};

export default logger;