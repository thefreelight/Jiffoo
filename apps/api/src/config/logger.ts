/**
 * API Service Logger Configuration
 */

import { env } from './env';

export const loggerConfig = {
  // Basic configuration
  appName: 'api',
  environment: env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0',

  // Log level configuration
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',

  // File logging configuration
  file: {
    enabled: true,
    baseDir: './logs',
    maxSize: '20m',
    maxFiles: env.NODE_ENV === 'production' ? '30d' : '7d',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true
  },

  // Console logging configuration
  console: {
    enabled: env.NODE_ENV === 'development',
    colorize: true,
    timestamp: true
  },

  // Remote logging configuration (for log aggregation)
  remote: {
    enabled: false, // Backend doesn't need remote transmission
    endpoint: null
  },

  // Monitoring configuration
  monitoring: {
    enabled: true,
    checkInterval: 60000, // 1 minute
    alertRules: {
      errorRate: {
        enabled: true,
        threshold: 5, // 5%
        timeWindow: '15m',
        cooldown: 15 // 15 minutes
      },
      errorCount: {
        enabled: true,
        threshold: 50,
        timeWindow: '5m',
        cooldown: 10
      },
      logVolume: {
        enabled: true,
        threshold: 10000,
        timeWindow: '1h',
        cooldown: 30
      }
    }
  },

  // Log retention policy
  retention: {
    days: env.NODE_ENV === 'production' ? 30 : 7,
    cleanupInterval: '24h'
  },

  // Performance configuration
  performance: {
    enableBuffering: true,
    bufferSize: 1000,
    flushInterval: 5000
  }
};

export default loggerConfig;