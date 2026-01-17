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

  // Convenience methods
  logUserAction: (action: string, details?: any) => void;
  logError: (error: Error | string, context?: any) => void;
  logPageView: (page?: string) => void;
  logApiCall: (endpoint: string, method: string, status: number, duration: number) => void;
  logPerformance: (metric: string, value: number, details?: any) => void;
  logEcommerce: (event: string, details: any) => void;
}

/**
 * useLogger Hook - Provides logging functionality for React components
 */
export function useLogger(options: UseLoggerOptions = {}): LoggerHook {
  const { component, page, feature } = options;

  // Create logging methods with component context
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

  // User action logs
  const logUserAction = useCallback((action: string, details?: any) => {
    logWithContext('info', 'User Action', {
      type: 'user_action',
      action,
      details
    });
  }, [logWithContext]);

  // Error logs
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

  // Page view logs
  const logPageView = useCallback((pageName?: string) => {
    const currentPage = pageName || page || (typeof window !== 'undefined' ? window.location.pathname : 'unknown');

    logWithContext('info', 'Page View', {
      type: 'page_view',
      page: currentPage,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined
    });
  }, [logWithContext, page]);

  // API call logs
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

  // Performance logs
  const logPerformance = useCallback((metric: string, value: number, details?: any) => {
    logger.logPerformance(metric, value, {
      component,
      page,
      feature,
      details,
      timestamp: new Date().toISOString()
    });
  }, [component, page, feature]);

  // Ecommerce event logs
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