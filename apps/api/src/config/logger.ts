/**
 * API Service 日志配置
 */

import { env } from './env';

export const loggerConfig = {
  // 基础配置
  appName: 'api',
  environment: env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0',
  
  // 日志级别配置
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  
  // 文件日志配置
  file: {
    enabled: true,
    baseDir: './logs',
    maxSize: '20m',
    maxFiles: env.NODE_ENV === 'production' ? '30d' : '7d',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true
  },
  
  // 控制台日志配置
  console: {
    enabled: env.NODE_ENV === 'development',
    colorize: true,
    timestamp: true
  },
  
  // 远程日志配置（用于日志聚合）
  remote: {
    enabled: false, // Backend 不需要远程传输
    endpoint: null
  },
  
  // 监控配置
  monitoring: {
    enabled: true,
    checkInterval: 60000, // 1分钟
    alertRules: {
      errorRate: {
        enabled: true,
        threshold: 5, // 5%
        timeWindow: '15m',
        cooldown: 15 // 15分钟
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
  
  // 日志保留策略
  retention: {
    days: env.NODE_ENV === 'production' ? 30 : 7,
    cleanupInterval: '24h'
  },
  
  // 性能配置
  performance: {
    enableBuffering: true,
    bufferSize: 1000,
    flushInterval: 5000
  }
};

export default loggerConfig;