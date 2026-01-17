/**
 * Admin Logger Provider Component
 */

'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { initializeLogger, logger, log } from '@/lib/logger';
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
    // Initialize logger
    initializeLogger();

    // Set global error handling
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Admin Unhandled Promise Rejection', {
        type: 'admin_unhandled_promise_rejection',
        reason: event.reason,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    };

    const handleError = (event: ErrorEvent) => {
      logger.error('Admin Global JavaScript Error', {
        type: 'admin_global_js_error',
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

    // Listen for page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        log.info('Admin page became hidden', {
          type: 'admin_page_visibility',
          state: 'hidden'
        });
      } else {
        log.info('Admin page became visible', {
          type: 'admin_page_visibility',
          state: 'visible'
        });
      }
    };

    // Listen for page unload
    const handleBeforeUnload = () => {
      log.info('Admin page unloading', {
        type: 'admin_page_lifecycle',
        event: 'beforeunload',
        url: window.location.href
      });
    };

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Log admin logger provider initialization
    log.info('Admin logger provider initialized', {
      type: 'admin_logger_lifecycle',
      event: 'initialized'
    });

    // Cleanup function
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