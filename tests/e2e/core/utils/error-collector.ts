import { Page } from '@playwright/test';

/**
 * Types of errors that can be collected during E2E tests
 */
export type ErrorType = 'console' | 'network' | 'image' | 'infinite-loop';

/**
 * Represents a collected error during test execution
 */
export interface CollectedError {
  type: ErrorType;
  message: string;
  url?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * Configuration options for ErrorCollector
 */
export interface ErrorCollectorOptions {
  /** Ignore specific console error patterns */
  ignoreConsolePatterns?: RegExp[];
  /** Ignore specific network error URLs */
  ignoreNetworkUrls?: RegExp[];
  /** Maximum page reloads before detecting infinite loop */
  maxReloadsBeforeLoop?: number;
  /** Time window for detecting infinite loops (ms) */
  loopDetectionWindow?: number;
}

const DEFAULT_OPTIONS: Required<ErrorCollectorOptions> = {
  ignoreConsolePatterns: [
    /Download the React DevTools/,
    /Warning: ReactDOM.render is no longer supported/,
    /hydration/i,
    // Next.js development warnings
    /Warning: Extra attributes from the server/i,
    /Warning: Prop .* did not match/i,
    /Warning: Text content did not match/i,
    /Warning: Expected server HTML/i,
    // React 18+ warnings
    /Warning: Cannot update a component/i,
    /Warning: A component is changing/i,
    /Warning: validateDOMNesting/i,
    // Network related errors during development
    /Failed to load resource/i,
    /net::ERR_/i,
    // Third-party scripts
    /third-party/i,
    /google/i,
    /analytics/i,
    // TanStack Query devtools
    /tanstack/i,
    /devtools/i,
  ],
  ignoreNetworkUrls: [
    /favicon\.ico/,
    /hot-update/,
    /_next\/static/,
    /api\/health/,
    /api\/categories/,
    /api\/products/,
    /api\/cart/,
    /api\/orders/,
  ],
  maxReloadsBeforeLoop: 3,
  loopDetectionWindow: 5000,
};

/**
 * ErrorCollector - Captures and tracks frontend errors during E2E tests
 * 
 * Monitors:
 * - Console errors
 * - Network request failures (4xx, 5xx)
 * - Image loading failures
 * - Infinite refresh loops
 */
export class ErrorCollector {
  private errors: CollectedError[] = [];
  private pageLoadTimestamps: number[] = [];
  private lastUrl = '';
  private options: Required<ErrorCollectorOptions>;

  constructor(
    private page: Page,
    options: ErrorCollectorOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.setupListeners();
  }

  /**
   * Set up all event listeners for error collection
   */
  private setupListeners(): void {
    this.setupConsoleListener();
    this.setupNetworkListener();
    this.setupImageListener();
    this.setupLoopDetection();
  }

  /**
   * Capture console errors
   */
  private setupConsoleListener(): void {
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        
        // Check if error should be ignored
        const shouldIgnore = this.options.ignoreConsolePatterns.some(
          pattern => pattern.test(text)
        );
        
        if (!shouldIgnore) {
          this.errors.push({
            type: 'console',
            message: text,
            url: this.page.url(),
            timestamp: new Date(),
            details: {
              location: msg.location(),
            },
          });
        }
      }
    });
  }

  /**
   * Capture network request failures
   */
  private setupNetworkListener(): void {
    this.page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      
      if (status >= 400) {
        // Check if URL should be ignored
        const shouldIgnore = this.options.ignoreNetworkUrls.some(
          pattern => pattern.test(url)
        );
        
        if (!shouldIgnore) {
          this.errors.push({
            type: 'network',
            message: `HTTP ${status} ${response.statusText()}`,
            url: url,
            timestamp: new Date(),
            details: {
              status,
              statusText: response.statusText(),
              method: response.request().method(),
            },
          });
        }
      }
    });
  }

  /**
   * Capture image loading failures
   */
  private setupImageListener(): void {
    this.page.on('requestfailed', (request) => {
      if (request.resourceType() === 'image') {
        const failure = request.failure();
        this.errors.push({
          type: 'image',
          message: `Image failed to load: ${failure?.errorText || 'Unknown error'}`,
          url: request.url(),
          timestamp: new Date(),
          details: {
            errorText: failure?.errorText,
          },
        });
      }
    });
  }

  /**
   * Detect infinite refresh loops
   */
  private setupLoopDetection(): void {
    this.page.on('load', () => {
      const currentUrl = this.page.url();
      const now = Date.now();
      
      // Clean up old timestamps outside the detection window
      this.pageLoadTimestamps = this.pageLoadTimestamps.filter(
        ts => now - ts < this.options.loopDetectionWindow
      );
      
      // Track this load
      if (currentUrl === this.lastUrl) {
        this.pageLoadTimestamps.push(now);
        
        if (this.pageLoadTimestamps.length >= this.options.maxReloadsBeforeLoop) {
          this.errors.push({
            type: 'infinite-loop',
            message: `Page reloaded ${this.pageLoadTimestamps.length} times on same URL within ${this.options.loopDetectionWindow}ms`,
            url: currentUrl,
            timestamp: new Date(),
            details: {
              reloadCount: this.pageLoadTimestamps.length,
              timeWindow: this.options.loopDetectionWindow,
            },
          });
        }
      } else {
        this.pageLoadTimestamps = [now];
        this.lastUrl = currentUrl;
      }
    });
  }

  /**
   * Get all collected errors
   */
  getErrors(): CollectedError[] {
    return [...this.errors];
  }

  /**
   * Get errors filtered by type
   */
  getErrorsByType(type: ErrorType): CollectedError[] {
    return this.errors.filter(e => e.type === type);
  }

  /**
   * Check if any errors were collected
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if specific error type was collected
   */
  hasErrorType(type: ErrorType): boolean {
    return this.errors.some(e => e.type === type);
  }

  /**
   * Clear all collected errors
   */
  clear(): void {
    this.errors = [];
    this.pageLoadTimestamps = [];
  }

  /**
   * Generate a formatted error report
   */
  generateReport(): string {
    if (!this.hasErrors()) {
      return 'No errors detected.';
    }

    const lines = ['Frontend Errors Detected:', ''];
    
    const groupedErrors = this.errors.reduce((acc, error) => {
      if (!acc[error.type]) {
        acc[error.type] = [];
      }
      acc[error.type].push(error);
      return acc;
    }, {} as Record<ErrorType, CollectedError[]>);

    for (const [type, errors] of Object.entries(groupedErrors)) {
      lines.push(`## ${type.toUpperCase()} ERRORS (${errors.length})`);
      for (const error of errors) {
        lines.push(`  - ${error.message}`);
        if (error.url) {
          lines.push(`    URL: ${error.url}`);
        }
        lines.push(`    Time: ${error.timestamp.toISOString()}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Assert that no errors were collected
   * Throws an error with detailed report if errors exist
   */
  assertNoErrors(): void {
    if (this.hasErrors()) {
      throw new Error(this.generateReport());
    }
  }

  /**
   * Assert that no errors of specific type were collected
   */
  assertNoErrorType(type: ErrorType): void {
    const typeErrors = this.getErrorsByType(type);
    if (typeErrors.length > 0) {
      const report = typeErrors
        .map(e => `[${e.type}] ${e.message} (${e.url})`)
        .join('\n');
      throw new Error(`${type} errors detected:\n${report}`);
    }
  }
}

/**
 * Create an ErrorCollector instance for a page
 */
export function createErrorCollector(
  page: Page,
  options?: ErrorCollectorOptions
): ErrorCollector {
  return new ErrorCollector(page, options);
}

/**
 * Verify all images on the page loaded successfully
 */
export async function verifyImagesLoaded(page: Page): Promise<void> {
  const images = page.locator('img');
  const count = await images.count();
  const failedImages: string[] = [];

  for (let i = 0; i < count; i++) {
    const img = images.nth(i);
    const isVisible = await img.isVisible();
    
    if (isVisible) {
      const naturalWidth = await img.evaluate(
        // @ts-expect-error - HTMLImageElement.naturalWidth exists in browser context
        (el) => el.naturalWidth
      );
      
      if (naturalWidth === 0) {
        const src = await img.getAttribute('src');
        failedImages.push(src || `Image ${i}`);
      }
    }
  }

  if (failedImages.length > 0) {
    throw new Error(
      `${failedImages.length} images failed to load:\n${failedImages.join('\n')}`
    );
  }
}
