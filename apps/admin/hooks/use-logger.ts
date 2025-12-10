/**
 * useLogger React Hook for Admin
 */

import { useCallback, useMemo } from 'react';
import { logger, log, ILogger } from '@/lib/logger';

export interface UseLoggerOptions {
  component?: string;
  page?: string;
  feature?: string;
  adminSection?: string;
}

export interface AdminLoggerHook {
  logger: ILogger;
  log: typeof log;
  
  // 管理员专用日志方法
  logAdminAction: (action: string, resource: string, details?: any) => void;
  logAudit: (event: string, details?: any) => void;
  logConfigChange: (setting: string, oldValue: any, newValue: any) => void;
  logUserManagement: (action: string, targetUserId: string, details?: any) => void;
  logProductManagement: (action: string, productId: string, details?: any) => void;
  logOrderManagement: (action: string, orderId: string, details?: any) => void;
  logPluginManagement: (action: string, pluginId: string, details?: any) => void;
  logSecurity: (event: string, details?: any) => void;
  logError: (error: Error | string, context?: any) => void;
  logPageView: (page?: string) => void;
}

/**
 * useLogger Hook - 为 Admin React 组件提供日志功能
 */
export function useLogger(options: UseLoggerOptions = {}): AdminLoggerHook {
  const { component, page, feature, adminSection } = options;

  // 创建带有组件上下文的日志方法
  const logWithContext = useCallback((level: 'debug' | 'info' | 'warn' | 'error', message: string, meta: any = {}) => {
    const contextMeta = {
      ...meta,
      component,
      page,
      feature,
      adminSection,
      timestamp: new Date().toISOString()
    };
    
    logger[level](message, contextMeta);
  }, [component, page, feature, adminSection]);

  // 管理员操作日志
  const logAdminAction = useCallback((action: string, resource: string, details?: any) => {
    log.adminAction(action, resource, {
      component,
      page,
      feature,
      adminSection,
      ...details
    });
  }, [component, page, feature, adminSection]);

  // 审计日志
  const logAudit = useCallback((event: string, details?: any) => {
    log.audit(event, undefined, {
      component,
      page,
      feature,
      adminSection,
      ...details
    });
  }, [component, page, feature, adminSection]);

  // 配置变更日志
  const logConfigChange = useCallback((setting: string, oldValue: any, newValue: any) => {
    log.configChange(setting, oldValue, newValue);
  }, []);

  // 用户管理日志
  const logUserManagement = useCallback((action: string, targetUserId: string, details?: any) => {
    log.userManagement(action, targetUserId, {
      component,
      page,
      feature,
      ...details
    });
  }, [component, page, feature]);

  // 产品管理日志
  const logProductManagement = useCallback((action: string, productId: string, details?: any) => {
    log.productManagement(action, productId, {
      component,
      page,
      feature,
      ...details
    });
  }, [component, page, feature]);

  // 订单管理日志
  const logOrderManagement = useCallback((action: string, orderId: string, details?: any) => {
    log.orderManagement(action, orderId, {
      component,
      page,
      feature,
      ...details
    });
  }, [component, page, feature]);

  // 插件管理日志
  const logPluginManagement = useCallback((action: string, pluginId: string, details?: any) => {
    log.pluginManagement(action, pluginId, {
      component,
      page,
      feature,
      ...details
    });
  }, [component, page, feature]);

  // 安全事件日志
  const logSecurity = useCallback((event: string, details?: any) => {
    log.security(event, {
      component,
      page,
      feature,
      adminSection,
      ...details
    });
  }, [component, page, feature, adminSection]);

  // 错误日志
  const logError = useCallback((error: Error | string, context?: any) => {
    logWithContext('error', typeof error === 'string' ? error : error.message, {
      type: 'admin_error',
      error: typeof error === 'string' ? { message: error } : {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    });
  }, [logWithContext]);

  // 页面浏览日志
  const logPageView = useCallback((pageName?: string) => {
    const currentPage = pageName || page || (typeof window !== 'undefined' ? window.location.pathname : 'unknown');
    
    logWithContext('info', 'Admin Page View', {
      type: 'admin_page_view',
      page: currentPage,
      adminSection,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined
    });
  }, [logWithContext, page, adminSection]);

  return useMemo(() => ({
    logger,
    log,
    logAdminAction,
    logAudit,
    logConfigChange,
    logUserManagement,
    logProductManagement,
    logOrderManagement,
    logPluginManagement,
    logSecurity,
    logError,
    logPageView
  }), [
    logAdminAction,
    logAudit,
    logConfigChange,
    logUserManagement,
    logProductManagement,
    logOrderManagement,
    logPluginManagement,
    logSecurity,
    logError,
    logPageView
  ]);
}

export default useLogger;