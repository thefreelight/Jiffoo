/**
 * API Interceptor Utility
 *
 * Intercepts and records API calls for verification in E2E tests.
 * Allows asserting that specific API calls were made with expected parameters.
 *
 * Requirements: 26.1, 26.2
 */

import { Page, Route, Request, Response } from '@playwright/test';

export interface ApiCall {
  url: string;
  method: string;
  requestBody?: any;
  requestHeaders: Record<string, string>;
  responseStatus: number;
  responseBody?: any;
  responseHeaders: Record<string, string>;
  timestamp: number;
  duration: number;
}

export interface MockResponseOptions {
  status?: number;
  body?: any;
  headers?: Record<string, string>;
  delay?: number;
}

export class ApiInterceptor {
  private calls: ApiCall[] = [];
  private mocks: Map<string, MockResponseOptions> = new Map();
  private isStarted = false;

  constructor(private page: Page) {}

  /**
   * Start intercepting API calls
   */
  async start(urlPattern: string | RegExp = '**/api/**'): Promise<void> {
    if (this.isStarted) return;

    await this.page.route(urlPattern, async (route: Route) => {
      const request = route.request();
      const startTime = Date.now();
      const url = request.url();

      // Check if we have a mock for this URL
      const mockKey = this.findMockKey(url);
      if (mockKey) {
        const mock = this.mocks.get(mockKey)!;
        if (mock.delay) {
          await new Promise(resolve => setTimeout(resolve, mock.delay));
        }

        const call: ApiCall = {
          url,
          method: request.method(),
          requestBody: this.safeParseJson(request.postData()),
          requestHeaders: request.headers(),
          responseStatus: mock.status || 200,
          responseBody: mock.body,
          responseHeaders: mock.headers || {},
          timestamp: startTime,
          duration: Date.now() - startTime,
        };
        this.calls.push(call);

        await route.fulfill({
          status: mock.status || 200,
          body: JSON.stringify(mock.body),
          headers: { 'Content-Type': 'application/json', ...mock.headers },
        });
        return;
      }

      // Otherwise, let the request through and record it
      try {
        const response = await route.fetch();
        const responseBody = await this.safeGetResponseBody(response as any);

        const call: ApiCall = {
          url,
          method: request.method(),
          requestBody: this.safeParseJson(request.postData()),
          requestHeaders: request.headers(),
          responseStatus: response.status(),
          responseBody,
          responseHeaders: response.headers(),
          timestamp: startTime,
          duration: Date.now() - startTime,
        };
        this.calls.push(call);

        await route.fulfill({ response });
      } catch (error) {
        // If fetch fails, continue the route
        await route.continue();
      }
    });

    this.isStarted = true;
  }

  /**
   * Stop intercepting API calls
   */
  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.page.unroute('**/api/**');
    this.isStarted = false;
  }

  /**
   * Get all recorded API calls
   */
  getCalls(): ApiCall[] {
    return [...this.calls];
  }

  /**
   * Get calls matching a URL pattern
   */
  getCallsTo(urlPattern: string | RegExp): ApiCall[] {
    return this.calls.filter(call =>
      typeof urlPattern === 'string'
        ? call.url.includes(urlPattern)
        : urlPattern.test(call.url)
    );
  }

  /**
   * Get the last call matching a URL pattern
   */
  getLastCallTo(urlPattern: string | RegExp): ApiCall | undefined {
    const calls = this.getCallsTo(urlPattern);
    return calls[calls.length - 1];
  }

  /**
   * Assert that an API call was made
   */
  assertCalled(
    urlPattern: string | RegExp,
    options?: { method?: string; times?: number }
  ): void {
    const calls = this.getCallsTo(urlPattern);
    let filteredCalls = calls;

    if (options?.method) {
      filteredCalls = calls.filter(c => c.method === options.method);
    }

    if (filteredCalls.length === 0) {
      const methodStr = options?.method ? ` with method ${options.method}` : '';
      throw new Error(
        `Expected API call to ${urlPattern}${methodStr}, but none found. ` +
        `Recorded calls: ${this.calls.map(c => `${c.method} ${c.url}`).join(', ')}`
      );
    }

    if (options?.times !== undefined && filteredCalls.length !== options.times) {
      throw new Error(
        `Expected ${options.times} API calls to ${urlPattern}, but found ${filteredCalls.length}`
      );
    }
  }

  /**
   * Assert that an API call was NOT made
   */
  assertNotCalled(urlPattern: string | RegExp, method?: string): void {
    const calls = this.getCallsTo(urlPattern);
    const filteredCalls = method
      ? calls.filter(c => c.method === method)
      : calls;

    if (filteredCalls.length > 0) {
      const methodStr = method ? ` with method ${method}` : '';
      throw new Error(
        `Expected no API call to ${urlPattern}${methodStr}, but found ${filteredCalls.length}`
      );
    }
  }

  /**
   * Assert that the last API call returned a specific status
   */
  assertResponseStatus(urlPattern: string | RegExp, expectedStatus: number): void {
    const lastCall = this.getLastCallTo(urlPattern);
    if (!lastCall) {
      throw new Error(`No API call found to ${urlPattern}`);
    }
    if (lastCall.responseStatus !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus} for ${urlPattern}, got ${lastCall.responseStatus}`
      );
    }
  }

  /**
   * Assert that the last API call's request body contains specific data
   */
  assertRequestBody(
    urlPattern: string | RegExp,
    expectedBody: Record<string, any>
  ): void {
    const lastCall = this.getLastCallTo(urlPattern);
    if (!lastCall) {
      throw new Error(`No API call found to ${urlPattern}`);
    }
    if (!lastCall.requestBody) {
      throw new Error(`API call to ${urlPattern} had no request body`);
    }

    for (const [key, value] of Object.entries(expectedBody)) {
      if (lastCall.requestBody[key] !== value) {
        throw new Error(
          `Expected request body.${key} to be ${JSON.stringify(value)}, ` +
          `got ${JSON.stringify(lastCall.requestBody[key])}`
        );
      }
    }
  }

  /**
   * Assert that the last API call's response body contains specific data
   */
  assertResponseBody(
    urlPattern: string | RegExp,
    expectedBody: Record<string, any>
  ): void {
    const lastCall = this.getLastCallTo(urlPattern);
    if (!lastCall) {
      throw new Error(`No API call found to ${urlPattern}`);
    }
    if (!lastCall.responseBody) {
      throw new Error(`API call to ${urlPattern} had no response body`);
    }

    for (const [key, value] of Object.entries(expectedBody)) {
      const actualValue = this.getNestedValue(lastCall.responseBody, key);
      if (JSON.stringify(actualValue) !== JSON.stringify(value)) {
        throw new Error(
          `Expected response body.${key} to be ${JSON.stringify(value)}, ` +
          `got ${JSON.stringify(actualValue)}`
        );
      }
    }
  }

  /**
   * Mock an API response
   */
  mockResponse(urlPattern: string, options: MockResponseOptions): void {
    this.mocks.set(urlPattern, options);
  }

  /**
   * Mock an API error response
   */
  mockError(
    urlPattern: string,
    status: number = 500,
    message: string = 'Internal Server Error'
  ): void {
    this.mocks.set(urlPattern, {
      status,
      body: { success: false, error: message },
    });
  }

  /**
   * Mock a network timeout
   */
  mockTimeout(urlPattern: string, delayMs: number = 30000): void {
    this.mocks.set(urlPattern, {
      delay: delayMs,
      status: 408,
      body: { success: false, error: 'Request Timeout' },
    });
  }

  /**
   * Clear all mocks
   */
  clearMocks(): void {
    this.mocks.clear();
  }

  /**
   * Clear all recorded calls
   */
  clear(): void {
    this.calls = [];
  }

  /**
   * Reset interceptor (clear calls and mocks)
   */
  reset(): void {
    this.calls = [];
    this.mocks.clear();
  }

  /**
   * Wait for an API call to be made
   */
  async waitForCall(
    urlPattern: string | RegExp,
    options?: { method?: string; timeout?: number }
  ): Promise<ApiCall> {
    const timeout = options?.timeout || 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const calls = this.getCallsTo(urlPattern);
      const filteredCalls = options?.method
        ? calls.filter(c => c.method === options.method)
        : calls;

      if (filteredCalls.length > 0) {
        return filteredCalls[filteredCalls.length - 1];
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(
      `Timeout waiting for API call to ${urlPattern}` +
      (options?.method ? ` with method ${options.method}` : '')
    );
  }

  // Private helper methods

  private findMockKey(url: string): string | undefined {
    for (const key of this.mocks.keys()) {
      if (url.includes(key)) {
        return key;
      }
    }
    return undefined;
  }

  private safeParseJson(data: string | null): any {
    if (!data) return undefined;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  private async safeGetResponseBody(response: Response): Promise<any> {
    try {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch {
      return undefined;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

/**
 * Create an ApiInterceptor instance for a page
 */
export function createApiInterceptor(page: Page): ApiInterceptor {
  return new ApiInterceptor(page);
}
