/**
 * 主题性能监控
 * 记录主题加载时间和性能指标
 */

export interface ThemeLoadMetrics {
  slug: string;
  loadTime: number;       // 毫秒
  cacheHit: boolean;      // 是否命中缓存
  timestamp: number;      // 加载时间戳
  bundleSize?: number;    // 包大小（字节）
  error?: string;         // 错误信息
}

// 性能指标存储
const metricsStore: ThemeLoadMetrics[] = [];
const MAX_METRICS = 100; // 最多保存100条记录

/**
 * 记录主题加载性能
 */
export function recordThemeLoad(metrics: ThemeLoadMetrics): void {
  // 添加到存储
  metricsStore.push(metrics);
  
  // 限制存储大小
  if (metricsStore.length > MAX_METRICS) {
    metricsStore.shift();
  }
  
  // 开发模式下输出日志
  if (process.env.NODE_ENV === 'development') {
    const emoji = metrics.error ? '❌' : metrics.cacheHit ? '⚡' : '✅';
    console.log(
      `${emoji} Theme "${metrics.slug}" loaded in ${metrics.loadTime.toFixed(2)}ms`,
      metrics.cacheHit ? '(cached)' : '(fresh)'
    );
  }
  
  // 发送到分析服务（可选）
  sendToAnalytics(metrics);
}

/**
 * 测量主题加载时间
 */
export async function measureThemeLoad<T>(
  slug: string,
  loadFn: () => Promise<T>,
  cacheHit: boolean = false
): Promise<{ result: T; metrics: ThemeLoadMetrics }> {
  const startTime = performance.now();
  let error: string | undefined;
  let result: T;
  
  try {
    result = await loadFn();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
    throw err;
  } finally {
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    const metrics: ThemeLoadMetrics = {
      slug,
      loadTime,
      cacheHit,
      timestamp: Date.now(),
      error
    };
    
    recordThemeLoad(metrics);
  }
  
  return {
    result: result!,
    metrics: {
      slug,
      loadTime: performance.now() - startTime,
      cacheHit,
      timestamp: Date.now()
    }
  };
}

/**
 * 获取性能统计
 */
export function getThemePerformanceStats(): {
  totalLoads: number;
  avgLoadTime: number;
  cacheHitRate: number;
  errorRate: number;
  recentMetrics: ThemeLoadMetrics[];
} {
  if (metricsStore.length === 0) {
    return {
      totalLoads: 0,
      avgLoadTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      recentMetrics: []
    };
  }
  
  const totalLoads = metricsStore.length;
  const avgLoadTime = metricsStore.reduce((sum, m) => sum + m.loadTime, 0) / totalLoads;
  const cacheHits = metricsStore.filter(m => m.cacheHit).length;
  const errors = metricsStore.filter(m => m.error).length;
  
  return {
    totalLoads,
    avgLoadTime,
    cacheHitRate: cacheHits / totalLoads,
    errorRate: errors / totalLoads,
    recentMetrics: metricsStore.slice(-10) // 最近10条
  };
}

/**
 * 清除性能指标
 */
export function clearThemeMetrics(): void {
  metricsStore.length = 0;
}

/**
 * 发送到分析服务
 */
async function sendToAnalytics(metrics: ThemeLoadMetrics): Promise<void> {
  // 检查是否配置了分析端点
  const analyticsEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  
  if (!analyticsEndpoint) {
    return;
  }
  
  try {
    await fetch(analyticsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'theme_performance',
        data: metrics
      }),
      keepalive: true // 允许页面卸载时发送
    });
  } catch {
    // 静默失败，不影响主流程
  }
}

// 开发工具：暴露到全局
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__THEME_PERFORMANCE__ = {
    getStats: getThemePerformanceStats,
    getMetrics: () => [...metricsStore],
    clear: clearThemeMetrics
  };
}

