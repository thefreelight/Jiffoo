/**
 * 日志提供者组件
 */

'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { initializeLogger, logger, log } from '@/lib/logger';
import { createApiInterceptor } from '@/lib/api-logger';
import { ErrorBoundary } from './error-boundary';

interface LoggerContextType {
  logger: typeof logger;
  log: typeof log;
}

const LoggerContext = createContext<LoggerContextType | undefined>(undefined);

interface LoggerProviderProps {
  children: ReactNode;
}

export function LoggerProvider({ children }: LoggerProviderProps) {
  useEffect(() => {
    // 初始化日志器
    initializeLogger();
    
    // 设置 API 拦截器
    createApiInterceptor();

    // 设置全局错误处理
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled Promise Rejection', {
        type: 'unhandled_promise_rejection',
        reason: event.reason,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    };

    const handleError = (event: ErrorEvent) => {
      logger.error('Global JavaScript Error', {
        type: 'global_js_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? {
          name: event.error.name,
          message: event.error.message,
          stack: event.error.stack
        } : undefined,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    };

    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      if (document.hidden) {
        log.info('Page became hidden', {
          type: 'page_visibility',
          state: 'hidden'
        });
      } else {
        log.info('Page became visible', {
          type: 'page_visibility',
          state: 'visible'
        });
      }
    };

    // 监听页面卸载
    const handleBeforeUnload = () => {
      log.info('Page unloading', {
        type: 'page_lifecycle',
        event: 'beforeunload',
        url: window.location.href
      });
    };

    // 添加事件监听器
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 记录页面加载完成
    log.info('Logger provider initialized', {
      type: 'logger_lifecycle',
      event: 'initialized'
    });

    // 清理函数
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const contextValue: LoggerContextType = {
    logger,
    log
  };

  return (
    <LoggerContext.Provider value={contextValue}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </LoggerContext.Provider>
  );
}

export function useLoggerContext(): LoggerContextType {
  const context = useContext(LoggerContext);
  if (context === undefined) {
    throw new Error('useLoggerContext must be used within a LoggerProvider');
  }
  return context;
}

export default LoggerProvider;