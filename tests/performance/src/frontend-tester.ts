/**
 * Frontend Tester - 前端性能测试
 * 
 * 使用 Lighthouse 测量 Core Web Vitals
 */

export interface FrontendTestConfig {
  url: string;
  device: 'mobile' | 'desktop';
  runs?: number;
  thresholds?: CoreWebVitalsThresholds;
}

export interface CoreWebVitalsThresholds {
  lcp?: number;   // Largest Contentful Paint (ms)
  fid?: number;   // First Input Delay (ms)
  cls?: number;   // Cumulative Layout Shift
  fcp?: number;   // First Contentful Paint (ms)
  ttfb?: number;  // Time to First Byte (ms)
  tti?: number;   // Time to Interactive (ms)
}

export interface LighthouseResult {
  url: string;
  device: 'mobile' | 'desktop';
  timestamp: number;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  metrics: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
    tti: number;
    speedIndex: number;
    totalBlockingTime: number;
  };
  thresholdResults: Array<{
    name: string;
    value: number;
    threshold: number;
    passed: boolean;
    rating: 'good' | 'needs-improvement' | 'poor';
  }>;
  overallStatus: 'pass' | 'fail';
}

const DEFAULT_THRESHOLDS: Required<CoreWebVitalsThresholds> = {
  lcp: 2500,    // 2.5s (Good)
  fid: 100,     // 100ms (Good)
  cls: 0.1,     // 0.1 (Good)
  fcp: 1800,    // 1.8s
  ttfb: 800,    // 800ms
  tti: 3800,    // 3.8s
};

/**
 * 评估指标等级
 */
function rateMetric(
  name: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    fid: [100, 300],
    cls: [0.1, 0.25],
    fcp: [1800, 3000],
    ttfb: [800, 1800],
    tti: [3800, 7300],
  };

  const [good, poor] = thresholds[name] ?? [1000, 3000];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Frontend Tester 类
 */
export class FrontendTester {
  private defaultThresholds: Required<CoreWebVitalsThresholds>;

  constructor(thresholds?: CoreWebVitalsThresholds) {
    this.defaultThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * 模拟运行 Lighthouse 测试
   */
  async runSimulated(config: FrontendTestConfig): Promise<LighthouseResult> {
    const thresholds = { ...this.defaultThresholds, ...config.thresholds };
    const isMobile = config.device === 'mobile';
    
    // 模拟指标（移动端通常更慢）
    const factor = isMobile ? 1.3 : 1.0;
    
    const metrics = {
      lcp: 1800 * factor + Math.random() * 500,
      fid: 50 * factor + Math.random() * 30,
      cls: 0.05 + Math.random() * 0.05,
      fcp: 1200 * factor + Math.random() * 400,
      ttfb: 400 * factor + Math.random() * 200,
      tti: 2800 * factor + Math.random() * 800,
      speedIndex: 2000 * factor + Math.random() * 600,
      totalBlockingTime: 150 * factor + Math.random() * 100,
    };

    // 计算分数
    const perfScore = Math.max(0, Math.min(100,
      100 - (metrics.lcp / 100) - (metrics.tti / 100) - (metrics.cls * 100)
    ));

    const scores = {
      performance: Math.round(perfScore),
      accessibility: 85 + Math.round(Math.random() * 10),
      bestPractices: 90 + Math.round(Math.random() * 8),
      seo: 88 + Math.round(Math.random() * 10),
    };

    // 检查阈值
    const thresholdResults = [
      {
        name: 'lcp',
        value: metrics.lcp,
        threshold: thresholds.lcp,
        passed: metrics.lcp <= thresholds.lcp,
        rating: rateMetric('lcp', metrics.lcp),
      },
      {
        name: 'fid',
        value: metrics.fid,
        threshold: thresholds.fid,
        passed: metrics.fid <= thresholds.fid,
        rating: rateMetric('fid', metrics.fid),
      },
      {
        name: 'cls',
        value: metrics.cls,
        threshold: thresholds.cls,
        passed: metrics.cls <= thresholds.cls,
        rating: rateMetric('cls', metrics.cls),
      },
      {
        name: 'fcp',
        value: metrics.fcp,
        threshold: thresholds.fcp,
        passed: metrics.fcp <= thresholds.fcp,
        rating: rateMetric('fcp', metrics.fcp),
      },
      {
        name: 'ttfb',
        value: metrics.ttfb,
        threshold: thresholds.ttfb,
        passed: metrics.ttfb <= thresholds.ttfb,
        rating: rateMetric('ttfb', metrics.ttfb),
      },
      {
        name: 'tti',
        value: metrics.tti,
        threshold: thresholds.tti,
        passed: metrics.tti <= thresholds.tti,
        rating: rateMetric('tti', metrics.tti),
      },
    ];

    return {
      url: config.url,
      device: config.device,
      timestamp: Date.now(),
      scores,
      metrics,
      thresholdResults,
      overallStatus: thresholdResults.every(t => t.passed) ? 'pass' : 'fail',
    };
  }

  /**
   * 获取 Lighthouse 配置
   */
  getLighthouseConfig(device: 'mobile' | 'desktop'): object {
    return {
      extends: 'lighthouse:default',
      settings: {
        formFactor: device,
        screenEmulation: device === 'mobile' ? {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
        } : {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
        },
        throttling: device === 'mobile' ? {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        } : {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      },
    };
  }
}

export function createFrontendTester(
  thresholds?: CoreWebVitalsThresholds
): FrontendTester {
  return new FrontendTester(thresholds);
}

