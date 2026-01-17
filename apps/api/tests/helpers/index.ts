/**
 * Test Helpers Index
 * 
 * Re-export all helper functions for easy importing
 */

// Database helpers
export {
  getTestPrisma,
  setupTestDatabase,
  cleanupDatabase,
  cleanTables,
  disconnectDatabase,
  withTransaction,
  resetDatabase,
} from './db';

// Test app helpers
export {
  createTestApp,
  createMinimalTestApp,
  injectWithAuth,
  type CreateTestAppOptions,
} from './create-test-app';

// Auth helpers
export {
  createTestUser,
  createAdminUser,
  createSuperAdminUser,
  signJwt,
  signExpiredJwt,
  signRefreshToken,
  signInvalidJwt,
  verifyJwt,
  getAuthHeader,
  createUserWithToken,
  createAdminWithToken,
  deleteTestUser,
  deleteAllTestUsers,
  type TestUser,
  type CreateUserOptions,
} from './auth';

// Data fixtures
export {
  createTestProduct,
  createMultipleProducts,
  createTestCart,
  createTestCartItem,
  createCartWithItems,
  createTestOrder,
  createTestOrderItem,
  createOrderWithItems,
  deleteTestProduct,
  deleteAllTestProducts,
  deleteTestOrder,
  deleteAllTestOrders,
  deleteAllTestCarts,
  cleanAllFixtures,
  type CreateProductOptions,
  type CreateCartOptions,
  type CreateCartItemOptions,
  type CreateOrderOptions,
  type CreateOrderItemOptions,
} from './fixtures';

// OpenAPI helpers
export {
  loadOpenApiSpec,
  getAllOperations,
  getOperationsByTag,
  getAuthenticatedOperations,
  getPublicOperations,
  requiresAuth,
  getResponseSchema,
  validateResponse,
  getRequestBodySchema,
  getAllTags,
  getOperationStats,
  printOperationSummary,
  type OpenAPISpec,
  type Operation,
  type PathItem,
  type Parameter,
  type RequestBody,
  type Response,
} from './openapi';
