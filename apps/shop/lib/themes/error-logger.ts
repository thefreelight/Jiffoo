/**
 * 主题错误日志
 * 捕获和报告主题相关错误
 */

export interface ThemeErrorContext {
  slug?: string;
  component?: string;
  action?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface ThemeError {
  message: string;
  stack?: string;
  context: ThemeErrorContext;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// 错误日志存储
const errorStore: ThemeError[] = [];
const MAX_ERRORS = 50;

/**
 * 记录主题错误
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
  
  // 添加到本地存储
  errorStore.push(themeError);
  if (errorStore.length > MAX_ERRORS) {
    errorStore.shift();
  }
  
  // 控制台输出
  console.error('[Theme Error]', error.message, context);
  
  // 发送到 Sentry（如果可用）
  sendToSentry(error, context);
  
  // 发送到后端日志服务
  sendToBackend(themeError);
}

/**
 * 发送到 Sentry
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
 * 发送到后端日志服务
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
    // 静默失败
  }
}

/**
 * 获取错误统计
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
 * 清除错误日志
 */
export function clearThemeErrors(): void {
  errorStore.length = 0;
}

/**
 * 创建错误边界用的错误处理函数
 */
export function createThemeErrorHandler(context: ThemeErrorContext) {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    logThemeError(error, {
      ...context,
      componentStack: errorInfo?.componentStack
    }, 'high');
  };
}

// 开发工具：暴露到全局
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__THEME_ERRORS__ = {
    getStats: getThemeErrorStats,
    getErrors: () => [...errorStore],
    clear: clearThemeErrors,
    log: logThemeError
  };
}

