/**
 * Frontend Performance Monitor
 * 
 * Frontend performance monitoring tool for tracking:
 * - Page load time
 * - API request latency
 * - Component render time
 * - Re-render detection
 * 
 * Logs only to console in development, optionally sends to analytics in production.
 */

// Performance metric types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 's' | 'count';
  timestamp: number;
  category: 'page' | 'api' | 'render' | 'interaction';
  metadata?: Record<string, unknown>;
}

// Render tracker types
export interface RenderTracker {
  component: string;
  renderCount: number;
  lastRenderTime: number;
  totalRenderTime: number;
  averageRenderTime: number;
}

// Performance monitoring configuration
export interface PerformanceConfig {
  enabled: boolean;
  logToConsole: boolean;
  slowThreshold: number; // ms - Threshold for slow operations
  renderWarningThreshold: number; // Threshold for re-render warnings
  sendToServer: boolean;
  serverEndpoint?: string;
}

const defaultConfig: PerformanceConfig = {
  enabled: process.env.NODE_ENV === 'development',
  logToConsole: process.env.NODE_ENV === 'development',
  slowThreshold: 100, // Considered slow if over 100ms
  renderWarningThreshold: 5, // Alert if re-rendered more than 5 times
  sendToServer: false,
};

// Global state
let config: PerformanceConfig = { ...defaultConfig };
const metrics: PerformanceMetric[] = [];
const renderTrackers: Map<string, RenderTracker> = new Map();
const apiTimings: Map<string, number> = new Map();

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitor(customConfig?: Partial<PerformanceConfig>) {
  config = { ...defaultConfig, ...customConfig };

  if (!config.enabled) return;

  // Monitor page load performance
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      trackPageLoad();
    });

    // Expose to window for debugging
    (window as any).__PERF_MONITOR__ = {
      getMetrics: () => [...metrics],
      getRenderTrackers: () => Object.fromEntries(renderTrackers),
      getConfig: () => ({ ...config }),
      clear: clearMetrics,
    };
  }
}

/**
 * Track page load performance
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
        `%c📊 Page Load Performance`,
        'color: #10b981; font-weight: bold;',
        {
          'Total Load Time': `${pageLoadTime.toFixed(0)}ms`,
          'DOM Content Loaded': `${domContentLoaded.toFixed(0)}ms`,
          'TTFB': `${ttfb.toFixed(0)}ms`,
          'Path': window.location.pathname,
        }
      );
    }
  }
}

/**
 * Record performance metric
 */
export function recordMetric(metric: PerformanceMetric) {
  if (!config.enabled) return;

  metrics.push(metric);

  // Keep recent 1000 records
  if (metrics.length > 1000) {
    metrics.shift();
  }

  // Slow operation warning
  if (metric.value > config.slowThreshold && config.logToConsole) {
    console.warn(
      `%c⚠️ Slow Operation Detected: ${metric.name}`,
      'color: #f59e0b; font-weight: bold;',
      `${metric.value.toFixed(0)}ms > ${config.slowThreshold}ms`,
      metric.metadata
    );
  }
}

/**
 * Track API request start
 */
export function trackApiStart(url: string, requestId: string = url) {
  if (!config.enabled) return;
  apiTimings.set(requestId, performance.now());
}

/**
 * Track API request end
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
 * Track component render
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

  // Re-render warning
  if (tracker.renderCount > config.renderWarningThreshold && config.logToConsole) {
    console.warn(
      `%c🔄 Frequent Re-renders: ${componentName}`,
      'color: #f59e0b; font-weight: bold;',
      `Rendered ${tracker.renderCount} times`,
      renderTime ? `Latest: ${renderTime.toFixed(2)}ms` : ''
    );
  }
}

/**
 * Reset component render trackers (usually called on route change)
 */
export function resetRenderTrackers() {
  renderTrackers.clear();
}

/**
 * Clear all metrics
 */
export function clearMetrics() {
  metrics.length = 0;
  renderTrackers.clear();
  apiTimings.clear();
}

/**
 * Get performance summary
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
 * React Hook: Track component render
 */
export function useRenderTracker(componentName: string) {
  if (typeof window === 'undefined' || !config.enabled) return;

  const startTime = performance.now();

  // Measure after effect
  queueMicrotask(() => {
    const renderTime = performance.now() - startTime;
    trackRender(componentName, renderTime);
  });
}

/**
 * Performance measurement decorator (for functions)
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

    // Handle Promise
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

// Auto initialize
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

