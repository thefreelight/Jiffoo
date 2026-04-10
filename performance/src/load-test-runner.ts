/**
 * Load Test Runner - 负载测试运行器
 * 
 * 执行 k6 负载测试并收集结果
 */

export interface LoadTestConfig {
  name: string;
  targetUrl: string;
  vus: number;              // 虚拟用户数
  duration: string;         // 持续时间 (e.g., '30s', '5m')
  rampUpTime?: string;      // 爬坡时间
  thresholds?: LoadTestThresholds;
  scenarios?: LoadTestScenario[];
}

export interface LoadTestThresholds {
  http_req_duration_p95?: number;  // p95 延迟阈值 (ms)
  http_req_duration_p99?: number;  // p99 延迟阈值 (ms)
  http_req_failed_rate?: number;   // 失败率阈值 (0-1)
  http_reqs_rate?: number;         // 最小请求率 (req/s)
}

export interface LoadTestScenario {
  name: string;
  executor: 'constant-vus' | 'ramping-vus' | 'constant-arrival-rate' | 'ramping-arrival-rate';
  vus?: number;
  duration?: string;
  stages?: Array<{ duration: string; target: number }>;
  rate?: number;
  timeUnit?: string;
}

export interface LoadTestResult {
  name: string;
  timestamp: number;
  duration: number;
  vus: number;
  iterations: number;
  metrics: {
    http_req_duration: {
      avg: number;
      min: number;
      max: number;
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
    http_req_failed: {
      rate: number;
      count: number;
    };
    http_reqs: {
      rate: number;
      count: number;
    };
    vus: {
      min: number;
      max: number;
    };
  };
  thresholdsPassed: boolean;
  thresholdResults: Array<{
    name: string;
    passed: boolean;
    value: number;
    threshold: number;
  }>;
}

const DEFAULT_THRESHOLDS: Required<LoadTestThresholds> = {
  http_req_duration_p95: 500,   // 500ms
  http_req_duration_p99: 1000,  // 1s
  http_req_failed_rate: 0.01,   // 1%
  http_reqs_rate: 10,           // 10 req/s minimum
};

/**
 * Load Test Runner 类
 */
export class LoadTestRunner {
  private defaultThresholds: Required<LoadTestThresholds>;

  constructor(thresholds?: LoadTestThresholds) {
    this.defaultThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * 生成 k6 脚本
   */
  generateK6Script(config: LoadTestConfig): string {
    const thresholds = { ...this.defaultThresholds, ...config.thresholds };
    
    return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

export const options = {
  vus: ${config.vus},
  duration: '${config.duration}',
  thresholds: {
    http_req_duration: ['p(95)<${thresholds.http_req_duration_p95}', 'p(99)<${thresholds.http_req_duration_p99}'],
    http_req_failed: ['rate<${thresholds.http_req_failed_rate}'],
    http_reqs: ['rate>${thresholds.http_reqs_rate}'],
  },
};

export default function() {
  const res = http.get('${config.targetUrl}');
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(!success);
  requestDuration.add(res.timings.duration);
  
  sleep(1);
}
`;
  }

  /**
   * 模拟运行负载测试（不依赖实际 k6）
   */
  async runSimulated(config: LoadTestConfig): Promise<LoadTestResult> {
    const thresholds = { ...this.defaultThresholds, ...config.thresholds };
    const startTime = Date.now();
    
    // 解析持续时间
    const durationMs = this.parseDuration(config.duration);
    
    // 模拟指标
    const iterations = Math.floor(config.vus * (durationMs / 1000) * 0.8);
    const avgDuration = 150 + Math.random() * 100;
    
    const metrics = {
      http_req_duration: {
        avg: avgDuration,
        min: avgDuration * 0.5,
        max: avgDuration * 3,
        p50: avgDuration * 0.9,
        p90: avgDuration * 1.5,
        p95: avgDuration * 1.8,
        p99: avgDuration * 2.5,
      },
      http_req_failed: {
        rate: 0.005 + Math.random() * 0.01,
        count: Math.floor(iterations * 0.01),
      },
      http_reqs: {
        rate: iterations / (durationMs / 1000),
        count: iterations,
      },
      vus: {
        min: 1,
        max: config.vus,
      },
    };

    // 检查阈值
    const thresholdResults = [
      {
        name: 'http_req_duration_p95',
        passed: metrics.http_req_duration.p95 < thresholds.http_req_duration_p95,
        value: metrics.http_req_duration.p95,
        threshold: thresholds.http_req_duration_p95,
      },
      {
        name: 'http_req_duration_p99',
        passed: metrics.http_req_duration.p99 < thresholds.http_req_duration_p99,
        value: metrics.http_req_duration.p99,
        threshold: thresholds.http_req_duration_p99,
      },
      {
        name: 'http_req_failed_rate',
        passed: metrics.http_req_failed.rate < thresholds.http_req_failed_rate,
        value: metrics.http_req_failed.rate,
        threshold: thresholds.http_req_failed_rate,
      },
      {
        name: 'http_reqs_rate',
        passed: metrics.http_reqs.rate > thresholds.http_reqs_rate,
        value: metrics.http_reqs.rate,
        threshold: thresholds.http_reqs_rate,
      },
    ];

    return {
      name: config.name,
      timestamp: startTime,
      duration: durationMs,
      vus: config.vus,
      iterations,
      metrics,
      thresholdsPassed: thresholdResults.every(t => t.passed),
      thresholdResults,
    };
  }

  /**
   * 解析持续时间字符串
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(s|m|h)$/);
    if (!match) return 30000; // 默认 30s

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 30000;
    }
  }
}

/**
 * 创建 Load Test Runner 实例
 */
export function createLoadTestRunner(thresholds?: LoadTestThresholds): LoadTestRunner {
  return new LoadTestRunner(thresholds);
}

