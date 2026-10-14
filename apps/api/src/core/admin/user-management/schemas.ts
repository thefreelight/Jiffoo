/**
 * Admin User Management OpenAPI Schemas
 *
 * Detailed schema definitions for all admin user management endpoints
 */

import {
  createTypedCrudResponses,
  createTypedCreateResponses,
  createTypedReadResponses,
  createTypedUpdateResponses,
  createTypedDeleteResponses,
  createPageResultSchema,
  errorResponseSchema,
} from '@/types/common-dto';

// ============================================================================
// User Schema
// ============================================================================

const customerProperties = {
  id: { type: 'string' }, email: { type: 'string', format: 'email' }, username: { type: 'string' },
  avatar: { type: 'string', nullable: true }, locale: { type: 'string', nullable: true },
  isActive: { type: 'boolean' }, emailVerified: { type: 'boolean' },
  createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
  orderCount: { type: 'integer', minimum: 0 }, paidTotal: { type: 'number' }, currency: { type: 'string' },
  lastOrderAt: { type: 'string', format: 'date-time', nullable: true },
} as const;
const userSchema = { type: 'object', properties: customerProperties, required: ['id', 'email', 'username', 'isActive', 'createdAt', 'updatedAt'] } as const;
const detailSchema = { ...userSchema, properties: { ...customerProperties,
  recentOrders: { type: 'array', maxItems: 10, items: { type: 'object', required: ['id', 'status', 'paymentStatus', 'totalAmount', 'currency', 'createdAt'], properties: {
    id: { type: 'string' }, status: { type: 'string' }, paymentStatus: { type: 'string' }, totalAmount: { type: 'number' }, currency: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
  } } },
  latestShippingAddress: { type: 'object', nullable: true, required: ['orderId', 'recipientName', 'phone', 'street', 'street2', 'city', 'state', 'zipCode', 'country'], properties: {
    orderId: { type: 'string' }, recipientName: { type: 'string' }, phone: { type: 'string', nullable: true },
    street: { type: 'string' }, street2: { type: 'string', nullable: true }, city: { type: 'string' },
    state: { type: 'string', nullable: true }, zipCode: { type: 'string', nullable: true }, country: { type: 'string' },
  } },
}, required: [...userSchema.required, 'locale', 'emailVerified', 'orderCount', 'paidTotal', 'currency', 'lastOrderAt', 'recentOrders', 'latestShippingAddress'] } as const;
const customerFilterProperties = {
  search: { type: 'string' }, status: { type: 'string', enum: ['all', 'active', 'inactive'] },
  registered: { type: 'string', enum: ['all', 'today', 'last7', 'last30', 'custom'] },
  start: { type: 'string', format: 'date' }, end: { type: 'string', format: 'date' },
} as const;
const sortProperties = {
  sortBy: { type: 'string', enum: ['createdAt', 'orderCount', 'paidTotal', 'lastOrderAt'], default: 'createdAt' },
  sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
} as const;
const idParams = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', minLength: 1 } } } as const;
const errors = { 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema } as const;

const deleteUserResultSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string', description: 'Deleted user ID' },
    deleted: { type: 'boolean', description: 'Whether deletion succeeded' },
  },
  required: ['userId', 'deleted'],
} as const;


const userStatsSchema = {
  type: 'object',
  properties: {
    metrics: {
      type: 'object',
      properties: {
        totalUsers: { type: 'integer' },
        activeUsers: { type: 'integer' },
        inactiveUsers: { type: 'integer' },
        newThisMonth: { type: 'integer' },
        totalUsersTrend: { type: 'number' },
        activeUsersTrend: { type: 'number' },
        inactiveUsersTrend: { type: 'number' },
        newUsersTrend: { type: 'number' },
      },
      required: [
        'totalUsers',
        'activeUsers',
        'inactiveUsers',
        'newThisMonth',
        'totalUsersTrend',
        'activeUsersTrend',
        'inactiveUsersTrend',
        'newUsersTrend',
      ],
    },
  },
  required: ['metrics'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const adminUserSchemas = {
  // GET /api/admin/users/ (paginated)
  listUsers: {
    querystring: { type: 'object', additionalProperties: false, properties: {
      ...customerFilterProperties, ...sortProperties, page: { type: 'integer', default: 1, minimum: 1 },
      limit: { type: 'integer', enum: [20, 50, 100], default: 20 },
    } },
    response: { ...createTypedReadResponses({ ...createPageResultSchema(userSchema), properties: {
      ...createPageResultSchema(userSchema).properties,
      statusCounts: { type: 'object', required: ['all', 'active', 'inactive'], properties: { all: { type: 'integer' }, active: { type: 'integer' }, inactive: { type: 'integer' } } },
    }, required: [...createPageResultSchema(userSchema).required, 'statusCounts'] }), ...errors },
  },
  neighbors: {
    params: idParams,
    querystring: { type: 'object', additionalProperties: false, properties: { ...customerFilterProperties, ...sortProperties } },
    response: { ...createTypedReadResponses({ type: 'object', required: ['position', 'total', 'previousId', 'nextId'], properties: {
      position: { type: 'integer', nullable: true, minimum: 1 }, total: { type: 'integer', minimum: 0 },
      previousId: { type: 'string', nullable: true }, nextId: { type: 'string', nullable: true },
    } }), ...errors },
  },
  exportCustomers: {
    body: { type: 'object', additionalProperties: false, required: ['selection'], properties: {
      ...sortProperties,
      selection: { type: 'object', additionalProperties: false, required: ['mode'], properties: {
        mode: { type: 'string', enum: ['ids', 'filter'] },
        ids: { type: 'array', minItems: 1, maxItems: 100, uniqueItems: true, items: { type: 'string', minLength: 1 } },
        filters: { type: 'object', additionalProperties: false, properties: customerFilterProperties },
        excludedIds: { type: 'array', maxItems: 100, uniqueItems: true, items: { type: 'string', minLength: 1 } },
      }, oneOf: [
        { properties: { mode: { const: 'ids' } }, required: ['ids'], not: { anyOf: [{ required: ['filters'] }, { required: ['excludedIds'] }] } },
        { properties: { mode: { const: 'filter' } }, required: ['filters'], not: { required: ['ids'] } },
      ] },
    } },
    response: { 200: { description: 'UTF-8 CSV with BOM; timestamps use the store timezone', content: { 'text/csv': { schema: { type: 'string' } } } }, ...errors, 500: errorResponseSchema },
  },

  // GET /api/admin/users/stats
  getUserStats: {
    response: createTypedReadResponses(userStatsSchema),
  },

  // GET /api/admin/users/:id
  getUser: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'User ID' },
      },
    },
    response: { ...createTypedReadResponses(detailSchema), ...errors },
  },

  // POST /api/admin/users/
  createUser: {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', description: 'User email address' },
        password: { type: 'string', minLength: 6, description: 'User password (min 6 characters)' },
        username: { type: 'string', description: 'Username' },
        role: { type: 'string', description: 'User role (admin, customer, etc.)' },
      },
    },
    response: createTypedCreateResponses(userSchema),
  },

  // PUT /api/admin/users/:id
  updateUser: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'User ID' },
      },
    },
    body: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      properties: {
        username: { type: 'string', minLength: 1, maxLength: 100, description: 'New username' },
        role: { type: 'string', description: 'New user role' },
        isActive: { type: 'boolean', description: 'Account active status' },
      },
    },
    response: { ...createTypedUpdateResponses(userSchema), ...errors, 409: errorResponseSchema },
  },

  // DELETE /api/admin/users/:id
  deleteUser: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'User ID to delete' },
      },
    },
    response: { ...createTypedDeleteResponses(deleteUserResultSchema), ...errors, 409: errorResponseSchema },
  },

} as const;
