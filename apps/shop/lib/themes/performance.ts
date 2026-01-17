/**
 * Theme Performance Monitoring
 * Records theme load times and performance metrics
 */

export interface ThemeLoadMetrics {
  slug: string;
  loadTime: number;       // ms
  cacheHit: boolean;      // Whether cache was hit
  timestamp: number;      // Loading timestamp
  bundleSize?: number;    // Bundle size (bytes)
  error?: string;         // Error message
}

// Performance metrics storage
const metricsStore: ThemeLoadMetrics[] = [];
const MAX_METRICS = 100; // Keep up to 100 records max

/**
 * Record theme load performance
 */
export function recordThemeLoad(metrics: ThemeLoadMetrics): void {
  // Add to storage
  metricsStore.push(metrics);

  // Limit storage size
  if (metricsStore.length > MAX_METRICS) {
    metricsStore.shift();
  }

  // Output log in development mode
  if (process.env.NODE_ENV === 'development') {
    const emoji = metrics.error ? '❌' : metrics.cacheHit ? '⚡' : '✅';
    console.log(
      `${emoji} Theme "${metrics.slug}" loaded in ${metrics.loadTime.toFixed(2)}ms`,
      metrics.cacheHit ? '(cached)' : '(fresh)'
    );
  }

  // Send to analytics service (optional)
  sendToAnalytics(metrics);
}

/**
 * Measure theme load time
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
 * Get performance statistics
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
    recentMetrics: metricsStore.slice(-10) // Last 10 records
  };
}

/**
 * Clear performance metrics
 */
export function clearThemeMetrics(): void {
  metricsStore.length = 0;
}

/**
 * Send to analytics service
 */
async function sendToAnalytics(metrics: ThemeLoadMetrics): Promise<void> {
  // Check if analytics endpoint is configured
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
      keepalive: true // Allow sending even if page unmounts
    });
  } catch {
    // Silently fail, don't affect main flow
  }
}

// Development tools: expose to global
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__THEME_PERFORMANCE__ = {
    getStats: getThemePerformanceStats,
    getMetrics: () => [...metricsStore],
    clear: clearThemeMetrics
  };
}

