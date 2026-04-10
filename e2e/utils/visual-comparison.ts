import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Visual comparison configuration
 */
export interface VisualComparisonConfig {
  /** Directory for baseline screenshots */
  baselineDir: string;
  /** Directory for current screenshots */
  currentDir: string;
  /** Directory for diff images */
  diffDir: string;
  /** Maximum allowed pixel difference percentage (0-1) */
  threshold: number;
  /** Maximum allowed different pixels */
  maxDiffPixels: number;
}

const DEFAULT_CONFIG: VisualComparisonConfig = {
  baselineDir: 'e2e/visual/baselines',
  currentDir: 'test-results/visual/current',
  diffDir: 'test-results/visual/diff',
  threshold: 0.1,
  maxDiffPixels: 100,
};

/**
 * Visual comparison result
 */
export interface ComparisonResult {
  passed: boolean;
  baselineExists: boolean;
  diffPixels: number;
  diffPercentage: number;
  baselinePath: string;
  currentPath: string;
  diffPath?: string;
}

/**
 * VisualComparison - Utility for visual regression testing
 */
export class VisualComparison {
  private config: VisualComparisonConfig;

  constructor(config: Partial<VisualComparisonConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureDirectories();
  }

  /**
   * Ensure all directories exist
   */
  private ensureDirectories(): void {
    [this.config.baselineDir, this.config.currentDir, this.config.diffDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Capture screenshot for comparison
   */
  async captureScreenshot(
    page: Page,
    name: string,
    options: { fullPage?: boolean; mask?: string[] } = {}
  ): Promise<string> {
    const filename = `${name}.png`;
    const filepath = path.join(this.config.currentDir, filename);

    // Mask dynamic elements if specified
    if (options.mask && options.mask.length > 0) {
      await this.maskElements(page, options.mask);
    }

    await page.screenshot({
      path: filepath,
      fullPage: options.fullPage ?? true,
    });

    return filepath;
  }

  /**
   * Mask elements to exclude from comparison
   */
  private async maskElements(page: Page, selectors: string[]): Promise<void> {
    await page.evaluate((sels) => {
      sels.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          (el as HTMLElement).style.visibility = 'hidden';
        });
      });
    }, selectors);
  }

  /**
   * Check if baseline exists
   */
  baselineExists(name: string): boolean {
    const baselinePath = path.join(this.config.baselineDir, `${name}.png`);
    return fs.existsSync(baselinePath);
  }

  /**
   * Update baseline with current screenshot
   */
  updateBaseline(name: string): void {
    const currentPath = path.join(this.config.currentDir, `${name}.png`);
    const baselinePath = path.join(this.config.baselineDir, `${name}.png`);

    if (fs.existsSync(currentPath)) {
      fs.copyFileSync(currentPath, baselinePath);
    }
  }

  /**
   * Get baseline path
   */
  getBaselinePath(name: string): string {
    return path.join(this.config.baselineDir, `${name}.png`);
  }

  /**
   * Get current screenshot path
   */
  getCurrentPath(name: string): string {
    return path.join(this.config.currentDir, `${name}.png`);
  }

  /**
   * Get diff image path
   */
  getDiffPath(name: string): string {
    return path.join(this.config.diffDir, `${name}-diff.png`);
  }
}

/**
 * Create visual comparison instance
 */
export function createVisualComparison(
  config?: Partial<VisualComparisonConfig>
): VisualComparison {
  return new VisualComparison(config);
}

/**
 * Mask dynamic content on page
 */
export async function maskDynamicContent(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Common dynamic content selectors
    const dynamicSelectors = [
      // Timestamps
      '[data-testid="timestamp"]',
      '.timestamp',
      'time',
      '[datetime]',
      
      // IDs
      '[data-testid="order-id"]',
      '[data-testid="session-id"]',
      '.order-id',
      
      // Loading states
      '.loading',
      '.spinner',
      '[data-testid="loading"]',
      
      // Animations
      '.animate',
      '[data-animate]',
    ];

    dynamicSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
  });
}

/**
 * Wait for page to be visually stable
 */
export async function waitForVisualStability(
  page: Page,
  timeout: number = 2000
): Promise<void> {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
  
  // Wait for animations to complete
  await page.waitForTimeout(timeout);
  
  // Wait for images to load
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter(img => !img.complete)
        .map(img => new Promise(resolve => {
          img.onload = img.onerror = resolve;
        }))
    );
  });
}
