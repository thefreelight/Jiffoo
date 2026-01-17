import { Page, TestInfo } from '@playwright/test';
import { CollectedError, ErrorCollector } from './error-collector';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Error report format
 */
export interface ErrorReport {
  testName: string;
  testFile: string;
  timestamp: Date;
  url: string;
  errors: CollectedError[];
  screenshots: string[];
  summary: {
    totalErrors: number;
    consoleErrors: number;
    networkErrors: number;
    imageErrors: number;
    infiniteLoops: number;
  };
}

/**
 * ErrorReporter - Generates detailed error reports with screenshots
 * 
 * Creates HTML and JSON reports for test failures
 */
export class ErrorReporter {
  private reports: ErrorReport[] = [];
  private outputDir: string;

  constructor(outputDir: string = 'test-results/error-reports') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate report from error collector
   */
  async generateReport(
    page: Page,
    errorCollector: ErrorCollector,
    testInfo: TestInfo
  ): Promise<ErrorReport> {
    const errors = errorCollector.getErrors();
    const screenshots: string[] = [];

    // Take screenshot if there are errors
    if (errors.length > 0) {
      const screenshotPath = path.join(
        this.outputDir,
        `${testInfo.title.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.png`
      );
      
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push(screenshotPath);
    }

    const report: ErrorReport = {
      testName: testInfo.title,
      testFile: testInfo.file,
      timestamp: new Date(),
      url: page.url(),
      errors,
      screenshots,
      summary: {
        totalErrors: errors.length,
        consoleErrors: errors.filter(e => e.type === 'console').length,
        networkErrors: errors.filter(e => e.type === 'network').length,
        imageErrors: errors.filter(e => e.type === 'image').length,
        infiniteLoops: errors.filter(e => e.type === 'infinite-loop').length,
      },
    };

    this.reports.push(report);
    return report;
  }

  /**
   * Save report to JSON file
   */
  saveJsonReport(report: ErrorReport): string {
    const filename = `${report.testName.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    return filepath;
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport(report: ErrorReport): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Error Report: ${report.testName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    h1 { color: #e53e3e; }
    .summary { background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .summary-item { display: inline-block; margin-right: 20px; }
    .error-list { list-style: none; padding: 0; }
    .error-item { background: #fff5f5; border-left: 4px solid #e53e3e; padding: 10px; margin-bottom: 10px; }
    .error-type { font-weight: bold; color: #c53030; }
    .error-url { color: #718096; font-size: 0.9em; }
    .screenshot { max-width: 100%; border: 1px solid #e2e8f0; margin-top: 20px; }
    .timestamp { color: #a0aec0; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Error Report: ${report.testName}</h1>
  <p class="timestamp">Generated: ${report.timestamp.toISOString()}</p>
  <p>URL: <a href="${report.url}">${report.url}</a></p>
  
  <div class="summary">
    <h2>Summary</h2>
    <div class="summary-item">Total Errors: <strong>${report.summary.totalErrors}</strong></div>
    <div class="summary-item">Console: <strong>${report.summary.consoleErrors}</strong></div>
    <div class="summary-item">Network: <strong>${report.summary.networkErrors}</strong></div>
    <div class="summary-item">Images: <strong>${report.summary.imageErrors}</strong></div>
    <div class="summary-item">Infinite Loops: <strong>${report.summary.infiniteLoops}</strong></div>
  </div>
  
  <h2>Errors</h2>
  <ul class="error-list">
    ${report.errors.map(error => `
      <li class="error-item">
        <span class="error-type">[${error.type.toUpperCase()}]</span>
        <p>${error.message}</p>
        ${error.url ? `<p class="error-url">URL: ${error.url}</p>` : ''}
        <p class="timestamp">${error.timestamp.toISOString()}</p>
      </li>
    `).join('')}
  </ul>
  
  ${report.screenshots.length > 0 ? `
    <h2>Screenshots</h2>
    ${report.screenshots.map(screenshot => `
      <img class="screenshot" src="${screenshot}" alt="Error screenshot" />
    `).join('')}
  ` : ''}
</body>
</html>
    `;

    const filename = `${report.testName.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.html`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, html);
    return filepath;
  }

  /**
   * Generate combined report for all tests
   */
  generateCombinedReport(): string {
    const totalErrors = this.reports.reduce((sum, r) => sum + r.summary.totalErrors, 0);
    const testsWithErrors = this.reports.filter(r => r.summary.totalErrors > 0);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>E2E Error Report Summary</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    h1 { color: #2d3748; }
    .summary { background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .test-item { background: #fff; border: 1px solid #e2e8f0; padding: 15px; margin-bottom: 10px; border-radius: 8px; }
    .test-item.has-errors { border-left: 4px solid #e53e3e; }
    .test-name { font-weight: bold; }
    .error-count { color: #e53e3e; }
    .no-errors { color: #38a169; }
  </style>
</head>
<body>
  <h1>E2E Error Report Summary</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  
  <div class="summary">
    <h2>Overall Summary</h2>
    <p>Total Tests: ${this.reports.length}</p>
    <p>Tests with Errors: ${testsWithErrors.length}</p>
    <p>Total Errors: ${totalErrors}</p>
  </div>
  
  <h2>Test Results</h2>
  ${this.reports.map(report => `
    <div class="test-item ${report.summary.totalErrors > 0 ? 'has-errors' : ''}">
      <p class="test-name">${report.testName}</p>
      <p>File: ${report.testFile}</p>
      ${report.summary.totalErrors > 0 
        ? `<p class="error-count">Errors: ${report.summary.totalErrors}</p>`
        : `<p class="no-errors">No errors</p>`
      }
    </div>
  `).join('')}
</body>
</html>
    `;

    const filepath = path.join(this.outputDir, 'summary.html');
    fs.writeFileSync(filepath, html);
    return filepath;
  }

  /**
   * Get all reports
   */
  getReports(): ErrorReport[] {
    return this.reports;
  }

  /**
   * Clear all reports
   */
  clear(): void {
    this.reports = [];
  }
}

/**
 * Create error reporter instance
 */
export function createErrorReporter(outputDir?: string): ErrorReporter {
  return new ErrorReporter(outputDir);
}
