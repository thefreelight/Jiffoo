/**
 * Frontend Performance Monitor
 * 
 * 前端性能监控工具，用于跟踪：
 * - 页面加载时间
 * - API 请求延迟
 * - 组件渲染时间
 * - 重渲染检测
 * 
 * 数据仅在开发环境显示在控制台，生产环境可选发送到分析服务
 */

// 性能指标类型
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 's' | 'count';
  timestamp: number;
  category: 'page' | 'api' | 'render' | 'interaction';
  metadata?: Record<string, unknown>;
}

// 渲染追踪类型
export interface RenderTracker {
  component: string;
  renderCount: number;
  lastRenderTime: number;
  totalRenderTime: number;
  averageRenderTime: number;
}

// 性能监控配置
export interface PerformanceConfig {
  enabled: boolean;
  logToConsole: boolean;
  slowThreshold: number; // ms - 慢操作阈值
  renderWarningThreshold: number; // 重渲染警告阈值
  sendToServer: boolean;
  serverEndpoint?: string;
}

const defaultConfig: PerformanceConfig = {
  enabled: process.env.NODE_ENV === 'development',
  logToConsole: process.env.NODE_ENV === 'development',
  slowThreshold: 100, // 100ms 以上视为慢操作
  renderWarningThreshold: 5, // 5次以上重渲染警告
  sendToServer: false,
};

// 全局状态
let config: PerformanceConfig = { ...defaultConfig };
const metrics: PerformanceMetric[] = [];
const renderTrackers: Map<string, RenderTracker> = new Map();
const apiTimings: Map<string, number> = new Map();

/**
 * 初始化性能监控
 */
export function initPerformanceMonitor(customConfig?: Partial<PerformanceConfig>) {
  config = { ...defaultConfig, ...customConfig };
  
  if (!config.enabled) return;
  
  // 监听页面加载性能
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      trackPageLoad();
    });
    
    // 暴露到 window 供调试
    (window as any).__PERF_MONITOR__ = {
      getMetrics: () => [...metrics],
      getRenderTrackers: () => Object.fromEntries(renderTrackers),
      getConfig: () => ({ ...config }),
      clear: clearMetrics,
    };
  }
}

/**
 * 追踪页面加载性能
 */
function trackPageLoad() {
  if (typeof window === 'undefined' || !window.performance) return;
  
  const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  if (timing) {
    const pageLoadTime = timing.loadEventEnd - timing.startTime;
    const domContentLoaded = timing.domContentLoadedEventEnd - timing.startTime;
    const ttfb = timing.responseStart - timing.requestStart;
    
    recordMetric({
      name: 'page_load',
      value: pageLoadTime,
      unit: 'ms',
      timestamp: Date.now(),
      category: 'page',
      metadata: {
        domContentLoaded,
        ttfb,
        url: window.location.pathname,
      },
    });
    
    if (config.logToConsole) {
      console.log(
        `%c📊 页面加载性能`,
        'color: #10b981; font-weight: bold;',
        {
          '总加载时间': `${pageLoadTime.toFixed(0)}ms`,
          'DOM 加载': `${domContentLoaded.toFixed(0)}ms`,
          'TTFB': `${ttfb.toFixed(0)}ms`,
          '路径': window.location.pathname,
        }
      );
    }
  }
}

/**
 * 记录性能指标
 */
export function recordMetric(metric: PerformanceMetric) {
  if (!config.enabled) return;
  
  metrics.push(metric);
  
  // 保持最近 1000 条记录
  if (metrics.length > 1000) {
    metrics.shift();
  }
  
  // 慢操作警告
  if (metric.value > config.slowThreshold && config.logToConsole) {
    console.warn(
      `%c⚠️ 慢操作检测: ${metric.name}`,
      'color: #f59e0b; font-weight: bold;',
      `${metric.value.toFixed(0)}ms > ${config.slowThreshold}ms`,
      metric.metadata
    );
  }
}

/**
 * 追踪 API 请求开始
 */
export function trackApiStart(url: string, requestId: string = url) {
  if (!config.enabled) return;
  apiTimings.set(requestId, performance.now());
}

/**
 * 追踪 API 请求结束
 */
export function trackApiEnd(
  url: string, 
  requestId: string = url,
  status?: number,
  metadata?: Record<string, unknown>
) {
  if (!config.enabled) return;
  
  const startTime = apiTimings.get(requestId);
  if (!startTime) return;
  
  const duration = performance.now() - startTime;
  apiTimings.delete(requestId);
  
  recordMetric({
    name: `api_${url}`,
    value: duration,
    unit: 'ms',
    timestamp: Date.now(),
    category: 'api',
    metadata: {
      url,
      status,
      ...metadata,
    },
  });
  
  if (config.logToConsole) {
    const color = status && status >= 400 ? '#ef4444' : duration > config.slowThreshold ? '#f59e0b' : '#10b981';
    console.log(
      `%c🌐 API: ${url}`,
      `color: ${color};`,
      `${duration.toFixed(0)}ms`,
      status ? `(${status})` : ''
    );
  }
}

/**
 * 追踪组件渲染
 */
export function trackRender(componentName: string, renderTime?: number) {
  if (!config.enabled) return;
  
  const tracker = renderTrackers.get(componentName) || {
    component: componentName,
    renderCount: 0,
    lastRenderTime: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
  };
  
  tracker.renderCount++;
  if (renderTime !== undefined) {
    tracker.lastRenderTime = renderTime;
    tracker.totalRenderTime += renderTime;
    tracker.averageRenderTime = tracker.totalRenderTime / tracker.renderCount;
  }
  
  renderTrackers.set(componentName, tracker);
  
  // 重渲染警告
  if (tracker.renderCount > config.renderWarningThreshold && config.logToConsole) {
    console.warn(
      `%c🔄 频繁重渲染: ${componentName}`,
      'color: #f59e0b; font-weight: bold;',
      `已渲染 ${tracker.renderCount} 次`,
      renderTime ? `最近一次: ${renderTime.toFixed(2)}ms` : ''
    );
  }
}

/**
 * 重置组件渲染计数器（通常在路由切换时调用）
 */
export function resetRenderTrackers() {
  renderTrackers.clear();
}

/**
 * 清除所有指标
 */
export function clearMetrics() {
  metrics.length = 0;
  renderTrackers.clear();
  apiTimings.clear();
}

/**
 * 获取性能摘要
 */
export function getPerformanceSummary() {
  const apiMetrics = metrics.filter(m => m.category === 'api');
  const pageMetrics = metrics.filter(m => m.category === 'page');
  
  const avgApiTime = apiMetrics.length > 0
    ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length
    : 0;
  
  const slowApis = apiMetrics.filter(m => m.value > config.slowThreshold);
  
  const frequentRenders = Array.from(renderTrackers.values())
    .filter(t => t.renderCount > config.renderWarningThreshold);
  
  return {
    totalMetrics: metrics.length,
    apiCalls: apiMetrics.length,
    averageApiTime: avgApiTime,
    slowApiCalls: slowApis.length,
    pageLoads: pageMetrics.length,
    frequentRerenders: frequentRenders.length,
    renderTrackers: Object.fromEntries(renderTrackers),
  };
}

/**
 * React Hook: 追踪组件渲染
 */
export function useRenderTracker(componentName: string) {
  if (typeof window === 'undefined' || !config.enabled) return;
  
  const startTime = performance.now();
  
  // 在 effect 后测量
  queueMicrotask(() => {
    const renderTime = performance.now() - startTime;
    trackRender(componentName, renderTime);
  });
}

/**
 * 性能测量装饰器（用于函数）
 */
export function measurePerformance<T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  category: PerformanceMetric['category'] = 'render'
): T {
  if (!config.enabled) return fn;
  
  return ((...args: Parameters<T>) => {
    const startTime = performance.now();
    const result = fn(...args);
    
    // 处理 Promise
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - startTime;
        recordMetric({
          name,
          value: duration,
          unit: 'ms',
          timestamp: Date.now(),
          category,
        });
      });
    }
    
    const duration = performance.now() - startTime;
    recordMetric({
      name,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      category,
    });
    
    return result;
  }) as T;
}

// 自动初始化
if (typeof window !== 'undefined') {
  initPerformanceMonitor();
}

export default {
  initPerformanceMonitor,
  recordMetric,
  trackApiStart,
  trackApiEnd,
  trackRender,
  resetRenderTrackers,
  clearMetrics,
  getPerformanceSummary,
  useRenderTracker,
  measurePerformance,
};

