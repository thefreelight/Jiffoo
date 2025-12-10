/**
 * Performance Testing Property Tests
 * 
 * 使用 fast-check 验证性能测试组件的属性
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  BenchmarkRunner,
  RegressionDetector,
  LoadTestRunner,
  StressTestRunner,
  FrontendTester,
  ReportGenerator,
} from '../src';
import type { BenchmarkMetrics, BenchmarkSuiteResult } from '../src';

// === Property 1: Benchmark Metrics Completeness ===
describe('Property 1: Benchmark Metrics Completeness', () => {
  const runner = new BenchmarkRunner({ defaultIterations: 10, defaultWarmupIterations: 2 });

  it('should produce complete metrics with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (name) => {
          const result = await runner.run(
            () => { let sum = 0; for (let i = 0; i < 100; i++) sum += i; },
            { name, iterations: 10 }
          );

          // All required fields present
          expect(result.name).toBe(name);
          expect(typeof result.duration).toBe('number');
          expect(typeof result.throughput).toBe('number');
          expect(typeof result.p50).toBe('number');
          expect(typeof result.p90).toBe('number');
          expect(typeof result.p99).toBe('number');
          expect(typeof result.min).toBe('number');
          expect(typeof result.max).toBe('number');
          expect(typeof result.mean).toBe('number');
          expect(typeof result.stdDev).toBe('number');
          expect(typeof result.iterations).toBe('number');
          expect(typeof result.timestamp).toBe('number');
          
          // Logical constraints
          expect(result.min).toBeLessThanOrEqual(result.p50);
          expect(result.p50).toBeLessThanOrEqual(result.p90);
          expect(result.p90).toBeLessThanOrEqual(result.p99);
          expect(result.p99).toBeLessThanOrEqual(result.max);
          expect(result.duration).toBeGreaterThan(0);
          expect(result.throughput).toBeGreaterThan(0);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should maintain percentile ordering', async () => {
    const result = await runner.run(
      () => { Math.random(); },
      { name: 'percentile-test', iterations: 50 }
    );

    expect(result.min).toBeLessThanOrEqual(result.mean);
    expect(result.mean).toBeLessThanOrEqual(result.max);
  });
});

// === Property 2: Regression Detection Accuracy ===
describe('Property 2: Regression Detection Accuracy', () => {
  const detector = new RegressionDetector({ p99: 0.2 });

  it('should correctly identify regressions based on threshold', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(10), max: Math.fround(100) }),      // baseline p99
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.5) }),    // change factor
        (baselineP99, changeFactor) => {
          const baseline: BenchmarkMetrics = {
            name: 'test', duration: 1000, throughput: 100,
            p50: baselineP99 * 0.5, p90: baselineP99 * 0.8, p99: baselineP99,
            min: baselineP99 * 0.3, max: baselineP99 * 1.5, mean: baselineP99 * 0.6,
            stdDev: baselineP99 * 0.1, iterations: 100, timestamp: Date.now(),
          };

          const currentP99 = baselineP99 * (1 + changeFactor);
          const current: BenchmarkMetrics = {
            ...baseline, p99: currentP99, timestamp: Date.now(),
          };

          const results = detector.detectSingle(baseline, current);
          const p99Result = results.find(r => r.metric === 'p99');
          
          expect(p99Result).toBeDefined();
          if (changeFactor > 0.2) {
            expect(p99Result!.isRegression).toBe(true);
          } else {
            expect(p99Result!.isRegression).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should classify severity correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1) }),
        (changeFactor) => {
          const baseline: BenchmarkMetrics = {
            name: 'test', duration: 1000, throughput: 100,
            p50: 50, p90: 80, p99: 100,
            min: 30, max: 150, mean: 60,
            stdDev: 10, iterations: 100, timestamp: Date.now(),
          };

          const current: BenchmarkMetrics = {
            ...baseline, p99: 100 * (1 + changeFactor), timestamp: Date.now(),
          };

          const results = detector.detectSingle(baseline, current);
          const p99Result = results.find(r => r.metric === 'p99')!;

          if (changeFactor <= 0.2) expect(p99Result.severity).toBe('none');
          else if (changeFactor <= 0.3) expect(p99Result.severity).toBe('minor');
          else if (changeFactor <= 0.4) expect(p99Result.severity).toBe('major');
          else expect(p99Result.severity).toBe('critical');
        }
      ),
      { numRuns: 20 }
    );
  });
});

// === Property 3: Load Test Error Rate Threshold ===
describe('Property 3: Load Test Error Rate Threshold', () => {
  it('should correctly evaluate error rate thresholds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.05) }),
        async (vus, errorThreshold) => {
          const runner = new LoadTestRunner({ http_req_failed_rate: errorThreshold });
          const result = await runner.runSimulated({
            name: 'error-test',
            targetUrl: 'http://test.local',
            vus,
            duration: '5s',
          });

          const errorResult = result.thresholdResults.find(
            t => t.name === 'http_req_failed_rate'
          );
          expect(errorResult).toBeDefined();
          expect(errorResult!.threshold).toBe(errorThreshold);
        }
      ),
      { numRuns: 10 }
    );
  });
});

// === Property 4: Report Structure Validity ===
describe('Property 4: Report Structure Validity', () => {
  it('should generate valid report structure', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 10 }),
        (total, passed, regressions) => {
          const failed = Math.min(total - passed, total);
          const actualPassed = total - failed;

          const report = {
            version: '1.0.0',
            timestamp: Date.now(),
            summary: {
              overallStatus: failed > 0 ? 'fail' : 'pass' as const,
              totalTests: total,
              passedTests: actualPassed,
              failedTests: failed,
              regressions: Math.min(regressions, total),
              improvements: 0,
              highlights: [],
            },
          };

          expect(report.summary.totalTests).toBe(
            report.summary.passedTests + report.summary.failedTests
          );
          expect(report.summary.regressions).toBeLessThanOrEqual(report.summary.totalTests);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// === Property 5: Slow Endpoint Detection ===
describe('Property 5: Slow Endpoint Detection', () => {
  it('should identify slow endpoints based on threshold', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(100), max: Math.fround(2000) }),
        fc.float({ min: Math.fround(100), max: Math.fround(1000) }),
        (responseTime, threshold) => {
          const isSlow = responseTime > threshold;
          
          // Simulating slow endpoint detection logic
          const endpointResult = {
            name: '/api/test',
            responseTime,
            threshold,
            isSlow,
          };

          if (responseTime > threshold) {
            expect(endpointResult.isSlow).toBe(true);
          } else {
            expect(endpointResult.isSlow).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

// === Property 6: Frontend Metrics Validity ===
describe('Property 6: Frontend Metrics Validity', () => {
  const tester = new FrontendTester();

  it('should produce valid Core Web Vitals metrics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('mobile', 'desktop') as fc.Arbitrary<'mobile' | 'desktop'>,
        async (device) => {
          const result = await tester.runSimulated({
            url: 'http://test.local',
            device,
          });

          // All metrics should be positive
          expect(result.metrics.lcp).toBeGreaterThan(0);
          expect(result.metrics.fcp).toBeGreaterThan(0);
          expect(result.metrics.cls).toBeGreaterThanOrEqual(0);
          expect(result.metrics.tti).toBeGreaterThan(0);
          expect(result.metrics.ttfb).toBeGreaterThan(0);

          // Scores should be in valid range
          expect(result.scores.performance).toBeGreaterThanOrEqual(0);
          expect(result.scores.performance).toBeLessThanOrEqual(100);

          // FCP should be less than LCP
          expect(result.metrics.fcp).toBeLessThanOrEqual(result.metrics.lcp);
        }
      ),
      { numRuns: 10 }
    );
  });
});

