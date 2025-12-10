/**
 * Admin 日志配置
 */

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  return process.env.API_URL || 'http://localhost:3001';
};

export const loggerConfig = {
  // 基础配置
  appName: 'admin',
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  
  // 日志级别配置 - 管理后台需要更详细的日志
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  
  // 控制台日志配置
  console: {
    enabled: true,
    colorize: false,
    timestamp: true
  },
  
  // 远程日志配置 - 管理操作需要更频繁的上报
  remote: {
    enabled: true,
    endpoint: `${getApiBaseUrl()}/api/logs/batch`,
    batchSize: 15, // 较小的批次，更及时的上报
    flushInterval: 3000, // 更短的刷新间隔
    maxRetries: 5, // 更多重试次数
    retryDelay: 1000,
    timeout: 15000 // 更长的超时时间
  },
  
  // 本地存储配置
  localStorage: {
    enabled: true,
    maxLogs: 200, // 管理后台保存更多日志
    storageKey: 'admin_logger_buffer'
  },
  
  // 审计日志配置
  audit: {
    enabled: true,
    trackAllActions: true,
    trackConfigChanges: true,
    trackUserManagement: true,
    trackSystemAccess: true
  },
  
  // 性能监控配置
  performance: {
    enabled: true,
    trackPageLoad: true,
    trackApiCalls: true,
    trackUserInteractions: true,
    trackAdminOperations: true
  },
  
  // 错误处理配置
  errorHandling: {
    captureGlobalErrors: true,
    captureUnhandledRejections: true,
    captureReactErrors: true,
    captureAdminErrors: true
  },
  
  // 安全配置
  security: {
    trackFailedLogins: true,
    trackPermissionDenied: true,
    trackSuspiciousActivity: true,
    alertOnSecurityEvents: true
  },
  
  // 隐私配置
  privacy: {
    enableDataSanitization: true,
    excludeUrls: ['/api/auth', '/api/admin/sensitive'],
    excludeHeaders: ['authorization', 'cookie', 'x-api-key', 'x-admin-token']
  }
};

export default loggerConfig;