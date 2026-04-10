/**
 * Stress Test Runner - 压力测试运行器
 * 
 * 执行渐进式负载测试和降级检测
 */

export interface StressTestConfig {
  name: string;
  targetUrl: string;
  stages: StressTestStage[];
  recoveryTime?: string;
  resourceMonitoring?: boolean;
}

export interface StressTestStage {
  duration: string;
  target: number;  // VUs
}

export interface ResourceMetrics {
  cpu: number;      // CPU 使用率 (0-100)
  memory: number;   // 内存使用率 (0-100)
  timestamp: number;
}

export interface StressTestResult {
  name: string;
  timestamp: number;
  totalDuration: number;
  stages: StageResult[];
  peakMetrics: {
    maxVUs: number;
    maxResponseTime: number;
    maxErrorRate: number;
    maxCPU?: number;
    maxMemory?: number;
  };
  breakingPoint?: {
    vus: number;
    errorRate: number;
    responseTime: number;
  };
  recoveryMetrics?: {
    recoveryTime: number;
    recoveredAt: number;
    finalErrorRate: number;
  };
  overallStatus: 'pass' | 'degraded' | 'failed';
}

export interface StageResult {
  name: string;
  targetVUs: number;
  duration: number;
  metrics: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  resources?: ResourceMetrics;
  status: 'healthy' | 'degraded' | 'failing';
}

/**
 * 确定阶段状态
 */
function determineStageStatus(
  errorRate: number,
  p99ResponseTime: number
): 'healthy' | 'degraded' | 'failing' {
  if (errorRate > 0.1 || p99ResponseTime > 5000) return 'failing';
  if (errorRate > 0.05 || p99ResponseTime > 2000) return 'degraded';
  return 'healthy';
}

/**
 * Stress Test Runner 类
 */
export class StressTestRunner {
  private degradationThreshold: number;
  private failureThreshold: number;

  constructor(options?: {
    degradationThreshold?: number;
    failureThreshold?: number;
  }) {
    this.degradationThreshold = options?.degradationThreshold ?? 0.05;
    this.failureThreshold = options?.failureThreshold ?? 0.1;
  }

  /**
   * 生成 k6 压力测试脚本
   */
  generateK6Script(config: StressTestConfig): string {
    const stages = config.stages.map(s => 
      `{ duration: '${s.duration}', target: ${s.target} }`
    ).join(',\n    ');

    return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    ${stages}
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(99)<5000'],
  },
};

export default function() {
  const res = http.get('${config.targetUrl}');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  
  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);
  
  sleep(0.5);
}
`;
  }

  /**
   * 模拟运行压力测试
   */
  async runSimulated(config: StressTestConfig): Promise<StressTestResult> {
    const startTime = Date.now();
    const stageResults: StageResult[] = [];
    let maxVUs = 0;
    let maxResponseTime = 0;
    let maxErrorRate = 0;
    let breakingPoint: StressTestResult['breakingPoint'];

    for (let i = 0; i < config.stages.length; i++) {
      const stage = config.stages[i];
      const durationMs = this.parseDuration(stage.duration);
      
      maxVUs = Math.max(maxVUs, stage.target);
      
      // 模拟负载增加时的性能下降
      const loadFactor = stage.target / 100;
      const baseResponseTime = 100;
      const avgResponseTime = baseResponseTime * (1 + loadFactor * 0.5);
      const p95ResponseTime = avgResponseTime * 1.5;
      const p99ResponseTime = avgResponseTime * 2;
      const errorRate = Math.min(0.5, loadFactor * 0.02);
      
      maxResponseTime = Math.max(maxResponseTime, p99ResponseTime);
      maxErrorRate = Math.max(maxErrorRate, errorRate);

      const status = determineStageStatus(errorRate, p99ResponseTime);
      
      // 检测 breaking point
      if (status === 'failing' && !breakingPoint) {
        breakingPoint = {
          vus: stage.target,
          errorRate,
          responseTime: p99ResponseTime,
        };
      }

      stageResults.push({
        name: `Stage ${i + 1}`,
        targetVUs: stage.target,
        duration: durationMs,
        metrics: {
          avgResponseTime,
          p95ResponseTime,
          p99ResponseTime,
          errorRate,
          throughput: stage.target * 2,
        },
        status,
      });
    }

    // 模拟恢复
    const recoveryMetrics = config.recoveryTime ? {
      recoveryTime: this.parseDuration(config.recoveryTime),
      recoveredAt: Date.now() + this.parseDuration(config.recoveryTime),
      finalErrorRate: 0.001,
    } : undefined;

    const hasFailure = stageResults.some(s => s.status === 'failing');
    const hasDegradation = stageResults.some(s => s.status === 'degraded');

    return {
      name: config.name,
      timestamp: startTime,
      totalDuration: Date.now() - startTime,
      stages: stageResults,
      peakMetrics: {
        maxVUs,
        maxResponseTime,
        maxErrorRate,
      },
      breakingPoint,
      recoveryMetrics,
      overallStatus: hasFailure ? 'failed' : hasDegradation ? 'degraded' : 'pass',
    };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(s|m|h)$/);
    if (!match) return 30000;
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

export function createStressTestRunner(options?: {
  degradationThreshold?: number;
  failureThreshold?: number;
}): StressTestRunner {
  return new StressTestRunner(options);
}

