/**
 * Admin Health Monitoring Service
 * Aggregates health metrics from various sources
 */

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { performHealthCheck } from '@/utils/health-check';
// @ts-ignore - path may not resolve at compile time
import { collectSystemMetrics } from '@jiffoo/shared/observability';
import type {
  HealthMetricsResponse,
  DatabasePoolStatus,
  AlertThresholds,
  AlertStatus,
  HealthSummaryResponse,
} from './types';
import { DEFAULT_ALERT_THRESHOLDS } from './types';
// @ts-ignore - path may not resolve at compile time
import type { RedisCacheStats } from '@jiffoo/shared/observability';

// Track service start time for uptime calculation
const serviceStartTime = Date.now();
let totalHealthChecks = 0;
let failedHealthChecks = 0;

export class HealthMonitoringService {
  /**
   * Get comprehensive health metrics
   */
  static async getHealthMetrics(): Promise<HealthMetricsResponse> {
    // 0. Check Cache (15s TTL)
    const cacheKey = 'stats:health-monitoring:metrics';
    const cached = await CacheService.get<HealthMetricsResponse>(cacheKey);
    if (cached) return cached;

    // 1. Collect all metrics in parallel
    const [systemMetrics, healthCheckResult, databasePool, cacheStats, responseMetrics] = await Promise.all([
      // System metrics (CPU, memory, disk)
      collectSystemMetrics(),
      // Health check result
      performHealthCheck(),
      // Database connection pool
      this.getDatabasePoolStatus(),
      // Redis cache statistics
      this.getRedisCacheStats(),
      // Response time metrics (placeholder - will be populated from health check service in future)
      Promise.resolve([]),
    ]);

    // Track health check results for uptime calculation
    totalHealthChecks++;
    if (healthCheckResult.status !== 'ok') {
      failedHealthChecks++;
    }

    // Calculate uptime percentage
    const uptimePercent = totalHealthChecks > 0
      ? ((totalHealthChecks - failedHealthChecks) / totalHealthChecks) * 100
      : 100;

    const result: HealthMetricsResponse = {
      system: systemMetrics,
      health: healthCheckResult,
      database: databasePool,
      cache: cacheStats,
      responseMetrics,
      uptimePercent: Number(uptimePercent.toFixed(2)),
      timestamp: new Date().toISOString(),
    };

    // Cache for 15s
    await CacheService.set(cacheKey, result, { ttl: 15 });

    return result;
  }

  /**
   * Get health summary with alert evaluation
   */
  static async getHealthSummary(
    thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS as AlertThresholds
  ): Promise<HealthSummaryResponse> {
    // 0. Check Cache (15s TTL)
    const cacheKey = `stats:health-monitoring:summary:${JSON.stringify(thresholds)}`;
    const cached = await CacheService.get<HealthSummaryResponse>(cacheKey);
    if (cached) return cached;

    // 1. Get metrics
    const metrics = await this.getHealthMetrics();

    // 2. Extract quick stats
    const stats = {
      cpuUsage: Number((metrics.system as any).cpu?.usage ?? (metrics.system as any).cpu?.usagePercent ?? 0),
      memoryUsage: Number((metrics.system as any).memory?.usage ?? (metrics.system as any).memory?.usagePercent ?? 0),
      diskUsage: Number((metrics.system as any).disk?.usage ?? (metrics.system as any).disk?.usagePercent ?? 0),
      errorRate: this.calculateErrorRate(metrics.responseMetrics),
      avgResponseTime: this.calculateAvgResponseTime(metrics.responseMetrics),
      cacheHitRate: metrics.cache.hitRate ?? 0,
    };

    // 3. Evaluate alerts
    const alerts = this.evaluateAlerts(stats, thresholds);

    // 4. Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (metrics.health.status === 'unhealthy') {
      status = 'unhealthy';
    } else if (metrics.health.status === 'degraded' || alerts.some(a => a.severity === 'critical')) {
      status = 'degraded';
    } else if (alerts.some(a => a.severity === 'warning')) {
      status = 'degraded';
    }

    const result: HealthSummaryResponse = {
      status,
      alerts,
      uptime: Math.floor((Date.now() - serviceStartTime) / 1000),
      stats,
      timestamp: new Date().toISOString(),
    };

    // Cache for 15s
    await CacheService.set(cacheKey, result, { ttl: 15 });

    return result;
  }

  /**
   * Get database connection pool status
   */
  private static async getDatabasePoolStatus(): Promise<DatabasePoolStatus> {
    try {
      // Query PostgreSQL for actual connection stats
      const activeConnections = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) as count
        FROM pg_stat_activity
        WHERE state = 'active' AND pid != pg_backend_pid()
      `;

      const idleConnections = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) as count
        FROM pg_stat_activity
        WHERE state = 'idle' AND pid != pg_backend_pid()
      `;

      const active = Number(activeConnections[0]?.count ?? 0);
      const idle = Number(idleConnections[0]?.count ?? 0);
      const poolSize = active + idle;
      const max = 10; // From Prisma connection pool config
      const waiting = 0; // Would need to track this separately
      const usage = max > 0 ? (poolSize / max) * 100 : 0;

      return {
        size: poolSize,
        active,
        idle,
        max,
        waiting,
        usage: Number(usage.toFixed(2)),
      };
    } catch (error) {
      // Fallback to estimated values if query fails
      return {
        size: 1,
        active: 1,
        idle: 0,
        max: 10,
        waiting: 0,
        usage: 10,
      };
    }
  }

  /**
   * Get Redis cache statistics
   */
  private static async getRedisCacheStats(): Promise<RedisCacheStats> {
    try {
      const redis = CacheService.getRedisClient();

      // Get Redis INFO for different sections
      const [statsInfo, memoryInfo, clientsInfo] = await Promise.all([
        redis.info('stats'),
        redis.info('memory'),
        redis.info('clients'),
      ]);

      // Parse INFO response (format: key:value pairs separated by \r\n)
      const parseInfo = (str: string): Record<string, string> => {
        const lines = str.split('\r\n');
        const result: Record<string, string> = {};
        for (const line of lines) {
          if (!line || line.startsWith('#')) continue;
          const [key, value] = line.split(':');
          if (key && value !== undefined) {
            result[key] = value.trim();
          }
        }
        return result;
      };

      const stats = parseInfo(statsInfo);
      const memory = parseInfo(memoryInfo);
      const clients = parseInfo(clientsInfo);

      // Calculate hit rate
      const keyspaceHits = parseInt(stats.keyspace_hits || '0', 10);
      const keyspaceMisses = parseInt(stats.keyspace_misses || '0', 10);
      const totalOps = keyspaceHits + keyspaceMisses;

      const hitRate = totalOps > 0 ? (keyspaceHits / totalOps) * 100 : 0;
      const missRate = totalOps > 0 ? (keyspaceMisses / totalOps) * 100 : 0;

      // Get key count
      const keyCount = await redis.dbsize();

      return {
        hitRate: Number(hitRate.toFixed(2)),
        missRate: Number(missRate.toFixed(2)),
        keyCount,
        memoryUsed: parseInt(memory.used_memory || '0', 10),
        memoryPeak: parseInt(memory.used_memory_peak || '0', 10),
        evictedKeys: parseInt(stats.evicted_keys || '0', 10),
        connectedClients: parseInt(clients.connected_clients || '0', 10),
        uptime: parseInt(stats.uptime_in_seconds || '0', 10),
      };
    } catch (error) {
      // Return zeros on error (Redis not available)
      return {
        hitRate: 0,
        missRate: 0,
        keyCount: 0,
        memoryUsed: 0,
        memoryPeak: 0,
        evictedKeys: 0,
        connectedClients: 0,
        uptime: 0,
      };
    }
  }

  /**
   * Calculate error rate from response metrics
   */
  private static calculateErrorRate(metrics: any[]): number {
    if (metrics.length === 0) return 0;

    const totalCalls = metrics.reduce((sum, m) => sum + (m.totalCalls || 0), 0);
    const errorCalls = metrics.reduce((sum, m) => sum + (m.errorCount || 0), 0);

    return totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0;
  }

  /**
   * Calculate average response time from metrics
   */
  private static calculateAvgResponseTime(metrics: any[]): number {
    if (metrics.length === 0) return 0;

    const avgTimes = metrics.map(m => m.avgResponseTime || 0).filter(t => t > 0);

    return avgTimes.length > 0
      ? avgTimes.reduce((sum, t) => sum + t, 0) / avgTimes.length
      : 0;
  }

  /**
   * Evaluate alerts based on thresholds
   */
  private static evaluateAlerts(
    stats: HealthSummaryResponse['stats'],
    thresholds: AlertThresholds
  ): AlertStatus[] {
    const alerts: AlertStatus[] = [];
    const now = new Date().toISOString();

    // CPU alert
    if (stats.cpuUsage > thresholds.cpuThreshold) {
      alerts.push({
        type: 'cpu',
        value: stats.cpuUsage,
        threshold: thresholds.cpuThreshold,
        severity: stats.cpuUsage > thresholds.cpuThreshold * 1.2 ? 'critical' : 'warning',
        message: `CPU usage is ${stats.cpuUsage.toFixed(1)}%, exceeding threshold of ${thresholds.cpuThreshold}%`,
        triggeredAt: now,
      });
    }

    // Memory alert
    if (stats.memoryUsage > thresholds.memoryThreshold) {
      alerts.push({
        type: 'memory',
        value: stats.memoryUsage,
        threshold: thresholds.memoryThreshold,
        severity: stats.memoryUsage > thresholds.memoryThreshold * 1.2 ? 'critical' : 'warning',
        message: `Memory usage is ${stats.memoryUsage.toFixed(1)}%, exceeding threshold of ${thresholds.memoryThreshold}%`,
        triggeredAt: now,
      });
    }

    // Disk alert
    if (stats.diskUsage > thresholds.diskThreshold) {
      alerts.push({
        type: 'disk',
        value: stats.diskUsage,
        threshold: thresholds.diskThreshold,
        severity: stats.diskUsage > thresholds.diskThreshold * 1.1 ? 'critical' : 'warning',
        message: `Disk usage is ${stats.diskUsage.toFixed(1)}%, exceeding threshold of ${thresholds.diskThreshold}%`,
        triggeredAt: now,
      });
    }

    // Error rate alert
    if (stats.errorRate > thresholds.errorRateThreshold) {
      alerts.push({
        type: 'error_rate',
        value: stats.errorRate,
        threshold: thresholds.errorRateThreshold,
        severity: stats.errorRate > thresholds.errorRateThreshold * 2 ? 'critical' : 'warning',
        message: `Error rate is ${stats.errorRate.toFixed(2)}%, exceeding threshold of ${thresholds.errorRateThreshold}%`,
        triggeredAt: now,
      });
    }

    // Response time alert
    if (stats.avgResponseTime > thresholds.responseTimeThreshold) {
      alerts.push({
        type: 'response_time',
        value: stats.avgResponseTime,
        threshold: thresholds.responseTimeThreshold,
        severity: stats.avgResponseTime > thresholds.responseTimeThreshold * 2 ? 'critical' : 'warning',
        message: `Average response time is ${stats.avgResponseTime.toFixed(0)}ms, exceeding threshold of ${thresholds.responseTimeThreshold}ms`,
        triggeredAt: now,
      });
    }

    // Cache hit rate alert (inverse - alert if below threshold)
    if (stats.cacheHitRate < thresholds.cacheHitRateThreshold) {
      alerts.push({
        type: 'cache_hit_rate',
        value: stats.cacheHitRate,
        threshold: thresholds.cacheHitRateThreshold,
        severity: stats.cacheHitRate < thresholds.cacheHitRateThreshold * 0.5 ? 'critical' : 'warning',
        message: `Cache hit rate is ${stats.cacheHitRate.toFixed(1)}%, below threshold of ${thresholds.cacheHitRateThreshold}%`,
        triggeredAt: now,
      });
    }

    return alerts;
  }

  /**
   * Reset health check statistics
   */
  static resetStatistics(): void {
    totalHealthChecks = 0;
    failedHealthChecks = 0;
  }
}
