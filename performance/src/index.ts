/**
 * Performance Testing Module
 * 
 * 统一导出所有性能测试组件
 */

// Benchmark Runner
export {
  BenchmarkRunner,
  createBenchmarkRunner,
  type BenchmarkMetrics,
  type BenchmarkConfig,
  type BenchmarkComparison,
  type BenchmarkSuiteResult,
} from './benchmark-runner';

// Regression Detector
export {
  RegressionDetector,
  createRegressionDetector,
  type RegressionResult,
  type RegressionReport,
  type RegressionThresholds,
} from './regression-detector';

// Baseline Store
export {
  BaselineStore,
  createBaselineStore,
  getGitCommit,
  getGitBranch,
  type BaselineMetadata,
  type StoredBaseline,
  type BaselineStoreConfig,
} from './baseline-store';

// Load Test Runner
export {
  LoadTestRunner,
  createLoadTestRunner,
  type LoadTestConfig,
  type LoadTestThresholds,
  type LoadTestScenario,
  type LoadTestResult,
} from './load-test-runner';

// Stress Test Runner
export {
  StressTestRunner,
  createStressTestRunner,
  type StressTestConfig,
  type StressTestStage,
  type StressTestResult,
  type StageResult,
  type ResourceMetrics,
} from './stress-test-runner';

// Frontend Tester
export {
  FrontendTester,
  createFrontendTester,
  type FrontendTestConfig,
  type CoreWebVitalsThresholds,
  type LighthouseResult,
} from './frontend-tester';

// Report Generator
export {
  ReportGenerator,
  createReportGenerator,
  type PerformanceReport,
  type ReportSummary,
  type ReportGeneratorConfig,
} from './report-generator';

