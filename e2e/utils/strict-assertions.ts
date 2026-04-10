/**
 * Strict Assertions Utility
 *
 * Provides strict assertion methods that fail immediately if conditions are not met.
 * This replaces the defensive "if visible" pattern with proper assertions.
 *
 * Requirements: 25.1, 25.2
 */

import { Page, Locator, expect } from '@playwright/test';

export interface StrictAssertionOptions {
  timeout?: number;
  message?: string;
}

const DEFAULT_TIMEOUT = 10000;

export class StrictAssertions {
  constructor(private page: Page) {}

  /**
   * Strictly assert that an element exists and is visible
   * Fails immediately if element is not found within timeout
   */
  async mustExist(
    locator: Locator,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should exist and be visible`)
      .toBeVisible({ timeout });
  }

  /**
   * Strictly assert that an element does NOT exist or is hidden
   */
  async mustNotExist(
    locator: Locator,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should not exist`)
      .not.toBeVisible({ timeout });
  }

  /**
   * Strictly assert that an element contains specific text
   */
  async mustHaveText(
    locator: Locator,
    text: string | RegExp,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    if (typeof text === 'string') {
      await expect(locator, message || `Element should contain text: ${text}`)
        .toContainText(text, { timeout });
    } else {
      await expect(locator, message || `Element should match text pattern`)
        .toHaveText(text, { timeout });
    }
  }

  /**
   * Strictly assert that an element has exact text
   */
  async mustHaveExactText(
    locator: Locator,
    text: string,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should have exact text: ${text}`)
      .toHaveText(text, { timeout });
  }

  /**
   * Strictly assert that the page navigates to a specific URL
   */
  async mustNavigateTo(
    urlPattern: string | RegExp,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(this.page, message || `Page should navigate to: ${urlPattern}`)
      .toHaveURL(urlPattern, { timeout });
  }

  /**
   * Strictly assert that a locator matches a specific count
   */
  async mustHaveCount(
    locator: Locator,
    count: number,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should have count: ${count}`)
      .toHaveCount(count, { timeout });
  }

  /**
   * Strictly assert that a locator has at least a minimum count
   */
  async mustHaveMinCount(
    locator: Locator,
    minCount: number,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    const actualCount = await locator.count();
    if (actualCount < minCount) {
      throw new Error(
        message || `Expected at least ${minCount} elements, but found ${actualCount}`
      );
    }
  }

  /**
   * Strictly assert that an element is clickable (enabled and visible)
   */
  async mustBeClickable(
    locator: Locator,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should be enabled`)
      .toBeEnabled({ timeout });
    await expect(locator, message || `Element should be visible`)
      .toBeVisible({ timeout });
  }

  /**
   * Strictly assert that an element is disabled
   */
  async mustBeDisabled(
    locator: Locator,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should be disabled`)
      .toBeDisabled({ timeout });
  }

  /**
   * Strictly assert that an input has a specific value
   */
  async mustHaveValue(
    locator: Locator,
    value: string | RegExp,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Input should have value: ${value}`)
      .toHaveValue(value, { timeout });
  }

  /**
   * Strictly assert that an element has a specific attribute
   */
  async mustHaveAttribute(
    locator: Locator,
    name: string,
    value: string | RegExp,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should have attribute ${name}=${value}`)
      .toHaveAttribute(name, value, { timeout });
  }

  /**
   * Strictly assert that an element has a specific CSS class
   */
  async mustHaveClass(
    locator: Locator,
    className: string | RegExp,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should have class: ${className}`)
      .toHaveClass(className, { timeout });
  }

  /**
   * Strictly assert that a checkbox/radio is checked
   */
  async mustBeChecked(
    locator: Locator,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should be checked`)
      .toBeChecked({ timeout });
  }

  /**
   * Strictly assert that a checkbox/radio is NOT checked
   */
  async mustNotBeChecked(
    locator: Locator,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should not be checked`)
      .not.toBeChecked({ timeout });
  }

  /**
   * Strictly assert that the page title matches
   */
  async mustHaveTitle(
    title: string | RegExp,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(this.page, message || `Page should have title: ${title}`)
      .toHaveTitle(title, { timeout });
  }

  /**
   * Strictly assert that an element is focused
   */
  async mustBeFocused(
    locator: Locator,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should be focused`)
      .toBeFocused({ timeout });
  }

  /**
   * Strictly assert that an element is in viewport
   */
  async mustBeInViewport(
    locator: Locator,
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    await expect(locator, message || `Element should be in viewport`)
      .toBeInViewport({ timeout });
  }

  /**
   * Strictly assert that loading is complete (no loading indicators)
   */
  async mustFinishLoading(
    loadingSelector: string = '[data-testid="loading"]',
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    const loadingLocator = this.page.locator(loadingSelector);
    await expect(loadingLocator, message || `Loading should complete`)
      .not.toBeVisible({ timeout });
  }

  /**
   * Strictly assert that no error messages are displayed
   */
  async mustHaveNoErrors(
    errorSelector: string = '[data-testid="error-message"], .error, .alert-error',
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = 5000, message } = options || {};
    const errorLocator = this.page.locator(errorSelector);
    await expect(errorLocator, message || `No errors should be displayed`)
      .not.toBeVisible({ timeout });
  }

  /**
   * Strictly assert that an error message is displayed
   */
  async mustShowError(
    errorText?: string | RegExp,
    errorSelector: string = '[data-testid="error-message"], .error, .alert-error',
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    const errorLocator = this.page.locator(errorSelector);
    await expect(errorLocator, message || `Error should be displayed`)
      .toBeVisible({ timeout });
    if (errorText) {
      if (typeof errorText === 'string') {
        await expect(errorLocator).toContainText(errorText, { timeout });
      } else {
        await expect(errorLocator).toHaveText(errorText, { timeout });
      }
    }
  }

  /**
   * Strictly assert that a success message is displayed
   */
  async mustShowSuccess(
    successText?: string | RegExp,
    successSelector: string = '[data-testid="success-message"], .success, .alert-success',
    options?: StrictAssertionOptions
  ): Promise<void> {
    const { timeout = DEFAULT_TIMEOUT, message } = options || {};
    const successLocator = this.page.locator(successSelector);
    await expect(successLocator, message || `Success message should be displayed`)
      .toBeVisible({ timeout });
    if (successText) {
      if (typeof successText === 'string') {
        await expect(successLocator).toContainText(successText, { timeout });
      } else {
        await expect(successLocator).toHaveText(successText, { timeout });
      }
    }
  }
}

/**
 * Create a StrictAssertions instance for a page
 */
export function createStrictAssertions(page: Page): StrictAssertions {
  return new StrictAssertions(page);
}
