/**
 * Swagger 租户相关的 Schema 定义
 * 为API文档添加租户上下文的说明
 */

/**
 * 租户头部参数定义
 */
export const tenantHeaderSchema = {
  'X-Tenant-ID': {
    type: 'string',
    description: 'Tenant identifier for multi-tenant operations',
    example: 'tenant-123',
    required: false
  }
};

/**
 * 必需的租户头部参数定义
 */
export const requiredTenantHeaderSchema = {
  'X-Tenant-ID': {
    type: 'string',
    description: 'Tenant identifier (required for this operation)',
    example: 'tenant-123',
    required: true
  }
};

/**
 * 租户错误响应 Schema
 */
export const tenantErrorResponseSchema = {
  type: 'object' as const,
  properties: {
    success: {
      type: 'boolean' as const,
      example: false
    },
    error: {
      type: 'object' as const,
      properties: {
        code: {
          type: 'string' as const,
          enum: [
            'TENANT_NOT_FOUND',
            'TENANT_ACCESS_DENIED',
            'TENANT_CONTEXT_MISSING',
            'TENANT_RESOURCE_NOT_FOUND',
            'TENANT_QUOTA_EXCEEDED',
            'TENANT_INACTIVE',
            'CROSS_TENANT_ACCESS_DENIED'
          ],
          example: 'TENANT_ACCESS_DENIED'
        },
        message: {
          type: 'string' as const,
          example: 'Access to tenant \'tenant-123\' is denied'
        },
        details: {
          type: 'object' as const,
          description: 'Additional error details'
        },
        timestamp: {
          type: 'string' as const,
          format: 'date-time',
          example: '2024-01-15T10:30:00Z'
        },
        requestId: {
          type: 'string' as const,
          example: 'req-abc123'
        },
        tenantId: {
          type: 'string' as const,
          example: 'tenant-123'
        }
      }
    },
    suggestions: {
      type: 'array' as const,
      items: {
        type: 'string' as const
      },
      example: [
        'Verify you have permission to access this tenant',
        'Check your user role and tenant associations'
      ]
    }
  }
};

/**
 * 租户上下文 Schema
 */
export const tenantContextSchema = {
  type: 'object' as const,
  properties: {
    tenantId: {
      type: 'string' as const,
      description: 'Current tenant identifier',
      example: 'tenant-123'
    },
    tenantName: {
      type: 'string' as const,
      description: 'Current tenant name',
      example: 'Acme Corporation'
    },
    tenantRole: {
      type: 'string' as const,
      description: 'User role within the tenant',
      enum: ['admin', 'manager', 'member'],
      example: 'admin'
    }
  }
};

/**
 * 通用的租户相关响应 Schema
 */
export const tenantAwareResponseSchema = {
  type: 'object' as const,
  properties: {
    success: {
      type: 'boolean' as const,
      example: true
    },
    data: {
      type: 'object' as const,
      description: 'Response data (tenant-filtered)'
    },
    tenantContext: tenantContextSchema,
    pagination: {
      type: 'object' as const,
      properties: {
        page: { type: 'integer' as const, example: 1 },
        limit: { type: 'integer' as const, example: 10 },
        total: { type: 'integer' as const, example: 100 },
        totalPages: { type: 'integer' as const, example: 10 }
      }
    }
  }
};

/**
 * 为路由添加租户相关的 Schema
 */
export function addTenantSchemas(schema: any, options: {
  requiresTenant?: boolean;
  includeContext?: boolean;
  customErrors?: string[];
} = {}) {
  const { requiresTenant = false, includeContext = true, customErrors: _customErrors = [] } = options; // eslint-disable-line @typescript-eslint/no-unused-vars

  // 添加头部参数
  if (!schema.headers) {
    schema.headers = { type: 'object', properties: {} };
  }

  const headerSchema = requiresTenant ? requiredTenantHeaderSchema : tenantHeaderSchema;
  schema.headers.properties = {
    ...schema.headers.properties,
    ...headerSchema
  };

  // 添加错误响应
  if (!schema.response) {
    schema.response = {};
  }

  // 400 错误 - 租户相关错误
  schema.response[400] = tenantErrorResponseSchema;

  // 403 错误 - 租户访问被拒绝
  schema.response[403] = {
    ...tenantErrorResponseSchema,
    example: {
      success: false,
      error: {
        code: 'TENANT_ACCESS_DENIED',
        message: 'Access to tenant \'tenant-123\' is denied',
        timestamp: '2024-01-15T10:30:00Z',
        tenantId: 'tenant-123'
      },
      suggestions: [
        'Verify you have permission to access this tenant',
        'Check your user role and tenant associations'
      ]
    }
  };

  // 如果需要包含租户上下文，修改成功响应
  if (includeContext && schema.response[200]) {
    const originalResponse = schema.response[200];
    schema.response[200] = {
      type: 'object',
      properties: {
        ...originalResponse.properties,
        tenantContext: tenantContextSchema
      }
    };
  }

  return schema;
}

/**
 * 租户相关的标签定义
 */
export const tenantTags = [
  {
    name: 'Multi-Tenant',
    description: 'Operations that support multi-tenant architecture'
  },
  {
    name: 'Tenant-Required',
    description: 'Operations that require tenant context'
  },
  {
    name: 'Tenant-Aware',
    description: 'Operations that are tenant-aware but don\'t require tenant context'
  }
];

/**
 * 租户相关的安全定义
 */
export const tenantSecuritySchemes = {
  TenantHeader: {
    type: 'apiKey' as const,
    in: 'header' as const,
    name: 'X-Tenant-ID',
    description: 'Tenant identifier for multi-tenant operations'
  }
};

/**
 * 常用的租户相关 Schema 组合
 */
export const commonTenantSchemas = {
  // 产品相关 - 需要租户上下文
  productWithTenant: (baseSchema: any) => addTenantSchemas(baseSchema, {
    requiresTenant: true,
    includeContext: true
  }),

  // 搜索相关 - 租户感知但不强制要求
  searchWithTenant: (baseSchema: any) => addTenantSchemas(baseSchema, {
    requiresTenant: false,
    includeContext: true
  }),

  // 用户管理 - 需要租户上下文
  userManagementWithTenant: (baseSchema: any) => addTenantSchemas(baseSchema, {
    requiresTenant: true,
    includeContext: true,
    customErrors: ['CROSS_TENANT_ACCESS_DENIED']
  }),

  // 公共端点 - 可选租户上下文
  publicWithOptionalTenant: (baseSchema: any) => addTenantSchemas(baseSchema, {
    requiresTenant: false,
    includeContext: false
  })
};

/**
 * 生成租户相关的 OpenAPI 文档片段
 */
export function generateTenantDocumentation() {
  return {
    info: {
      title: 'Jiffoo Mall API - Multi-Tenant',
      description: `
# Multi-Tenant API Documentation

This API supports multi-tenant architecture. Most operations require or support tenant context.

## Tenant Context

Tenant context can be provided in several ways:
1. **X-Tenant-ID Header**: Include the tenant ID in the request header
2. **URL Parameter**: Some endpoints accept tenantId as a parameter
3. **Authentication**: Authenticated users have an associated tenant

## Tenant-Aware Operations

- **Tenant-Required**: These operations require tenant context and will return 400 if missing
- **Tenant-Aware**: These operations use tenant context if available but don't require it
- **Cross-Tenant**: These operations may access multiple tenants (admin only)

## Error Handling

All tenant-related errors follow a consistent format and include helpful suggestions.
      `,
      version: '1.0.0'
    },
    tags: tenantTags,
    components: {
      securitySchemes: {
        TenantHeader: {
          type: 'apiKey' as const,
          in: 'header' as const,
          name: 'X-Tenant-ID',
          description: 'Tenant identifier for multi-tenant operations'
        }
      },
      schemas: {
        TenantError: tenantErrorResponseSchema,
        TenantContext: tenantContextSchema,
        TenantAwareResponse: tenantAwareResponseSchema
      }
    }
  };
}
