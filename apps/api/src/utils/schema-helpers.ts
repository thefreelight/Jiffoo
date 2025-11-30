/**
 * Fastify 5.x Schema 辅助工具
 * 
 * 用于创建标准化的响应schema，解决Fastify 5.x中严格的类型检查问题
 */

// 标准错误响应schema
export const errorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'string' },
    message: { type: 'string' }
  },
  required: ['success', 'error']
}

// 标准成功响应schema
export const successResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object' }
  },
  required: ['success']
}

// 常用的响应状态码schema组合
export const commonResponseSchemas = {
  // 基础CRUD操作响应
  crud: {
    200: successResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema
  },
  
  // 创建操作响应
  create: {
    201: successResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    409: errorResponseSchema, // 冲突
    500: errorResponseSchema
  },
  
  // 只读操作响应
  read: {
    200: successResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema
  },
  
  // 更新操作响应
  update: {
    200: successResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema
  },
  
  // 删除操作响应
  delete: {
    200: successResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema
  }
}

/**
 * 创建带有完整响应状态码的schema
 * @param baseSchema 基础schema
 * @param responseType 响应类型 ('crud' | 'create' | 'read' | 'update' | 'delete')
 * @param customResponses 自定义响应schema
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
      ...baseSchema.response // 保留原有的response定义，但允许覆盖
    }
  }
}

/**
 * 为现有schema添加错误响应
 * @param schema 现有schema
 * @param additionalErrors 额外的错误状态码
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
 * 创建自定义成功响应schema
 * @param dataSchema 数据部分的schema
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
