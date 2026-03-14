/**
 * Health Check Service
 * 
 * Provides comprehensive system health check capabilities
 */

/**
 * Health Status Enum
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Single Check Result
 */
export interface CheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

/**
 * Overall Health Check Result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  checks: CheckResult[];
  version?: string;
}

/**
 * Health Check Function Type
 */
export type HealthCheckFn = () => Promise<CheckResult>;

/**
 * Health Check Configuration
 */
export interface HealthCheckConfig {
  /** Check timeout (ms) */
  timeout?: number;
  /** Application version */
  version?: string;
  /** Startup time */
  startTime?: Date;
  /** Enable metrics tracking */
  enableMetrics?: boolean;
  /** Maximum number of response times to store per check */
  maxMetricsHistory?: number;
}

/**
 * Check Metrics
 */
export interface CheckMetrics {
  name: string;
  totalCalls: number;
  errorCount: number;
  successCount: number;
  errorRate: number;
  avgResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  lastError?: string;
  lastErrorTimestamp?: string;
}

/**
 * Default Configuration
 */
const DEFAULT_CONFIG: Required<HealthCheckConfig> = {
  timeout: 5000,
  version: '1.0.0',
  startTime: new Date(),
  enableMetrics: true,
  maxMetricsHistory: 100,
};

/**
 * Metrics Data Storage
 */
interface MetricsData {
  totalCalls: number;
  errorCount: number;
  successCount: number;
  responseTimes: number[];
  lastError?: string;
  lastErrorTimestamp?: string;
}

/**
 * Health Check Service Class
 */
export class HealthCheckService {
  private config: Required<HealthCheckConfig>;
  private checks: Map<string, HealthCheckFn> = new Map();
  private livenessChecks: Map<string, HealthCheckFn> = new Map();
  private readinessChecks: Map<string, HealthCheckFn> = new Map();
  private metricsData: Map<string, MetricsData> = new Map();

  constructor(config: HealthCheckConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register health check
   */
  registerCheck(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
  }

  /**
   * Register liveness check
   */
  registerLivenessCheck(name: string, check: HealthCheckFn): void {
    this.livenessChecks.set(name, check);
  }

  /**
   * Register readiness check
   */
  registerReadinessCheck(name: string, check: HealthCheckFn): void {
    this.readinessChecks.set(name, check);
  }

  /**
   * Execute all health checks
   */
  async checkAll(): Promise<HealthCheckResult> {
    const results = await this.runChecks(this.checks);
    return this.buildResult(results);
  }

  /**
   * Execute liveness checks
   */
  async checkLiveness(): Promise<HealthCheckResult> {
    // Liveness checks should be quick, just checking if the process is running
    const results: CheckResult[] = [
      {
        name: 'process',
        status: HealthStatus.HEALTHY,
        message: 'Process is running',
      },
    ];

    // If there are custom liveness checks, run them too
    if (this.livenessChecks.size > 0) {
      const customResults = await this.runChecks(this.livenessChecks);
      results.push(...customResults);
    }

    return this.buildResult(results);
  }

  /**
   * Execute readiness checks
   */
  async checkReadiness(): Promise<HealthCheckResult> {
    const results = await this.runChecks(this.readinessChecks);
    return this.buildResult(results);
  }

  /**
   * Run a collection of checks
   */
  private async runChecks(
    checks: Map<string, HealthCheckFn>
  ): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    for (const [name, check] of checks) {
      const startTime = Date.now();
      try {
        const result = await Promise.race([
          check(),
          this.createTimeoutPromise(name),
        ]);
        result.latencyMs = Date.now() - startTime;
        results.push(result);

        // Track metrics for successful checks
        if (this.config.enableMetrics) {
          const isError = result.status === HealthStatus.UNHEALTHY;
          this.recordMetrics(name, result.latencyMs, isError);
        }
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Check failed';

        results.push({
          name,
          status: HealthStatus.UNHEALTHY,
          message: errorMessage,
          latencyMs,
        });

        // Track metrics for failed checks
        if (this.config.enableMetrics) {
          this.recordMetrics(name, latencyMs, true, errorMessage);
        }
      }
    }

    return results;
  }

  /**
   * Create timeout Promise
   */
  private createTimeoutPromise(name: string): Promise<CheckResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check '${name}' timed out`));
      }, this.config.timeout);
    });
  }

  /**
   * Build health check result
   */
  private buildResult(checks: CheckResult[]): HealthCheckResult {
    const hasUnhealthy = checks.some(c => c.status === HealthStatus.UNHEALTHY);
    const hasDegraded = checks.some(c => c.status === HealthStatus.DEGRADED);

    let status: HealthStatus;
    if (hasUnhealthy) {
      status = HealthStatus.UNHEALTHY;
    } else if (hasDegraded) {
      status = HealthStatus.DEGRADED;
    } else {
      status = HealthStatus.HEALTHY;
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.config.startTime.getTime(),
      checks,
      version: this.config.version,
    };
  }

  /**
   * Get uptime (seconds)
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.config.startTime.getTime()) / 1000);
  }

  /**
   * Record metrics for a check execution
   */
  private recordMetrics(
    name: string,
    responseTimeMs: number,
    isError: boolean,
    errorMessage?: string
  ): void {
    let data = this.metricsData.get(name);

    if (!data) {
      data = {
        totalCalls: 0,
        errorCount: 0,
        successCount: 0,
        responseTimes: [],
      };
      this.metricsData.set(name, data);
    }

    // Update counters
    data.totalCalls++;
    if (isError) {
      data.errorCount++;
      data.lastError = errorMessage;
      data.lastErrorTimestamp = new Date().toISOString();
    } else {
      data.successCount++;
    }

    // Track response times (keep within limit)
    data.responseTimes.push(responseTimeMs);
    if (data.responseTimes.length > this.config.maxMetricsHistory) {
      data.responseTimes.shift();
    }
  }

  /**
   * Get metrics for a specific check
   */
  getCheckMetrics(name: string): CheckMetrics | undefined {
    const data = this.metricsData.get(name);
    if (!data) {
      return undefined;
    }

    return this.calculateMetrics(name, data);
  }

  /**
   * Get metrics for all checks
   */
  getAllMetrics(): CheckMetrics[] {
    const metrics: CheckMetrics[] = [];

    for (const [name, data] of this.metricsData) {
      metrics.push(this.calculateMetrics(name, data));
    }

    return metrics;
  }

  /**
   * Calculate metrics from raw data
   */
  private calculateMetrics(name: string, data: MetricsData): CheckMetrics {
    const responseTimes = data.responseTimes;
    const avgResponseTimeMs = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;
    const minResponseTimeMs = responseTimes.length > 0
      ? Math.min(...responseTimes)
      : 0;
    const maxResponseTimeMs = responseTimes.length > 0
      ? Math.max(...responseTimes)
      : 0;
    const errorRate = data.totalCalls > 0
      ? (data.errorCount / data.totalCalls) * 100
      : 0;

    return {
      name,
      totalCalls: data.totalCalls,
      errorCount: data.errorCount,
      successCount: data.successCount,
      errorRate,
      avgResponseTimeMs,
      minResponseTimeMs,
      maxResponseTimeMs,
      lastError: data.lastError,
      lastErrorTimestamp: data.lastErrorTimestamp,
    };
  }

  /**
   * Reset metrics for a specific check
   */
  resetCheckMetrics(name: string): void {
    this.metricsData.delete(name);
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.metricsData.clear();
  }
}

// Predefined health check factory functions

/**
 * Create Database Check
 */
export function createDatabaseCheck(
  name: string,
  pingFn: () => Promise<void>
): HealthCheckFn {
  return async () => {
    try {
      await pingFn();
      return {
        name,
        status: HealthStatus.HEALTHY,
        message: 'Database connection is healthy',
      };
    } catch (error) {
      return {
        name,
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  };
}

/**
 * Redis Cache Statistics
 */
export interface RedisCacheStats {
  [key: string]: unknown;
  hitRate?: number;
  missRate?: number;
  keyCount?: number;
  memoryUsed?: number;
  memoryPeak?: number;
  evictedKeys?: number;
  connectedClients?: number;
  uptime?: number;
}

/**
 * Create Redis Check
 */
export function createRedisCheck(
  name: string,
  pingFn: () => Promise<string>
): HealthCheckFn {
  return async () => {
    try {
      const result = await pingFn();
      return {
        name,
        status: result === 'PONG' ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        message: `Redis responded: ${result}`,
      };
    } catch (error) {
      return {
        name,
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  };
}

/**
 * Create Redis Cache Statistics Check
 */
export function createRedisCacheStatsCheck(
  name: string,
  statsFn: () => Promise<RedisCacheStats>
): HealthCheckFn {
  return async () => {
    try {
      const stats = await statsFn();

      // Determine health status based on cache stats
      let status = HealthStatus.HEALTHY;
      const messages: string[] = [];

      // Check hit rate (if available)
      if (stats.hitRate !== undefined) {
        if (stats.hitRate < 50) {
          status = HealthStatus.DEGRADED;
          messages.push(`Low hit rate: ${stats.hitRate.toFixed(1)}%`);
        } else {
          messages.push(`Hit rate: ${stats.hitRate.toFixed(1)}%`);
        }
      }

      // Check memory usage (if available)
      if (stats.memoryUsed !== undefined && stats.memoryPeak !== undefined) {
        const memoryPercent = (stats.memoryUsed / stats.memoryPeak) * 100;
        if (memoryPercent > 90) {
          status = HealthStatus.DEGRADED;
          messages.push(`High memory usage: ${memoryPercent.toFixed(1)}%`);
        }
      }

      // Check eviction rate
      if (stats.evictedKeys !== undefined && stats.evictedKeys > 0) {
        if (status === HealthStatus.HEALTHY) {
          status = HealthStatus.DEGRADED;
        }
        messages.push(`Keys evicted: ${stats.evictedKeys}`);
      }

      return {
        name,
        status,
        message: messages.length > 0 ? messages.join(', ') : 'Cache is healthy',
        details: stats,
      };
    } catch (error) {
      return {
        name,
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Redis cache stats check failed',
      };
    }
  };
}

/**
 * Create HTTP Endpoint Check
 */
export function createHttpCheck(
  name: string,
  url: string,
  expectedStatus = 200
): HealthCheckFn {
  return async () => {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.status === expectedStatus) {
        return {
          name,
          status: HealthStatus.HEALTHY,
          message: `HTTP endpoint returned ${response.status}`,
        };
      }
      return {
        name,
        status: HealthStatus.DEGRADED,
        message: `HTTP endpoint returned ${response.status}, expected ${expectedStatus}`,
      };
    } catch (error) {
      return {
        name,
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'HTTP check failed',
      };
    }
  };
}

/**
 * Create Memory Usage Check
 */
export function createMemoryCheck(
  name: string,
  thresholdPercent = 90
): HealthCheckFn {
  return async () => {
    const used = process.memoryUsage();
    const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;

    if (heapUsedPercent > thresholdPercent) {
      return {
        name,
        status: HealthStatus.DEGRADED,
        message: `Memory usage is ${heapUsedPercent.toFixed(1)}%`,
        details: {
          heapUsed: used.heapUsed,
          heapTotal: used.heapTotal,
          rss: used.rss,
        },
      };
    }

    return {
      name,
      status: HealthStatus.HEALTHY,
      message: `Memory usage is ${heapUsedPercent.toFixed(1)}%`,
      details: {
        heapUsed: used.heapUsed,
        heapTotal: used.heapTotal,
        rss: used.rss,
      },
    };
  };
}

/**
 * Create Default Health Check Service Instance
 */
export function createHealthCheckService(
  config?: HealthCheckConfig
): HealthCheckService {
  return new HealthCheckService(config);
}

