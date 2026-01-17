'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  PackageOpen,
  Home,
  ArrowLeft,
  Clock,
  WifiOff
} from 'lucide-react';
import { TimeoutError, NetworkError } from '@/hooks/use-data';

// ============================================
// LoadingState Component
// ============================================

export type LoadingType = 'spinner' | 'skeleton' | 'dots';

interface LoadingStateProps {
  type?: LoadingType;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullPage?: boolean;
}

export function LoadingState({
  type = 'spinner',
  message,
  size = 'md',
  className,
  fullPage = false
}: LoadingStateProps) {
  const sizeClasses = {
    sm: { icon: 'h-4 w-4', text: 'text-sm', skeleton: 'h-4' },
    md: { icon: 'h-8 w-8', text: 'text-base', skeleton: 'h-6' },
    lg: { icon: 'h-12 w-12', text: 'text-lg', skeleton: 'h-8' },
  };

  const containerClass = cn(
    'flex flex-col items-center justify-center gap-3',
    fullPage && 'min-h-[50vh]',
    className
  );

  if (type === 'skeleton') {
    return (
      <div className={cn('space-y-3 animate-pulse', className)}>
        <div className={cn('bg-gray-200 rounded w-full', sizeClasses[size].skeleton)} />
        <div className={cn('bg-gray-200 rounded w-3/4', sizeClasses[size].skeleton)} />
        <div className={cn('bg-gray-200 rounded w-1/2', sizeClasses[size].skeleton)} />
      </div>
    );
  }

  if (type === 'dots') {
    return (
      <div className={containerClass}>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'rounded-full bg-primary animate-bounce',
                size === 'sm' ? 'h-2 w-2' : size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'
              )}
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        {message && <p className={cn('text-muted-foreground', sizeClasses[size].text)}>{message}</p>}
      </div>
    );
  }

  // Default: spinner
  return (
    <div className={containerClass}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size].icon)} />
      {message && <p className={cn('text-muted-foreground', sizeClasses[size].text)}>{message}</p>}
    </div>
  );
}

// ============================================
// ErrorState Component
// ============================================

interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  onGoHome?: () => void;
  onGoBack?: () => void;
  className?: string;
  fullPage?: boolean;
  showDetails?: boolean;
}

// Get display configuration related to error type
function getErrorConfig(error: Error | string | null | undefined) {
  if (error instanceof TimeoutError) {
    return {
      icon: Clock,
      title: 'Request Timeout',
      message: 'Server response timed out. Please check your network connection and try again.',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    };
  }

  if (error instanceof NetworkError) {
    return {
      icon: WifiOff,
      title: 'Network Connection Failed',
      message: 'Unable to connect to the server. Please check your network settings.',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
    };
  }

  // Default error
  return {
    icon: AlertCircle,
    title: 'Something went wrong',
    message: 'Please try again later or refresh the page',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
  };
}

export function ErrorState({
  title,
  message,
  error,
  onRetry,
  onGoHome,
  onGoBack,
  className,
  fullPage = false,
  showDetails = process.env.NODE_ENV === 'development'
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Get configuration based on error type
  const config = getErrorConfig(error);
  const IconComponent = config.icon;

  // Use passed in title/message or default values
  const displayTitle = title || config.title;
  const displayMessage = message || config.message;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center p-6',
      fullPage && 'min-h-[50vh]',
      className
    )}>
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center mb-4',
        config.bgColor
      )}>
        <IconComponent className={cn('h-8 w-8', config.iconColor)} />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {displayTitle}
      </h3>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
        {displayMessage}
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        )}
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        {onGoHome && (
          <button
            onClick={onGoHome}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Home className="h-4 w-4" />
            Go Home
          </button>
        )}
      </div>

      {showDetails && errorMessage && (
        <details className="mt-6 text-left w-full max-w-lg">
          <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
            Error Details (Development Mode)
          </summary>
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm font-mono text-red-600 dark:text-red-400 break-all">
              {errorMessage}
            </p>
            {errorStack && (
              <pre className="mt-2 text-xs text-red-500 dark:text-red-400/80 overflow-auto max-h-40">
                {errorStack}
              </pre>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

// ============================================
// EmptyState Component
// ============================================

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  title = 'No Data',
  message = 'There is nothing here yet',
  icon,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center p-8',
      className
    )}>
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        {icon || <PackageOpen className="h-8 w-8 text-gray-400" />}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
        {message}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================
// Exports
// ============================================

export type { LoadingStateProps, ErrorStateProps, EmptyStateProps };

