/**
 * Super Admin 统一日志系统配置
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
      'super-admin',
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
  
  // 超级管理员操作日志
  superAdminAction: (action: string, resource: string, details?: any) => {
    logger.info('Super Admin Action', {
      type: 'super_admin_action',
      action,
      resource,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  // 租户管理日志
  tenantManagement: (action: string, tenantId: string, details?: any) => {
    logger.info('Tenant Management', {
      type: 'tenant_management',
      action,
      tenantId,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  // 系统级配置变更日志
  systemConfigChange: (setting: string, oldValue: any, newValue: any) => {
    logger.info('System Configuration Change', {
      type: 'system_config_change',
      setting,
      oldValue,
      newValue,
      timestamp: new Date().toISOString()
    });
  },
  
  // 许可证管理日志
  licenseManagement: (action: string, licenseId: string, details?: any) => {
    logger.info('License Management', {
      type: 'license_management',
      action,
      licenseId,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  // 插件管理日志
  pluginManagement: (action: string, pluginId: string, tenantId?: string, details?: any) => {
    logger.info('Plugin Management', {
      type: 'plugin_management',
      action,
      pluginId,
      tenantId,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  // 系统监控日志
  systemMonitoring: (metric: string, value: any, details?: any) => {
    logger.info('System Monitoring', {
      type: 'system_monitoring',
      metric,
      value,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  // 安全审计日志
  securityAudit: (event: string, details?: any) => {
    logger.logSecurity(event, {
      level: 'super_admin',
      ...details
    });
  },
  
  // 性能监控
  performance: (metric: string, value: number, details?: any) => {
    logger.logPerformance(metric, value, {
      details,
      timestamp: new Date().toISOString()
    });
  }
};

// 初始化日志器
export const initializeLogger = () => {
  // 记录超级管理员后台启动
  logger.info('Super Admin application started', {
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
        logger.logPerformance('super_admin_page_load', navigation.loadEventEnd - navigation.fetchStart, {
          type: 'page_performance',
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          url: window.location.href
        });
      }
    }, 1000);
  }
};

export default logger;