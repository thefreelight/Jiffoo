/**
 * Admin Logger Configuration
 */

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  return process.env.API_URL || 'http://localhost:3001';
};

export const loggerConfig = {
  // Base configuration
  appName: 'admin',
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

  // Log level configuration - Admin needs more detailed logs
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

  // Console logging configuration
  console: {
    enabled: true,
    colorize: false,
    timestamp: true
  },

  // Remote logging configuration - Admin operations need more frequent reporting
  remote: {
    enabled: true,
    endpoint: `${getApiBaseUrl()}/api/logs/batch`,
    batchSize: 15, // Smaller batch size, more timely reporting
    flushInterval: 3000, // Shorter flush interval
    maxRetries: 5, // More retries
    retryDelay: 1000,
    timeout: 15000 // Longer timeout duration
  },

  // Local storage configuration
  localStorage: {
    enabled: true,
    maxLogs: 200, // Admin panel saves more logs
    storageKey: 'admin_logger_buffer'
  },

  // Audit logging configuration
  audit: {
    enabled: true,
    trackAllActions: true,
    trackConfigChanges: true,
    trackUserManagement: true,
    trackSystemAccess: true
  },

  // Performance monitoring configuration
  performance: {
    enabled: true,
    trackPageLoad: true,
    trackApiCalls: true,
    trackUserInteractions: true,
    trackAdminOperations: true
  },

  // Error handling configuration
  errorHandling: {
    captureGlobalErrors: true,
    captureUnhandledRejections: true,
    captureReactErrors: true,
    captureAdminErrors: true
  },

  // Security configuration
  security: {
    trackFailedLogins: true,
    trackPermissionDenied: true,
    trackSuspiciousActivity: true,
    alertOnSecurityEvents: true
  },

  // Privacy configuration
  privacy: {
    enableDataSanitization: true,
    excludeUrls: ['/api/auth', '/api/admin/sensitive'],
    excludeHeaders: ['authorization', 'cookie', 'x-api-key', 'x-admin-token']
  }
};

export default loggerConfig;