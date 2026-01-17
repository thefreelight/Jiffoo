/**
 * Theme Error Logger
 * Captures and reports theme-related errors
 */

export interface ThemeErrorContext {
  slug?: string;
  component?: string;
  action?: string;
  userId?: string;

  [key: string]: unknown;
}

export interface ThemeError {
  message: string;
  stack?: string;
  context: ThemeErrorContext;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Error log storage
const errorStore: ThemeError[] = [];
const MAX_ERRORS = 50;

/**
 * Log theme error
 */
export function logThemeError(
  error: Error,
  context: ThemeErrorContext = {},
  severity: ThemeError['severity'] = 'medium'
): void {
  const themeError: ThemeError = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: Date.now(),
    severity
  };

  // Add to local storage
  errorStore.push(themeError);
  if (errorStore.length > MAX_ERRORS) {
    errorStore.shift();
  }

  // Console output
  console.error('[Theme Error]', error.message, context);

  // Send to Sentry (if available)
  sendToSentry(error, context);

  // Send to backend logging service
  sendToBackend(themeError);
}

/**
 * Send to Sentry
 */
function sendToSentry(error: Error, context: ThemeErrorContext): void {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureException(error, {
      tags: {
        component: 'theme',
        slug: context.slug,
        action: context.action
      },
      extra: context
    });
  }
}

/**
 * Send to backend logging service
 */
async function sendToBackend(themeError: ThemeError): Promise<void> {
  const logEndpoint = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/logs/batch`
    : null;

  if (!logEndpoint) return;

  try {
    await fetch(logEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logs: [{
          level: themeError.severity === 'critical' ? 'error' : 'warn',
          message: `[Theme] ${themeError.message}`,
          context: themeError.context,
          timestamp: themeError.timestamp,
          source: 'theme-system'
        }]
      }),
      keepalive: true
    });
  } catch {
    // Silently fail
  }
}

/**
 * Get error statistics
 */
export function getThemeErrorStats(): {
  totalErrors: number;
  bySeverity: Record<ThemeError['severity'], number>;
  recentErrors: ThemeError[];
} {
  const bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  errorStore.forEach(e => {
    bySeverity[e.severity]++;
  });

  return {
    totalErrors: errorStore.length,
    bySeverity,
    recentErrors: errorStore.slice(-5)
  };
}

/**
 * Clear error logs
 */
export function clearThemeErrors(): void {
  errorStore.length = 0;
}

/**
 * Create error handler function for error boundaries
 */
export function createThemeErrorHandler(context: ThemeErrorContext) {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    logThemeError(error, {
      ...context,
      componentStack: errorInfo?.componentStack
    }, 'high');
  };
}

// Dev tools: expose to global
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__THEME_ERRORS__ = {
    getStats: getThemeErrorStats,
    getErrors: () => [...errorStore],
    clear: clearThemeErrors,
    log: logThemeError
  };
}

