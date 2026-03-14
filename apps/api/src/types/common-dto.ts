/**
 * Common DTO Types and Schemas for OpenAPI
 *
 * These are reusable type definitions and JSON schemas used across all API endpoints.
 * All schemas follow the API_STANDARDS.md contract.
 */

// ============================================================================
// Upload Result
// ============================================================================

export interface UploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
}

export const uploadResultSchema = {
  type: 'object',
  properties: {
    filename: { type: 'string', description: 'Stored filename on server' },
    originalName: { type: 'string', description: 'Original filename from upload' },
    size: { type: 'number', description: 'File size in bytes' },
    mimetype: { type: 'string', description: 'MIME type of the file' },
    url: { type: 'string', description: 'Public URL to access the file' },
  },
  required: ['filename', 'originalName', 'size', 'mimetype', 'url'],
} as const;

// ============================================================================
// Pagination Result
// ============================================================================

export interface PageResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Create a pagination result schema for OpenAPI
 * @param itemSchema JSON schema for individual items in the list
 */
export function createPageResultSchema(itemSchema: any) {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: itemSchema,
      },
      page: { type: 'number', description: 'Current page number (1-indexed)' },
      limit: { type: 'number', description: 'Items per page' },
      total: { type: 'number', description: 'Total number of items' },
      totalPages: { type: 'number', description: 'Total number of pages' },
    },
    required: ['items', 'page', 'limit', 'total', 'totalPages'],
  } as const;
}

// ============================================================================
// List Result (Non-Paged)
// ============================================================================

export interface ListResult<T> {
  items: T[];
  total: number;
}

/**
 * Create a list result schema for OpenAPI (non-paged lists with total)
 * @param itemSchema JSON schema for individual items in the list
 */
export function createListResultSchema(itemSchema: any) {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: itemSchema,
      },
      total: { type: 'number', description: 'Total number of items' },
    },
    required: ['items', 'total'],
  } as const;
}

// ============================================================================
// Validation Error Details
// ============================================================================

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export interface ValidationErrorDetails {
  issues: ValidationIssue[];
}

export const validationErrorDetailsSchema = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Field path (e.g., "items[0].quantity")' },
          message: { type: 'string', description: 'Human-readable error message' },
          code: { type: 'string', description: 'Machine-readable error code (e.g., "REQUIRED", "MIN", "FORMAT")' },
        },
        required: ['path', 'message', 'code'],
      },
    },
  },
  required: ['issues'],
} as const;

// ============================================================================
// Error Response
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ErrorResponse {
  success: false;
  error: ApiError;
}

export const errorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Machine-readable error code' },
        message: { type: 'string', description: 'Human-readable error message' },
        details: { description: 'Optional structured error details (e.g., validation issues)' },
      },
      required: ['code', 'message'],
    },
  },
  required: ['success', 'error'],
} as const;

// ============================================================================
// Success Response
// ============================================================================

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Create a success response schema for OpenAPI
 * @param dataSchema JSON schema for the data field
 */
export function createSuccessResponseSchema(dataSchema: any) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: dataSchema,
      message: { type: 'string', description: 'Optional human-readable message' },
    },
    required: ['success', 'data'],
  } as const;
}

// ============================================================================
// Common Response Schema Sets
// ============================================================================

/**
 * Standard CRUD response schemas with typed data field
 * @param successDataSchema JSON schema for the success response data field
 */
export function createTypedCrudResponses(successDataSchema: any) {
  return {
    200: createSuccessResponseSchema(successDataSchema),
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema,
  };
}

/**
 * Standard CREATE response schemas with typed data field
 * @param successDataSchema JSON schema for the success response data field
 */
export function createTypedCreateResponses(successDataSchema: any) {
  return {
    201: createSuccessResponseSchema(successDataSchema),
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    409: errorResponseSchema,
    500: errorResponseSchema,
  };
}

/**
 * Standard READ response schemas with typed data field
 * @param successDataSchema JSON schema for the success response data field
 */
export function createTypedReadResponses(successDataSchema: any) {
  return {
    200: createSuccessResponseSchema(successDataSchema),
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema,
  };
}

/**
 * Standard UPDATE response schemas with typed data field
 * @param successDataSchema JSON schema for the success response data field
 */
export function createTypedUpdateResponses(successDataSchema: any) {
  return {
    200: createSuccessResponseSchema(successDataSchema),
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema,
  };
}

/**
 * Standard DELETE response schemas with typed data field
 * @param successDataSchema JSON schema for the success response data field
 */
export function createTypedDeleteResponses(successDataSchema: any) {
  return {
    200: createSuccessResponseSchema(successDataSchema),
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema,
  };
}
