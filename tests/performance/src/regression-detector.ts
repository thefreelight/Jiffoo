/**
 * Regression Detector - 性能回归检测器
 * 
 * 检测性能回归并生成报告
 */

import type { BenchmarkMetrics, BenchmarkSuiteResult } from './benchmark-runner';

export interface RegressionResult {
  name: string;
  isRegression: boolean;
  severity: 'none' | 'minor' | 'major' | 'critical';
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  threshold: number;
  metric: string;
}

export interface RegressionReport {
  timestamp: number;
  gitCommit?: string;
  baselineCommit?: string;
  totalTests: number;
  regressions: RegressionResult[];
  improvements: RegressionResult[];
  unchanged: RegressionResult[];
  overallStatus: 'pass' | 'fail';
}

export interface RegressionThresholds {
  p50?: number;
  p90?: number;
  p99?: number;
  throughput?: number;
  mean?: number;
}

const DEFAULT_THRESHOLDS: Required<RegressionThresholds> = {
  p50: 0.1,      // 10% 回归
  p90: 0.15,     // 15% 回归
  p99: 0.2,      // 20% 回归
  throughput: -0.1, // 10% 吞吐量下降
  mean: 0.15,    // 15% 平均值增加
};

/**
 * 计算变化百分比
 */
function calculateChange(baseline: number, current: number): number {
  if (baseline === 0) return current === 0 ? 0 : 1;
  return (current - baseline) / baseline;
}

/**
 * 确定回归严重程度
 */
function determineSeverity(
  changePercent: number,
  threshold: number
): 'none' | 'minor' | 'major' | 'critical' {
  if (changePercent <= threshold) return 'none';
  if (changePercent <= threshold * 1.5) return 'minor';
  if (changePercent <= threshold * 2) return 'major';
  return 'critical';
}

/**
 * Regression Detector 类
 */
export class RegressionDetector {
  private thresholds: Required<RegressionThresholds>;

  constructor(thresholds?: RegressionThresholds) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * 检测单个基准测试的回归
   */
  detectSingle(
    baseline: BenchmarkMetrics,
    current: BenchmarkMetrics
  ): RegressionResult[] {
    const results: RegressionResult[] = [];

    // 检测 p50 回归
    const p50Change = calculateChange(baseline.p50, current.p50);
    results.push({
      name: current.name,
      isRegression: p50Change > this.thresholds.p50,
      severity: determineSeverity(p50Change, this.thresholds.p50),
      baselineValue: baseline.p50,
      currentValue: current.p50,
      changePercent: p50Change,
      threshold: this.thresholds.p50,
      metric: 'p50',
    });

    // 检测 p90 回归
    const p90Change = calculateChange(baseline.p90, current.p90);
    results.push({
      name: current.name,
      isRegression: p90Change > this.thresholds.p90,
      severity: determineSeverity(p90Change, this.thresholds.p90),
      baselineValue: baseline.p90,
      currentValue: current.p90,
      changePercent: p90Change,
      threshold: this.thresholds.p90,
      metric: 'p90',
    });

    // 检测 p99 回归
    const p99Change = calculateChange(baseline.p99, current.p99);
    results.push({
      name: current.name,
      isRegression: p99Change > this.thresholds.p99,
      severity: determineSeverity(p99Change, this.thresholds.p99),
      baselineValue: baseline.p99,
      currentValue: current.p99,
      changePercent: p99Change,
      threshold: this.thresholds.p99,
      metric: 'p99',
    });

    // 检测吞吐量下降
    const throughputChange = calculateChange(baseline.throughput, current.throughput);
    results.push({
      name: current.name,
      isRegression: throughputChange < this.thresholds.throughput,
      severity: determineSeverity(-throughputChange, -this.thresholds.throughput),
      baselineValue: baseline.throughput,
      currentValue: current.throughput,
      changePercent: throughputChange,
      threshold: this.thresholds.throughput,
      metric: 'throughput',
    });

    return results;
  }

  /**
   * 检测测试套件的回归
   */
  detectSuite(
    baseline: BenchmarkSuiteResult,
    current: BenchmarkSuiteResult
  ): RegressionReport {
    const allResults: RegressionResult[] = [];

    // 匹配基准测试
    for (const currentBenchmark of current.benchmarks) {
      const baselineBenchmark = baseline.benchmarks.find(
        b => b.name === currentBenchmark.name
      );

      if (baselineBenchmark) {
        const results = this.detectSingle(baselineBenchmark, currentBenchmark);
        allResults.push(...results);
      }
    }

    // 分类结果
    const regressions = allResults.filter(r => r.isRegression && r.changePercent > 0);
    const improvements = allResults.filter(r => r.changePercent < -0.05); // 5% 改进
    const unchanged = allResults.filter(
      r => !r.isRegression && r.changePercent >= -0.05
    );

    return {
      timestamp: Date.now(),
      gitCommit: current.gitCommit,
      baselineCommit: baseline.gitCommit,
      totalTests: current.benchmarks.length,
      regressions,
      improvements,
      unchanged,
      overallStatus: regressions.some(r => r.severity === 'critical' || r.severity === 'major')
        ? 'fail'
        : 'pass',
    };
  }

  /**
   * 更新阈值
   */
  setThresholds(thresholds: RegressionThresholds): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * 获取当前阈值
   */
  getThresholds(): Required<RegressionThresholds> {
    return { ...this.thresholds };
  }
}

/**
 * 创建 Regression Detector 实例
 */
export function createRegressionDetector(
  thresholds?: RegressionThresholds
): RegressionDetector {
  return new RegressionDetector(thresholds);
}

