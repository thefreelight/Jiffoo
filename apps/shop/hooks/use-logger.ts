/**
 * useLogger React Hook
 */

import { useCallback, useMemo } from 'react';
import { logger, log, ILogger } from '@/lib/logger';

export interface UseLoggerOptions {
  component?: string;
  page?: string;
  feature?: string;
}

export interface LoggerHook {
  logger: ILogger;
  log: typeof log;
  
  // 便捷方法
  logUserAction: (action: string, details?: any) => void;
  logError: (error: Error | string, context?: any) => void;
  logPageView: (page?: string) => void;
  logApiCall: (endpoint: string, method: string, status: number, duration: number) => void;
  logPerformance: (metric: string, value: number, details?: any) => void;
  logEcommerce: (event: string, details: any) => void;
}

/**
 * useLogger Hook - 为 React 组件提供日志功能
 */
export function useLogger(options: UseLoggerOptions = {}): LoggerHook {
  const { component, page, feature } = options;

  // 创建带有组件上下文的日志方法
  const logWithContext = useCallback((level: 'debug' | 'info' | 'warn' | 'error', message: string, meta: any = {}) => {
    const contextMeta = {
      ...meta,
      component,
      page,
      feature,
      timestamp: new Date().toISOString()
    };
    
    logger[level](message, contextMeta);
  }, [component, page, feature]);

  // 用户操作日志
  const logUserAction = useCallback((action: string, details?: any) => {
    logWithContext('info', 'User Action', {
      type: 'user_action',
      action,
      details
    });
  }, [logWithContext]);

  // 错误日志
  const logError = useCallback((error: Error | string, context?: any) => {
    logWithContext('error', typeof error === 'string' ? error : error.message, {
      type: 'component_error',
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
    
    logWithContext('info', 'Page View', {
      type: 'page_view',
      page: currentPage,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined
    });
  }, [logWithContext, page]);

  // API 调用日志
  const logApiCall = useCallback((endpoint: string, method: string, status: number, duration: number) => {
    const level = status >= 400 ? 'warn' : 'info';
    logWithContext(level, 'API Call', {
      type: 'api_call',
      endpoint,
      method,
      status,
      duration
    });
  }, [logWithContext]);

  // 性能日志
  const logPerformance = useCallback((metric: string, value: number, details?: any) => {
    logger.logPerformance(metric, value, {
      component,
      page,
      feature,
      details,
      timestamp: new Date().toISOString()
    });
  }, [component, page, feature]);

  // 电商事件日志
  const logEcommerce = useCallback((event: string, details: any) => {
    logger.logBusiness(event, {
      category: 'ecommerce',
      component,
      page,
      feature,
      ...details,
      timestamp: new Date().toISOString()
    });
  }, [component, page, feature]);

  return useMemo(() => ({
    logger,
    log,
    logUserAction,
    logError,
    logPageView,
    logApiCall,
    logPerformance,
    logEcommerce
  }), [
    logUserAction,
    logError,
    logPageView,
    logApiCall,
    logPerformance,
    logEcommerce
  ]);
}

export default useLogger;