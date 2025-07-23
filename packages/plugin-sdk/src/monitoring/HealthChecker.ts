import { Logger } from '../utils/Logger';
import { PluginHealthStatus, PluginHealthCheck } from '../types/PluginTypes';

/**
 * 健康检查函数类型
 */
type HealthCheckFunction = () => Promise<{
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}>;

/**
 * 健康检查器
 * 负责监控插件各个组件的健康状态
 */
export class HealthChecker {
  private logger: Logger;
  private checks: Map<string, HealthCheckFunction> = new Map();
  private lastCheckTime: Date = new Date();
  private checkInterval: number = 30000; // 30秒
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.logger = new Logger('HealthChecker');
    this.registerDefaultChecks();
  }

  /**
   * 注册默认健康检查
   */
  private registerDefaultChecks(): void {
    // 内存使用检查
    this.registerCheck('memory', async () => {
      const used = process.memoryUsage();
      const totalMB = Math.round(used.rss / 1024 / 1024);
      const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
      
      const heapUsagePercent = (used.heapUsed / used.heapTotal) * 100;
      
      if (heapUsagePercent > 95) {
        return {
          status: 'fail',
          message: `High memory usage: ${heapUsagePercent.toFixed(1)}% (${heapUsedMB}MB/${heapTotalMB}MB)`
        };
      } else if (heapUsagePercent > 85) {
        return {
          status: 'warn',
          message: `Moderate memory usage: ${heapUsagePercent.toFixed(1)}% (${heapUsedMB}MB/${heapTotalMB}MB)`
        };
      }
      
      return {
        status: 'pass',
        message: `Memory usage: ${heapUsagePercent.toFixed(1)}% (${heapUsedMB}MB/${heapTotalMB}MB)`
      };
    });

    // CPU使用检查
    this.registerCheck('cpu', async () => {
      const usage = process.cpuUsage();
      const uptime = process.uptime();

      // 计算CPU使用率（更准确的计算）
      if (uptime < 1) {
        // 如果运行时间太短，返回正常状态
        return {
          status: 'pass',
          message: 'CPU usage: initializing...'
        };
      }

      const userCpuPercent = (usage.user / 1000000 / uptime) * 100;
      const systemCpuPercent = (usage.system / 1000000 / uptime) * 100;
      const totalCpuPercent = Math.min(userCpuPercent + systemCpuPercent, 100); // 限制最大值

      if (totalCpuPercent > 90) {
        return {
          status: 'warn',
          message: `High CPU usage: ${totalCpuPercent.toFixed(1)}%`
        };
      }

      return {
        status: 'pass',
        message: `CPU usage: ${totalCpuPercent.toFixed(1)}%`
      };
    });

    // 进程运行时间检查
    this.registerCheck('uptime', async () => {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      
      return {
        status: 'pass',
        message: `Uptime: ${hours}h ${minutes}m`
      };
    });

    // 事件循环延迟检查
    this.registerCheck('event_loop', async () => {
      return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        setImmediate(() => {
          const delta = process.hrtime.bigint() - start;
          const delayMs = Number(delta) / 1000000;
          
          if (delayMs > 500) {
            resolve({
              status: 'warn',
              message: `High event loop delay: ${delayMs.toFixed(2)}ms`
            });
          } else {
            resolve({
              status: 'pass',
              message: `Event loop delay: ${delayMs.toFixed(2)}ms`
            });
          }
        });
      });
    });
  }

  /**
   * 注册健康检查
   */
  public registerCheck(name: string, checkFunction: HealthCheckFunction): void {
    this.checks.set(name, checkFunction);
    this.logger.debug(`Health check registered: ${name}`);
  }

  /**
   * 移除健康检查
   */
  public unregisterCheck(name: string): boolean {
    const removed = this.checks.delete(name);
    if (removed) {
      this.logger.debug(`Health check unregistered: ${name}`);
    }
    return removed;
  }

  /**
   * 执行单个健康检查
   */
  public async runCheck(name: string): Promise<PluginHealthCheck | null> {
    const checkFunction = this.checks.get(name);
    if (!checkFunction) {
      this.logger.warn(`Health check not found: ${name}`);
      return null;
    }

    const start = Date.now();
    
    try {
      const result = await Promise.race([
        checkFunction(),
        this.createTimeoutPromise(5000) // 5秒超时
      ]);
      
      const duration = Date.now() - start;
      
      return {
        name,
        status: result.status,
        message: result.message,
        duration,
        timestamp: new Date()
      };
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(`Health check failed: ${name}`, error);
      
      return {
        name,
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date()
      };
    }
  }

  /**
   * 执行所有健康检查
   */
  public async runAllChecks(): Promise<PluginHealthCheck[]> {
    const checkNames = Array.from(this.checks.keys());
    const checkPromises = checkNames.map(name => this.runCheck(name));
    
    const results = await Promise.allSettled(checkPromises);
    
    return results
      .map((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        } else {
          return {
            name: checkNames[index],
            status: 'fail' as const,
            message: 'Check execution failed',
            duration: 0,
            timestamp: new Date()
          };
        }
      })
      .filter(Boolean);
  }

  /**
   * 获取健康状态
   */
  public async getStatus(): Promise<PluginHealthStatus> {
    const checks = await this.runAllChecks();
    this.lastCheckTime = new Date();
    
    // 确定整体状态
    const hasFailures = checks.some(check => check.status === 'fail');
    const hasWarnings = checks.some(check => check.status === 'warn');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
    
    const uptime = process.uptime() * 1000; // 转换为毫秒
    
    return {
      status: overallStatus,
      checks,
      lastCheck: this.lastCheckTime,
      uptime
    };
  }

  /**
   * 启动定期健康检查
   */
  public startPeriodicChecks(interval: number = this.checkInterval): void {
    if (this.intervalId) {
      this.stopPeriodicChecks();
    }
    
    this.checkInterval = interval;
    this.intervalId = setInterval(async () => {
      try {
        const status = await this.getStatus();
        
        if (status.status === 'unhealthy') {
          this.logger.error('Health check failed', { status });
        } else if (status.status === 'degraded') {
          this.logger.warn('Health check degraded', { status });
        } else {
          this.logger.debug('Health check passed', { status });
        }
      } catch (error) {
        this.logger.error('Periodic health check failed', error);
      }
    }, interval);
    
    this.logger.info(`Started periodic health checks (interval: ${interval}ms)`);
  }

  /**
   * 停止定期健康检查
   */
  public stopPeriodicChecks(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info('Stopped periodic health checks');
    }
  }

  /**
   * 创建超时Promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * 获取检查统计信息
   */
  public getCheckStats(): {
    totalChecks: number;
    registeredChecks: string[];
    lastCheckTime: Date;
    checkInterval: number;
    isPeriodicRunning: boolean;
  } {
    return {
      totalChecks: this.checks.size,
      registeredChecks: Array.from(this.checks.keys()),
      lastCheckTime: this.lastCheckTime,
      checkInterval: this.checkInterval,
      isPeriodicRunning: !!this.intervalId
    };
  }

  /**
   * 重置健康检查器
   */
  public reset(): void {
    this.stopPeriodicChecks();
    this.checks.clear();
    this.registerDefaultChecks();
    this.lastCheckTime = new Date();
    this.logger.info('Health checker reset');
  }

  /**
   * 创建自定义健康检查
   */
  public static createDatabaseCheck(
    checkFunction: () => Promise<boolean>,
    name: string = 'database'
  ): HealthCheckFunction {
    return async () => {
      try {
        const isHealthy = await checkFunction();
        return {
          status: isHealthy ? 'pass' : 'fail',
          message: isHealthy ? 'Database connection healthy' : 'Database connection failed'
        };
      } catch (error) {
        return {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Database check failed'
        };
      }
    };
  }

  /**
   * 创建缓存健康检查
   */
  public static createCacheCheck(
    checkFunction: () => Promise<boolean>,
    name: string = 'cache'
  ): HealthCheckFunction {
    return async () => {
      try {
        const isHealthy = await checkFunction();
        return {
          status: isHealthy ? 'pass' : 'fail',
          message: isHealthy ? 'Cache connection healthy' : 'Cache connection failed'
        };
      } catch (error) {
        return {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Cache check failed'
        };
      }
    };
  }

  /**
   * 创建外部服务健康检查
   */
  public static createExternalServiceCheck(
    checkFunction: () => Promise<boolean>,
    serviceName: string
  ): HealthCheckFunction {
    return async () => {
      try {
        const isHealthy = await checkFunction();
        return {
          status: isHealthy ? 'pass' : 'fail',
          message: isHealthy ? `${serviceName} service healthy` : `${serviceName} service unavailable`
        };
      } catch (error) {
        return {
          status: 'fail',
          message: error instanceof Error ? error.message : `${serviceName} check failed`
        };
      }
    };
  }

  /**
   * 销毁健康检查器
   */
  public destroy(): void {
    this.stopPeriodicChecks();
    this.checks.clear();
    this.logger.info('Health checker destroyed');
  }
}
