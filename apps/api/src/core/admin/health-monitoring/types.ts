// @ts-nocheck
/**
 * Admin Health Monitoring Types
 */

import type {
  SystemMetrics,
  CheckMetrics,
  RedisCacheStats,
  HealthCheckResult,
} from '@jiffoo/shared/observability';

/**
 * Database Connection Pool Status
 */
export interface DatabasePoolStatus {
  /** Total connections in pool */
  size: number;
  /** Active connections in use */
  active: number;
  /** Idle connections available */
  idle: number;
  /** Maximum pool size */
  max: number;
  /** Waiting requests count */
  waiting: number;
  /** Pool usage percentage (0-100) */
  usage: number;
}

/**
 * Health Metrics Response
 */
export interface HealthMetricsResponse {
  /** System metrics (CPU, memory, disk) */
  system: SystemMetrics;
  /** Health check metrics */
  health: HealthCheckResult;
  /** Database connection pool status */
  database: DatabasePoolStatus;
  /** Redis cache statistics */
  cache: RedisCacheStats;
  /** API response time metrics */
  responseMetrics: CheckMetrics[];
  /** Overall uptime percentage */
  uptimePercent: number;
  /** Timestamp of data collection */
  timestamp: string;
}

/**
 * Alert Threshold Configuration
 */
export interface AlertThresholds {
  /** CPU usage threshold (0-100) */
  cpuThreshold: number;
  /** Memory usage threshold (0-100) */
  memoryThreshold: number;
  /** Disk usage threshold (0-100) */
  diskThreshold: number;
  /** Error rate threshold (0-100) */
  errorRateThreshold: number;
  /** Response time threshold (ms) */
  responseTimeThreshold: number;
  /** Cache hit rate threshold (0-100) */
  cacheHitRateThreshold: number;
}

/**
 * Default Alert Thresholds
 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  cpuThreshold: 80,
  memoryThreshold: 85,
  diskThreshold: 90,
  errorRateThreshold: 5,
  responseTimeThreshold: 1000,
  cacheHitRateThreshold: 50,
};

/**
 * Alert Status
 */
export interface AlertStatus {
  /** Alert type */
  type: 'cpu' | 'memory' | 'disk' | 'error_rate' | 'response_time' | 'cache_hit_rate';
  /** Current value */
  value: number;
  /** Threshold value */
  threshold: number;
  /** Alert severity */
  severity: 'warning' | 'critical';
  /** Alert message */
  message: string;
  /** Timestamp when alert was triggered */
  triggeredAt: string;
}

/**
 * Health Summary Response
 */
export interface HealthSummaryResponse {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Active alerts */
  alerts: AlertStatus[];
  /** System uptime (seconds) */
  uptime: number;
  /** Quick stats */
  stats: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    errorRate: number;
    avgResponseTime: number;
    cacheHitRate: number;
  };
  /** Timestamp */
  timestamp: string;
}

/**
 * Alert Threshold Update Input
 */
export interface AlertThresholdUpdateInput {
  cpuThreshold?: number;
  memoryThreshold?: number;
  diskThreshold?: number;
  errorRateThreshold?: number;
  responseTimeThreshold?: number;
  cacheHitRateThreshold?: number;
}

/**
 * Historical Metrics Data Point
 */
export interface MetricsDataPoint {
  /** Timestamp of measurement */
  timestamp: string;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Memory usage percentage */
  memoryUsage: number;
  /** Response time (ms) */
  responseTime: number;
  /** Error rate percentage */
  errorRate: number;
}

/**
 * Historical Metrics Response
 */
export interface HistoricalMetricsResponse {
  /** Time series data points */
  dataPoints: MetricsDataPoint[];
  /** Time range start */
  startTime: string;
  /** Time range end */
  endTime: string;
  /** Interval between data points (seconds) */
  interval: number;
}
