/**
 * Fastify 5.x Schema Helpers
 * 
 * Used to create standardized response schemas, resolving strict type checking issues in Fastify 5.x
 */

// Standard error response schema
export const errorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'string' },
    message: { type: 'string' }
  },
  required: ['success', 'error']
}

// Standard success response schema
export const successResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object' }
  },
  required: ['success']
}

// Common response status code schema combinations
export const commonResponseSchemas = {
  // Basic CRUD operation response
  crud: {
    200: successResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema
  },

  // Create operation response
  create: {
    201: successResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    409: errorResponseSchema, // Conflict
    500: errorResponseSchema
  },

  // Read-only operation response
  read: {
    200: successResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema
  },

  // Update operation response
  update: {
    200: successResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema
  },

  // Delete operation response
  delete: {
    200: successResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema
  }
}

/**
 * Create schema with complete response status codes
 * @param baseSchema Base schema
 * @param responseType Response type ('crud' | 'create' | 'read' | 'update' | 'delete')
 * @param customResponses Custom response schema
 */
export function createCompleteSchema(
  baseSchema: any,
  responseType: keyof typeof commonResponseSchemas = 'crud',
  customResponses: Record<string, any> = {}
) {
  return {
    ...baseSchema,
    response: {
      ...commonResponseSchemas[responseType],
      ...customResponses,
      ...baseSchema.response // Retain existing response definition, but allowed to be overridden
    }
  }
}

/**
 * Add error responses to existing schema
 * @param schema Existing schema
 * @param additionalErrors Additional error status codes
 */
export function addErrorResponses(
  schema: any,
  additionalErrors: number[] = [400, 401, 403, 404, 500]
) {
  if (!schema.response) {
    schema.response = {}
  }

  additionalErrors.forEach(statusCode => {
    if (!schema.response[statusCode]) {
      schema.response[statusCode] = errorResponseSchema
    }
  })

  return schema
}

/**
 * Create custom success response schema
 * @param dataSchema Data section schema
 */
export function createSuccessResponse(dataSchema: any) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: dataSchema
    },
    required: ['success', 'data']
  }
}
