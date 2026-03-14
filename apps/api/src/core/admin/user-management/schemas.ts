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
} from '@/types/common-dto';

// ============================================================================
// User Schema
// ============================================================================

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'User ID' },
    email: { type: 'string', format: 'email', description: 'User email address' },
    username: { type: 'string', description: 'Username' },
    avatar: { type: 'string', nullable: true, description: 'Avatar URL' },
    role: { type: 'string', description: 'User role (admin, customer, etc.)' },
    isActive: { type: 'boolean', description: 'Whether user account is active' },
    createdAt: { type: 'string', format: 'date-time', description: 'Account creation time' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update time' },
    totalOrders: { type: 'integer', description: 'Total number of orders' },
    totalSpent: { type: 'number', description: 'Total amount spent' },
    lastLoginAt: { type: 'string', format: 'date-time', nullable: true, description: 'Last login time' },
  },
  required: ['id', 'email', 'username', 'role', 'createdAt', 'updatedAt'],
} as const;

const deleteUserResultSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string', description: 'Deleted user ID' },
    deleted: { type: 'boolean', description: 'Whether deletion succeeded' },
  },
  required: ['userId', 'deleted'],
} as const;

const resetPasswordResultSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string', description: 'User ID whose password was reset' },
    passwordReset: { type: 'boolean', description: 'Whether password reset succeeded' },
    resetAt: { type: 'string', format: 'date-time', description: 'Password reset completion time' },
  },
  required: ['userId', 'passwordReset', 'resetAt'],
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
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 10, minimum: 1, maximum: 100, description: 'Items per page' },
        search: { type: 'string', description: 'Search term for email or username' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(userSchema)),
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
    response: createTypedReadResponses(userSchema),
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
      properties: {
        email: { type: 'string', format: 'email', description: 'New email address' },
        username: { type: 'string', description: 'New username' },
        role: { type: 'string', description: 'New user role' },
        isActive: { type: 'boolean', description: 'Account active status' },
      },
    },
    response: createTypedUpdateResponses(userSchema),
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
    response: createTypedDeleteResponses(deleteUserResultSchema),
  },

  // POST /api/admin/users/:id/reset-password
  resetPassword: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'User ID' },
      },
    },
    body: {
      type: 'object',
      required: ['newPassword'],
      properties: {
        newPassword: { type: 'string', minLength: 6, description: 'New password (min 6 characters)' },
      },
    },
    response: createTypedUpdateResponses(resetPasswordResultSchema),
  },
} as const;
