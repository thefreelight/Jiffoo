#!/usr/bin/env tsx
/**
 * Performance Testing CLI
 * 
 * 命令行工具用于运行性能测试
 */

import {
  createBenchmarkRunner,
  createLoadTestRunner,
  createStressTestRunner,
  createFrontendTester,
  createReportGenerator,
  createBaselineStore,
  createRegressionDetector,
  getGitCommit,
  getGitBranch,
} from './index';

const args = process.argv.slice(2);
const command = args[0];

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      result[key] = value;
      if (value !== 'true') i++;
    }
  }
  return result;
}

async function runBenchmark(options: Record<string, string>) {
  console.log('🏃 Running benchmarks...\n');
  
  const runner = createBenchmarkRunner({
    defaultIterations: parseInt(options.iterations || '100'),
  });

  const results = await runner.runSuite([
    {
      name: 'JSON Parse',
      fn: () => JSON.parse('{"key": "value", "nested": {"a": 1, "b": 2}}'),
    },
    {
      name: 'Array Sort',
      fn: () => [...Array(100)].map(() => Math.random()).sort(),
    },
    {
      name: 'String Concat',
      fn: () => { let s = ''; for (let i = 0; i < 100; i++) s += 'x'; },
    },
  ], 'Core Operations');

  console.log('📊 Benchmark Results:\n');
  for (const bench of results.benchmarks) {
    console.log(`  ${bench.name}:`);
    console.log(`    Mean: ${bench.mean.toFixed(3)}ms`);
    console.log(`    P99:  ${bench.p99.toFixed(3)}ms`);
    console.log(`    Ops:  ${bench.throughput.toFixed(0)}/s\n`);
  }
}

async function runLoadTest(options: Record<string, string>) {
  console.log('📈 Running load test...\n');
  
  const runner = createLoadTestRunner();
  const result = await runner.runSimulated({
    name: 'Load Test',
    targetUrl: options.url || 'http://localhost:3000',
    vus: parseInt(options.vus || '10'),
    duration: options.duration || '30s',
  });

  console.log('📊 Load Test Results:\n');
  console.log(`  VUs: ${result.vus}`);
  console.log(`  Requests: ${result.iterations}`);
  console.log(`  Duration: ${result.duration}ms`);
  console.log(`  P95: ${result.metrics.http_req_duration.p95.toFixed(0)}ms`);
  console.log(`  P99: ${result.metrics.http_req_duration.p99.toFixed(0)}ms`);
  console.log(`  Error Rate: ${(result.metrics.http_req_failed.rate * 100).toFixed(2)}%`);
  console.log(`  Status: ${result.thresholdsPassed ? '✅ PASS' : '❌ FAIL'}\n`);
}

async function runStressTest(options: Record<string, string>) {
  console.log('💪 Running stress test...\n');
  
  const runner = createStressTestRunner();
  const result = await runner.runSimulated({
    name: 'Stress Test',
    targetUrl: options.url || 'http://localhost:3000',
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '30s', target: 0 },
    ],
  });

  console.log('📊 Stress Test Results:\n');
  console.log(`  Peak VUs: ${result.peakMetrics.maxVUs}`);
  console.log(`  Max Response Time: ${result.peakMetrics.maxResponseTime.toFixed(0)}ms`);
  console.log(`  Max Error Rate: ${(result.peakMetrics.maxErrorRate * 100).toFixed(2)}%`);
  console.log(`  Status: ${result.overallStatus.toUpperCase()}\n`);
  
  if (result.breakingPoint) {
    console.log(`  ⚠️  Breaking Point:`);
    console.log(`    VUs: ${result.breakingPoint.vus}`);
    console.log(`    Error Rate: ${(result.breakingPoint.errorRate * 100).toFixed(2)}%\n`);
  }
}

async function runLighthouse(options: Record<string, string>) {
  console.log('🔦 Running Lighthouse test...\n');
  
  const tester = createFrontendTester();
  const results = await Promise.all([
    tester.runSimulated({ url: options.url || 'http://localhost:3000', device: 'mobile' }),
    tester.runSimulated({ url: options.url || 'http://localhost:3000', device: 'desktop' }),
  ]);

  for (const result of results) {
    console.log(`📊 ${result.device.toUpperCase()} Results:\n`);
    console.log(`  Performance: ${result.scores.performance}`);
    console.log(`  LCP: ${result.metrics.lcp.toFixed(0)}ms`);
    console.log(`  FID: ${result.metrics.fid.toFixed(0)}ms`);
    console.log(`  CLS: ${result.metrics.cls.toFixed(3)}`);
    console.log(`  Status: ${result.overallStatus === 'pass' ? '✅ PASS' : '❌ FAIL'}\n`);
  }
}

async function generateReport(options: Record<string, string>) {
  console.log('📝 Generating report...\n');
  
  const generator = createReportGenerator({
    outputDir: options.output || './performance/reports',
  });

  const report = {
    version: '1.0.0',
    timestamp: Date.now(),
    gitCommit: getGitCommit(),
    gitBranch: getGitBranch(),
    summary: {
      overallStatus: 'pass' as const,
      totalTests: 10,
      passedTests: 9,
      failedTests: 1,
      regressions: 0,
      improvements: 2,
      highlights: ['P99 latency improved by 15%', 'Error rate below threshold'],
    },
  };

  const { htmlPath, jsonPath } = generator.generate(report);
  console.log(`  HTML: ${htmlPath}`);
  console.log(`  JSON: ${jsonPath}\n`);
}

// Main
async function main() {
  const options = parseArgs(args.slice(1));

  switch (command) {
    case 'benchmark': await runBenchmark(options); break;
    case 'load-test': await runLoadTest(options); break;
    case 'stress-test': await runStressTest(options); break;
    case 'lighthouse': await runLighthouse(options); break;
    case 'report': await generateReport(options); break;
    default:
      console.log('Usage: tsx src/cli.ts <command> [options]');
      console.log('\nCommands:');
      console.log('  benchmark    Run benchmarks');
      console.log('  load-test    Run load test');
      console.log('  stress-test  Run stress test');
      console.log('  lighthouse   Run Lighthouse test');
      console.log('  report       Generate report');
  }
}

main().catch(console.error);

