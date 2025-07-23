import { Logger } from '../utils/Logger';
import { PluginError } from '../types/PluginTypes';

/**
 * 指标收集器
 * 负责收集和报告插件性能指标
 */
export class MetricsCollector {
  private logger: Logger;
  private config: MetricsConfig;
  private metrics: Map<string, Metric> = new Map();
  private intervalId?: NodeJS.Timeout;

  constructor(config: MetricsConfig) {
    this.logger = new Logger('MetricsCollector');
    this.config = config;
    this.initializeDefaultMetrics();
  }

  /**
   * 启动指标收集
   */
  public start(): void {
    if (this.intervalId) {
      this.stop();
    }

    this.intervalId = setInterval(() => {
      this.collectSystemMetrics();
      this.reportMetrics();
    }, this.config.interval || 30000);

    this.logger.info('Metrics collector started');
  }

  /**
   * 停止指标收集
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.logger.info('Metrics collector stopped');
  }

  /**
   * 记录计数器指标
   */
  public incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, 'counter', labels);
    metric.value += value;
    metric.lastUpdated = new Date();
    
    this.logger.debug(`Counter incremented: ${name} = ${metric.value}`);
  }

  /**
   * 记录仪表盘指标
   */
  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, 'gauge', labels);
    metric.value = value;
    metric.lastUpdated = new Date();
    
    this.logger.debug(`Gauge set: ${name} = ${value}`);
  }

  /**
   * 记录直方图指标
   */
  public recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, 'histogram', labels);
    
    if (!metric.histogram) {
      metric.histogram = {
        buckets: new Map(),
        sum: 0,
        count: 0
      };
    }

    metric.histogram.sum += value;
    metric.histogram.count++;
    
    // 更新桶计数
    const buckets = [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    for (const bucket of buckets) {
      if (value <= bucket) {
        const currentCount = metric.histogram.buckets.get(bucket) || 0;
        metric.histogram.buckets.set(bucket, currentCount + 1);
      }
    }

    metric.lastUpdated = new Date();
    this.logger.debug(`Histogram recorded: ${name} = ${value}`);
  }

  /**
   * 记录摘要指标
   */
  public recordSummary(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, 'summary', labels);
    
    if (!metric.summary) {
      metric.summary = {
        values: [],
        sum: 0,
        count: 0
      };
    }

    metric.summary.values.push(value);
    metric.summary.sum += value;
    metric.summary.count++;

    // 保持最近1000个值
    if (metric.summary.values.length > 1000) {
      metric.summary.values = metric.summary.values.slice(-1000);
    }

    metric.lastUpdated = new Date();
    this.logger.debug(`Summary recorded: ${name} = ${value}`);
  }

  /**
   * 测量执行时间
   */
  public measureTime<T>(name: string, fn: () => T, labels?: Record<string, string>): T {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      this.recordHistogram(`${name}_duration_ms`, duration, labels);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordHistogram(`${name}_duration_ms`, duration, { ...labels, status: 'error' });
      throw error;
    }
  }

  /**
   * 测量异步执行时间
   */
  public async measureTimeAsync<T>(
    name: string, 
    fn: () => Promise<T>, 
    labels?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordHistogram(`${name}_duration_ms`, duration, labels);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordHistogram(`${name}_duration_ms`, duration, { ...labels, status: 'error' });
      throw error;
    }
  }

  /**
   * 获取所有指标
   */
  public getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, metric] of this.metrics) {
      result[key] = this.formatMetric(metric);
    }
    
    return result;
  }

  /**
   * 获取指定指标
   */
  public getMetric(name: string): any {
    const metric = this.metrics.get(name);
    return metric ? this.formatMetric(metric) : null;
  }

  /**
   * 清除所有指标
   */
  public clearMetrics(): void {
    this.metrics.clear();
    this.initializeDefaultMetrics();
    this.logger.info('All metrics cleared');
  }

  /**
   * 初始化默认指标
   */
  private initializeDefaultMetrics(): void {
    // HTTP请求指标
    this.getOrCreateMetric('http_requests_total', 'counter');
    this.getOrCreateMetric('http_request_duration_ms', 'histogram');
    
    // 系统指标
    this.getOrCreateMetric('process_cpu_usage_percent', 'gauge');
    this.getOrCreateMetric('process_memory_usage_bytes', 'gauge');
    this.getOrCreateMetric('process_uptime_seconds', 'gauge');
    
    // 数据库指标
    this.getOrCreateMetric('database_connections_active', 'gauge');
    this.getOrCreateMetric('database_query_duration_ms', 'histogram');
    
    // 缓存指标
    this.getOrCreateMetric('cache_hits_total', 'counter');
    this.getOrCreateMetric('cache_misses_total', 'counter');
  }

  /**
   * 收集系统指标
   */
  private collectSystemMetrics(): void {
    try {
      // CPU使用率
      const usage = process.cpuUsage();
      const uptime = process.uptime();
      const cpuPercent = ((usage.user + usage.system) / 1000000 / uptime) * 100;
      this.setGauge('process_cpu_usage_percent', cpuPercent);

      // 内存使用
      const memUsage = process.memoryUsage();
      this.setGauge('process_memory_usage_bytes', memUsage.rss);
      this.setGauge('process_memory_heap_used_bytes', memUsage.heapUsed);
      this.setGauge('process_memory_heap_total_bytes', memUsage.heapTotal);

      // 运行时间
      this.setGauge('process_uptime_seconds', uptime);

      this.logger.debug('System metrics collected');
    } catch (error) {
      this.logger.error('Failed to collect system metrics', error);
    }
  }

  /**
   * 报告指标
   */
  private reportMetrics(): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      const metrics = this.getAllMetrics();
      
      // TODO: 发送到监控系统（Prometheus、InfluxDB等）
      this.logger.debug('Metrics reported', { metricsCount: Object.keys(metrics).length });
    } catch (error) {
      this.logger.error('Failed to report metrics', error);
    }
  }

  /**
   * 获取或创建指标
   */
  private getOrCreateMetric(name: string, type: MetricType, labels?: Record<string, string>): Metric {
    const key = this.getMetricKey(name, labels);
    let metric = this.metrics.get(key);
    
    if (!metric) {
      metric = {
        name,
        type,
        labels: labels || {},
        value: 0,
        lastUpdated: new Date()
      };
      this.metrics.set(key, metric);
    }
    
    return metric;
  }

  /**
   * 生成指标键
   */
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    
    return `${name}{${labelStr}}`;
  }

  /**
   * 格式化指标
   */
  private formatMetric(metric: Metric): any {
    const base = {
      name: metric.name,
      type: metric.type,
      labels: metric.labels,
      lastUpdated: metric.lastUpdated
    };

    switch (metric.type) {
      case 'counter':
      case 'gauge':
        return { ...base, value: metric.value };
      
      case 'histogram':
        if (metric.histogram) {
          return {
            ...base,
            sum: metric.histogram.sum,
            count: metric.histogram.count,
            buckets: Object.fromEntries(metric.histogram.buckets)
          };
        }
        return base;
      
      case 'summary':
        if (metric.summary) {
          const values = metric.summary.values.sort((a, b) => a - b);
          return {
            ...base,
            sum: metric.summary.sum,
            count: metric.summary.count,
            quantiles: {
              '0.5': this.calculateQuantile(values, 0.5),
              '0.9': this.calculateQuantile(values, 0.9),
              '0.95': this.calculateQuantile(values, 0.95),
              '0.99': this.calculateQuantile(values, 0.99)
            }
          };
        }
        return base;
      
      default:
        return base;
    }
  }

  /**
   * 计算分位数
   */
  private calculateQuantile(sortedValues: number[], quantile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * quantile) - 1;
    return sortedValues[Math.max(0, index)];
  }
}

// 指标配置接口
export interface MetricsConfig {
  enabled: boolean;
  interval?: number;
  endpoint?: string;
}

// 指标类型
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

// 指标接口
export interface Metric {
  name: string;
  type: MetricType;
  labels: Record<string, string>;
  value: number;
  lastUpdated: Date;
  histogram?: {
    buckets: Map<number, number>;
    sum: number;
    count: number;
  };
  summary?: {
    values: number[];
    sum: number;
    count: number;
  };
}
