/**
 * Health Check Service - 健康检查服务
 * 
 * 提供全面的系统健康检查能力
 */

/**
 * 健康状态枚举
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * 单个检查结果
 */
export interface CheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

/**
 * 整体健康检查结果
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  checks: CheckResult[];
  version?: string;
}

/**
 * 健康检查函数类型
 */
export type HealthCheckFn = () => Promise<CheckResult>;

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  /** 检查超时时间（毫秒） */
  timeout?: number;
  /** 应用版本 */
  version?: string;
  /** 启动时间 */
  startTime?: Date;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<HealthCheckConfig> = {
  timeout: 5000,
  version: '1.0.0',
  startTime: new Date(),
};

/**
 * Health Check Service 类
 */
export class HealthCheckService {
  private config: Required<HealthCheckConfig>;
  private checks: Map<string, HealthCheckFn> = new Map();
  private livenessChecks: Map<string, HealthCheckFn> = new Map();
  private readinessChecks: Map<string, HealthCheckFn> = new Map();

  constructor(config: HealthCheckConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 注册健康检查
   */
  registerCheck(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
  }

  /**
   * 注册存活检查
   */
  registerLivenessCheck(name: string, check: HealthCheckFn): void {
    this.livenessChecks.set(name, check);
  }

  /**
   * 注册就绪检查
   */
  registerReadinessCheck(name: string, check: HealthCheckFn): void {
    this.readinessChecks.set(name, check);
  }

  /**
   * 执行所有健康检查
   */
  async checkAll(): Promise<HealthCheckResult> {
    const results = await this.runChecks(this.checks);
    return this.buildResult(results);
  }

  /**
   * 执行存活检查
   */
  async checkLiveness(): Promise<HealthCheckResult> {
    // 存活检查应该快速返回，只检查进程是否运行
    const results: CheckResult[] = [
      {
        name: 'process',
        status: HealthStatus.HEALTHY,
        message: 'Process is running',
      },
    ];

    // 如果有自定义存活检查，也执行它们
    if (this.livenessChecks.size > 0) {
      const customResults = await this.runChecks(this.livenessChecks);
      results.push(...customResults);
    }

    return this.buildResult(results);
  }

  /**
   * 执行就绪检查
   */
  async checkReadiness(): Promise<HealthCheckResult> {
    const results = await this.runChecks(this.readinessChecks);
    return this.buildResult(results);
  }

  /**
   * 运行检查集合
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
      } catch (error) {
        results.push({
          name,
          status: HealthStatus.UNHEALTHY,
          message: error instanceof Error ? error.message : 'Check failed',
          latencyMs: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * 创建超时 Promise
   */
  private createTimeoutPromise(name: string): Promise<CheckResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check '${name}' timed out`));
      }, this.config.timeout);
    });
  }

  /**
   * 构建健康检查结果
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
   * 获取运行时间（秒）
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.config.startTime.getTime()) / 1000);
  }
}

// 预定义的健康检查工厂函数

/**
 * 创建数据库健康检查
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
 * 创建 Redis 健康检查
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
 * 创建 HTTP 端点健康检查
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
 * 创建内存使用检查
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
 * 创建默认 Health Check Service 实例
 */
export function createHealthCheckService(
  config?: HealthCheckConfig
): HealthCheckService {
  return new HealthCheckService(config);
}

