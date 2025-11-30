/**
 * Shop 商城前台日志配置
 */

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  return process.env.API_URL || 'http://localhost:3001';
};

export const loggerConfig = {
  // 基础配置
  appName: 'shop',
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  
  // 日志级别配置
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  
  // 控制台日志配置
  console: {
    enabled: true,
    colorize: false, // 浏览器使用 CSS 样式
    timestamp: true
  },
  
  // 远程日志配置
  remote: {
    enabled: true,
    endpoint: `${getApiBaseUrl()}/api/logs/batch`,
    batchSize: process.env.NODE_ENV === 'production' ? 20 : 10,
    flushInterval: process.env.NODE_ENV === 'production' ? 10000 : 5000, // 生产环境更长间隔
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 10000
  },
  
  // 本地存储配置
  localStorage: {
    enabled: true,
    maxLogs: process.env.NODE_ENV === 'production' ? 50 : 100,
    storageKey: 'frontend_logger_buffer'
  },
  
  // 性能监控配置
  performance: {
    enabled: true,
    trackPageLoad: true,
    trackApiCalls: true,
    trackUserInteractions: true
  },
  
  // 错误处理配置
  errorHandling: {
    captureGlobalErrors: true,
    captureUnhandledRejections: true,
    captureReactErrors: true
  },
  
  // 隐私配置
  privacy: {
    enableDataSanitization: true,
    excludeUrls: ['/api/auth', '/api/payment'], // 不记录敏感 URL
    excludeHeaders: ['authorization', 'cookie', 'x-api-key']
  }
};

export default loggerConfig;