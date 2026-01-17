/**
 * Benchmark Runner - 基准测试运行器
 * 
 * 执行单次基准测试和测试套件
 */

export interface BenchmarkMetrics {
  name: string;
  duration: number;      // 执行时间 (ms)
  throughput: number;    // 吞吐量 (ops/s)
  p50: number;           // 50th percentile (ms)
  p90: number;           // 90th percentile (ms)
  p99: number;           // 99th percentile (ms)
  min: number;           // 最小值 (ms)
  max: number;           // 最大值 (ms)
  mean: number;          // 平均值 (ms)
  stdDev: number;        // 标准差
  iterations: number;    // 迭代次数
  timestamp: number;     // 时间戳
}

export interface BenchmarkConfig {
  name: string;
  iterations?: number;
  warmupIterations?: number;
  timeout?: number;
}

export interface BenchmarkComparison {
  name: string;
  baseline: BenchmarkMetrics;
  current: BenchmarkMetrics;
  changes: {
    duration: number;      // 变化百分比
    throughput: number;
    p50: number;
    p90: number;
    p99: number;
  };
  isRegression: boolean;
  regressionThreshold: number;
}

export interface BenchmarkSuiteResult {
  name: string;
  benchmarks: BenchmarkMetrics[];
  totalDuration: number;
  timestamp: number;
  gitCommit?: string;
}

/**
 * 计算百分位数
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 计算标准差
 */
function standardDeviation(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const squaredDiffs = arr.map(x => Math.pow(x - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

/**
 * Benchmark Runner 类
 */
export class BenchmarkRunner {
  private defaultIterations: number;
  private defaultWarmupIterations: number;
  private defaultTimeout: number;

  constructor(options?: {
    defaultIterations?: number;
    defaultWarmupIterations?: number;
    defaultTimeout?: number;
  }) {
    this.defaultIterations = options?.defaultIterations ?? 100;
    this.defaultWarmupIterations = options?.defaultWarmupIterations ?? 10;
    this.defaultTimeout = options?.defaultTimeout ?? 30000;
  }

  /**
   * 运行单个基准测试
   */
  async run(
    fn: () => void | Promise<void>,
    config: BenchmarkConfig
  ): Promise<BenchmarkMetrics> {
    const iterations = config.iterations ?? this.defaultIterations;
    const warmupIterations = config.warmupIterations ?? this.defaultWarmupIterations;
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Actual benchmark
    const durations: number[] = [];
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterStart = performance.now();
      await fn();
      const iterEnd = performance.now();
      durations.push(iterEnd - iterStart);
    }

    const totalDuration = performance.now() - startTime;
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;

    return {
      name: config.name,
      duration: totalDuration,
      throughput: (iterations / totalDuration) * 1000,
      p50: percentile(durations, 50),
      p90: percentile(durations, 90),
      p99: percentile(durations, 99),
      min: Math.min(...durations),
      max: Math.max(...durations),
      mean,
      stdDev: standardDeviation(durations),
      iterations,
      timestamp: Date.now(),
    };
  }

  /**
   * 运行基准测试套件
   */
  async runSuite(
    benchmarks: Array<{
      name: string;
      fn: () => void | Promise<void>;
      iterations?: number;
    }>,
    suiteName: string
  ): Promise<BenchmarkSuiteResult> {
    const startTime = performance.now();
    const results: BenchmarkMetrics[] = [];

    for (const benchmark of benchmarks) {
      const result = await this.run(benchmark.fn, {
        name: benchmark.name,
        iterations: benchmark.iterations,
      });
      results.push(result);
    }

    return {
      name: suiteName,
      benchmarks: results,
      totalDuration: performance.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * 比较两个基准测试结果
   */
  compare(
    baseline: BenchmarkMetrics,
    current: BenchmarkMetrics,
    regressionThreshold: number = 0.2
  ): BenchmarkComparison {
    const calcChange = (base: number, curr: number): number => {
      if (base === 0) return curr === 0 ? 0 : 1;
      return (curr - base) / base;
    };

    const changes = {
      duration: calcChange(baseline.duration, current.duration),
      throughput: calcChange(baseline.throughput, current.throughput),
      p50: calcChange(baseline.p50, current.p50),
      p90: calcChange(baseline.p90, current.p90),
      p99: calcChange(baseline.p99, current.p99),
    };

    // 回归检测：p99 延迟增加超过阈值
    const isRegression = changes.p99 > regressionThreshold;

    return {
      name: current.name,
      baseline,
      current,
      changes,
      isRegression,
      regressionThreshold,
    };
  }
}

/**
 * 创建 Benchmark Runner 实例
 */
export function createBenchmarkRunner(options?: {
  defaultIterations?: number;
  defaultWarmupIterations?: number;
  defaultTimeout?: number;
}): BenchmarkRunner {
  return new BenchmarkRunner(options);
}

