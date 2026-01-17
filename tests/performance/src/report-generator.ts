/**
 * Report Generator - 性能报告生成器
 * 
 * 生成 HTML 和 JSON 格式的性能报告
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import type { BenchmarkSuiteResult } from './benchmark-runner';
import type { RegressionReport } from './regression-detector';
import type { LoadTestResult } from './load-test-runner';
import type { StressTestResult } from './stress-test-runner';
import type { LighthouseResult } from './frontend-tester';

export interface PerformanceReport {
  version: string;
  timestamp: number;
  gitCommit?: string;
  gitBranch?: string;
  environment?: string;
  summary: ReportSummary;
  benchmarks?: BenchmarkSuiteResult;
  regression?: RegressionReport;
  loadTest?: LoadTestResult;
  stressTest?: StressTestResult;
  lighthouse?: LighthouseResult[];
}

export interface ReportSummary {
  overallStatus: 'pass' | 'fail' | 'warning';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  regressions: number;
  improvements: number;
  highlights: string[];
}

export interface ReportGeneratorConfig {
  outputDir: string;
  retentionDays?: number;
  includeHtml?: boolean;
  includeJson?: boolean;
}

/**
 * Report Generator 类
 */
export class ReportGenerator {
  private outputDir: string;
  private retentionDays: number;

  constructor(config: ReportGeneratorConfig) {
    this.outputDir = config.outputDir;
    this.retentionDays = config.retentionDays ?? 30;
    
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 生成完整报告
   */
  generate(report: PerformanceReport): { htmlPath?: string; jsonPath?: string } {
    const timestamp = new Date(report.timestamp).toISOString().replace(/[:.]/g, '-');
    const baseName = `performance-report-${timestamp}`;
    
    // 生成 JSON
    const jsonPath = join(this.outputDir, `${baseName}.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // 生成 HTML
    const htmlPath = join(this.outputDir, `${baseName}.html`);
    const html = this.generateHtml(report);
    writeFileSync(htmlPath, html);

    // 清理旧报告
    this.cleanup();

    return { htmlPath, jsonPath };
  }

  /**
   * 生成 HTML 报告
   */
  private generateHtml(report: PerformanceReport): string {
    const statusColor = report.summary.overallStatus === 'pass' ? '#4caf50' :
                       report.summary.overallStatus === 'warning' ? '#ff9800' : '#f44336';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Report - ${new Date(report.timestamp).toLocaleString()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .status { padding: 8px 16px; border-radius: 4px; color: white; font-weight: bold; background: ${statusColor}; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .metric { text-align: center; padding: 16px; background: #f9f9f9; border-radius: 4px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #333; }
    .metric-label { color: #666; font-size: 14px; }
    .highlight { padding: 8px 12px; background: #e3f2fd; border-left: 4px solid #2196f3; margin: 8px 0; }
    h1 { color: #333; } h2 { color: #555; margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; }
    .pass { color: #4caf50; } .fail { color: #f44336; } .warning { color: #ff9800; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>Performance Report</h1>
        <span class="status">${report.summary.overallStatus.toUpperCase()}</span>
      </div>
      <p><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
      <p><strong>Commit:</strong> ${report.gitCommit ?? 'N/A'}</p>
      <p><strong>Branch:</strong> ${report.gitBranch ?? 'N/A'}</p>
    </div>

    <div class="card">
      <h2>Summary</h2>
      <div class="metrics-grid">
        <div class="metric">
          <div class="metric-value">${report.summary.totalTests}</div>
          <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
          <div class="metric-value pass">${report.summary.passedTests}</div>
          <div class="metric-label">Passed</div>
        </div>
        <div class="metric">
          <div class="metric-value fail">${report.summary.failedTests}</div>
          <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
          <div class="metric-value warning">${report.summary.regressions}</div>
          <div class="metric-label">Regressions</div>
        </div>
      </div>
      ${report.summary.highlights.map(h => `<div class="highlight">${h}</div>`).join('')}
    </div>

    ${this.generateBenchmarkSection(report.benchmarks)}
    ${this.generateLoadTestSection(report.loadTest)}
    ${this.generateLighthouseSection(report.lighthouse)}
  </div>
</body>
</html>`;
  }

  private generateBenchmarkSection(benchmarks?: BenchmarkSuiteResult): string {
    if (!benchmarks) return '';
    return `<div class="card"><h2>Benchmarks</h2><table>
      <tr><th>Name</th><th>Mean</th><th>P50</th><th>P99</th><th>Throughput</th></tr>
      ${benchmarks.benchmarks.map(b => `<tr><td>${b.name}</td><td>${b.mean.toFixed(2)}ms</td><td>${b.p50.toFixed(2)}ms</td><td>${b.p99.toFixed(2)}ms</td><td>${b.throughput.toFixed(0)} ops/s</td></tr>`).join('')}
    </table></div>`;
  }

  private generateLoadTestSection(loadTest?: LoadTestResult): string {
    if (!loadTest) return '';
    return `<div class="card"><h2>Load Test</h2><div class="metrics-grid">
      <div class="metric"><div class="metric-value">${loadTest.vus}</div><div class="metric-label">VUs</div></div>
      <div class="metric"><div class="metric-value">${loadTest.iterations}</div><div class="metric-label">Requests</div></div>
      <div class="metric"><div class="metric-value">${loadTest.metrics.http_req_duration.p99.toFixed(0)}ms</div><div class="metric-label">P99 Latency</div></div>
      <div class="metric"><div class="metric-value">${(loadTest.metrics.http_req_failed.rate * 100).toFixed(2)}%</div><div class="metric-label">Error Rate</div></div>
    </div></div>`;
  }

  private generateLighthouseSection(results?: LighthouseResult[]): string {
    if (!results?.length) return '';
    return `<div class="card"><h2>Lighthouse</h2>${results.map(r => `<h3>${r.device}</h3><div class="metrics-grid">
      <div class="metric"><div class="metric-value">${r.scores.performance}</div><div class="metric-label">Performance</div></div>
      <div class="metric"><div class="metric-value">${r.metrics.lcp.toFixed(0)}ms</div><div class="metric-label">LCP</div></div>
      <div class="metric"><div class="metric-value">${r.metrics.cls.toFixed(3)}</div><div class="metric-label">CLS</div></div>
    </div>`).join('')}</div>`;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const files = readdirSync(this.outputDir);
    for (const file of files) {
      const match = file.match(/performance-report-(\d{4}-\d{2}-\d{2})/);
      if (match) {
        const fileDate = new Date(match[1]).getTime();
        if (fileDate < cutoff) {
          unlinkSync(join(this.outputDir, file));
        }
      }
    }
  }
}

export function createReportGenerator(config: ReportGeneratorConfig): ReportGenerator {
  return new ReportGenerator(config);
}

