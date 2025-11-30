/**
 * Frontend 统一日志系统配置
 */

import { createDefaultBrowserAdapter, type ILogger } from 'shared/src/logger/index.browser';

// 获取后端 API 基础 URL（用于日志上传）
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // 浏览器环境：NEXT_PUBLIC_API_URL 已经包含 /api 前缀
    return process.env.NEXT_PUBLIC_API_URL || '/api';
  }
  // 服务端渲染环境
  return process.env.API_URL || 'http://localhost:3001/api';
};

// 延迟初始化 logger，避免模块加载时的重复警告
let _logger: ILogger | null = null;

const getLogger = (): ILogger => {
  if (!_logger) {
    // 根据环境变量决定是否启用远程日志上报
    const enableRemoteLogs = process.env.NEXT_PUBLIC_ENABLE_REMOTE_LOGS === 'true';
    const remoteEndpoint = enableRemoteLogs ? `${getApiBaseUrl()}/logs/batch` : undefined;
    
    _logger = createDefaultBrowserAdapter(
      'frontend',
      remoteEndpoint
    );
  }
  return _logger;
};

// 导出 logger 的 getter
export const logger: ILogger = new Proxy({} as ILogger, {
  get: (target, prop) => {
    return getLogger()[prop as keyof ILogger];
  }
});

// 导出日志器类型
export type { ILogger };

// 便捷的日志方法
export const log = {
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  error: (message: string | Error, meta?: any) => logger.error(message, meta),
  
  // 业务日志方法
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

// 初始化日志器
export const initializeLogger = () => {
  // 记录应用启动
  logger.info('Frontend application started', {
    type: 'app_lifecycle',
    event: 'startup',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    timestamp: new Date().toISOString()
  });

  // 记录页面性能指标
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