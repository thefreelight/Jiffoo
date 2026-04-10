/**
 * E2E Test Utilities
 * 
 * Export all utility functions and classes for E2E testing
 */

// Error handling utilities
export {
  ErrorCollector,
  createErrorCollector,
  verifyImagesLoaded,
  type CollectedError,
  type ErrorType,
  type ErrorCollectorOptions,
} from './error-collector';

export {
  ErrorReporter,
  createErrorReporter,
  type ErrorReport,
} from './error-reporter';

// Visual comparison utilities
export {
  VisualComparison,
  createVisualComparison,
  maskDynamicContent,
  waitForVisualStability,
  type VisualComparisonConfig,
  type ComparisonResult,
} from './visual-comparison';

// Legacy auth fixtures (for backward compatibility)
export {
  test as legacyTest,
  expect as legacyExpect,
  loginToShop,
  loginToAdmin,
  logout,
  isLoggedIn,
  setAuthToken,
  clearAuth,
  TEST_USERS,
  type TestUser as LegacyTestUser,
  type UserRole,
} from './auth-fixtures';

// New strict assertions
export {
  StrictAssertions,
  createStrictAssertions,
  type StrictAssertionOptions,
} from './strict-assertions';

// API interceptor
export {
  ApiInterceptor,
  createApiInterceptor,
  type ApiCall,
  type MockResponseOptions,
} from './api-interceptor';

// Auth helper
export {
  AuthHelper,
  createAuthHelper,
  DEFAULT_CREDENTIALS,
  type LoginCredentials,
  type AuthState,
} from './auth-helper';

// Data factory
export {
  DataFactory,
  createDataFactory,
  type UserData,
  type ProductData,
  type OrderData,
  type TenantData,
} from './data-factory';

// Enhanced test fixtures (recommended)
export {
  test,
  expect,
  createTest,
  skipIf,
  skipInCI,
  onlyInCI,
  waitForNetworkIdle,
  waitForImages,
  takeScreenshot,
  logConsoleMessages,
  logPageErrors,
  type TestFixtures,
  type TestUser,
  type TestProduct,
} from './test-fixtures';
