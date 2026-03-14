/**
 * Prisma Query Analyzer for Performance Monitoring
 *
 * Tracks database query performance, identifies slow queries,
 * and provides optimization suggestions.
 */

import { unifiedLogger } from '../logger/unified-logger';

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  params?: any;
  model?: string;
  action?: string;
}

export interface SlowQueryRecord extends QueryMetrics {
  threshold: number;
  recommendation?: string;
}

export interface QueryStats {
  totalQueries: number;
  slowQueries: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  queriesByModel: Record<string, number>;
  queriesByAction: Record<string, number>;
}

/**
 * Query Analyzer Service
 *
 * Monitors Prisma queries and provides performance insights
 */
export class QueryAnalyzer {
  private static readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second in ms
  private static readonly MAX_HISTORY_SIZE = 1000;
  private static readonly STATS_WINDOW_MS = 3600000; // 1 hour

  private static queryHistory: QueryMetrics[] = [];
  private static slowQueries: SlowQueryRecord[] = [];
  private static enabled: boolean = true;

  /**
   * Enable query analysis
   */
  static enable(): void {
    this.enabled = true;
    unifiedLogger.info('Query analyzer enabled');
  }

  /**
   * Disable query analysis
   */
  static disable(): void {
    this.enabled = false;
    unifiedLogger.info('Query analyzer disabled');
  }

  /**
   * Check if analyzer is enabled
   */
  static isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record a query execution
   */
  static recordQuery(metrics: QueryMetrics): void {
    if (!this.enabled) return;

    // Add to history
    this.queryHistory.push(metrics);

    // Maintain history size limit
    if (this.queryHistory.length > this.MAX_HISTORY_SIZE) {
      this.queryHistory.shift();
    }

    // Check if it's a slow query
    if (metrics.duration >= this.SLOW_QUERY_THRESHOLD) {
      const slowQuery: SlowQueryRecord = {
        ...metrics,
        threshold: this.SLOW_QUERY_THRESHOLD,
        recommendation: this.generateRecommendation(metrics)
      };

      this.slowQueries.push(slowQuery);

      // Log slow query warning
      unifiedLogger.warn('Slow query detected', {
        type: 'performance',
        query: metrics.query,
        duration: metrics.duration,
        model: metrics.model,
        action: metrics.action,
        threshold: this.SLOW_QUERY_THRESHOLD,
        recommendation: slowQuery.recommendation
      });
    }

    // Log performance metric
    unifiedLogger.logPerformance(
      `Database Query: ${metrics.model || 'unknown'}.${metrics.action || 'unknown'}`,
      metrics.duration,
      {
        query: metrics.query,
        params: metrics.params
      }
    );
  }

  /**
   * Get query statistics for a time window
   */
  static getStats(windowMs: number = this.STATS_WINDOW_MS): QueryStats {
    const cutoff = Date.now() - windowMs;
    const recentQueries = this.queryHistory.filter(
      q => q.timestamp.getTime() > cutoff
    );

    if (recentQueries.length === 0) {
      return {
        totalQueries: 0,
        slowQueries: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        queriesByModel: {},
        queriesByAction: {}
      };
    }

    const durations = recentQueries.map(q => q.duration);
    const slowQueryCount = recentQueries.filter(
      q => q.duration >= this.SLOW_QUERY_THRESHOLD
    ).length;

    // Group by model and action
    const queriesByModel: Record<string, number> = {};
    const queriesByAction: Record<string, number> = {};

    recentQueries.forEach(q => {
      if (q.model) {
        queriesByModel[q.model] = (queriesByModel[q.model] || 0) + 1;
      }
      if (q.action) {
        queriesByAction[q.action] = (queriesByAction[q.action] || 0) + 1;
      }
    });

    return {
      totalQueries: recentQueries.length,
      slowQueries: slowQueryCount,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      queriesByModel,
      queriesByAction
    };
  }

  /**
   * Get slow queries
   */
  static getSlowQueries(limit: number = 10): SlowQueryRecord[] {
    return this.slowQueries
      .slice(-limit)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get recent queries
   */
  static getRecentQueries(limit: number = 10): QueryMetrics[] {
    return this.queryHistory.slice(-limit).reverse();
  }

  /**
   * Clear all recorded data
   */
  static clear(): void {
    this.queryHistory = [];
    this.slowQueries = [];
    unifiedLogger.info('Query analyzer data cleared');
  }

  /**
   * Set slow query threshold
   */
  static setSlowQueryThreshold(thresholdMs: number): void {
    if (thresholdMs < 0) {
      throw new Error('Threshold must be positive');
    }
    // Using a local variable since SLOW_QUERY_THRESHOLD is readonly
    Object.defineProperty(this, 'SLOW_QUERY_THRESHOLD', {
      value: thresholdMs,
      writable: false,
      configurable: true
    });
    unifiedLogger.info('Slow query threshold updated', {
      threshold: `${thresholdMs}ms`
    });
  }

  /**
   * Generate optimization recommendation for a query
   */
  private static generateRecommendation(metrics: QueryMetrics): string {
    const query = metrics.query.toLowerCase();
    const recommendations: string[] = [];

    // Check for missing indexes
    if (query.includes('where') && !query.includes('index')) {
      recommendations.push('Consider adding an index on WHERE clause columns');
    }

    // Check for SELECT *
    if (query.includes('select *')) {
      recommendations.push('Avoid SELECT *, specify only needed columns');
    }

    // Check for N+1 queries pattern
    if (metrics.action === 'findMany' || metrics.action === 'findUnique') {
      recommendations.push('Consider using include/select to avoid N+1 queries');
    }

    // Check for large result sets
    if (query.includes('select') && !query.includes('limit') && !query.includes('take')) {
      recommendations.push('Consider pagination with take/skip to limit result set');
    }

    // Check for complex joins
    if ((query.match(/join/gi) || []).length > 2) {
      recommendations.push('Complex joins detected, consider denormalization or caching');
    }

    // Check for missing orderBy optimization
    if (query.includes('order by') && !query.includes('limit')) {
      recommendations.push('Sorting without LIMIT can be expensive, consider adding take');
    }

    return recommendations.length > 0
      ? recommendations.join('; ')
      : 'Consider caching this query result';
  }

  /**
   * Get a summary report
   */
  static getSummary(): {
    enabled: boolean;
    stats: QueryStats;
    topSlowQueries: SlowQueryRecord[];
    historySize: number;
  } {
    return {
      enabled: this.enabled,
      stats: this.getStats(),
      topSlowQueries: this.getSlowQueries(5),
      historySize: this.queryHistory.length
    };
  }

  /**
   * Create a Prisma middleware for automatic query tracking
   */
  static createPrismaMiddleware() {
    return async (params: any, next: any) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;

      this.recordQuery({
        query: `${params.model}.${params.action}`,
        duration,
        timestamp: new Date(),
        params: params.args,
        model: params.model,
        action: params.action
      });

      return result;
    };
  }
}

// Export default instance for convenience
export default QueryAnalyzer;
