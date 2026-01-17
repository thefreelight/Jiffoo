/**
 * Shop Application Logger Configuration
 */

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  return process.env.API_URL || 'http://localhost:3001';
};

export const loggerConfig = {
  // Base configuration
  appName: 'shop',
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

  // Log level configuration
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

  // Console logging configuration
  console: {
    enabled: true,
    colorize: false, // Browser uses CSS styling
    timestamp: true
  },

  // Remote logging configuration
  remote: {
    enabled: true,
    endpoint: `${getApiBaseUrl()}/api/logs/batch`,
    batchSize: process.env.NODE_ENV === 'production' ? 20 : 10,
    flushInterval: process.env.NODE_ENV === 'production' ? 10000 : 5000, // Longer interval in production
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 10000
  },

  // Local storage configuration
  localStorage: {
    enabled: true,
    maxLogs: process.env.NODE_ENV === 'production' ? 50 : 100,
    storageKey: 'frontend_logger_buffer'
  },

  // Performance monitoring configuration
  performance: {
    enabled: true,
    trackPageLoad: true,
    trackApiCalls: true,
    trackUserInteractions: true
  },

  // Error handling configuration
  errorHandling: {
    captureGlobalErrors: true,
    captureUnhandledRejections: true,
    captureReactErrors: true
  },

  // Privacy configuration
  privacy: {
    enableDataSanitization: true,
    excludeUrls: ['/api/auth', '/api/payment'], // Do not log sensitive URLs
    excludeHeaders: ['authorization', 'cookie', 'x-api-key']
  }
};

export default loggerConfig;