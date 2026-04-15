/**
 * Auth Module OpenAPI Schemas
 *
 * Detailed schema definitions for all auth endpoints to ensure proper OpenAPI typing
 */

import {
  createTypedCrudResponses,
  createTypedCreateResponses,
  createTypedReadResponses,
  createTypedUpdateResponses,
} from '@/types/common-dto';

// ============================================================================
// User Profile Response
// ============================================================================

const userProfileSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'User ID' },
    email: { type: 'string', format: 'email', description: 'User email address' },
    username: { type: 'string', description: 'Username' },
    avatar: { type: 'string', description: 'Avatar URL', nullable: true },
    role: { type: 'string', description: 'User role (admin, customer, etc.)' },
    emailVerified: { type: 'boolean', description: 'Whether email has been verified' },
  },
  required: ['id', 'email', 'username', 'role'],
} as const;

// ============================================================================
// Auth Response (OAuth2-like + user + compatibility fields)
// ============================================================================

const authResponseSchema = {
  type: 'object',
  properties: {
    user: userProfileSchema,
    access_token: { type: 'string', description: 'JWT access token' },
    token_type: { type: 'string', enum: ['Bearer'], description: 'Token type' },
    expires_in: { type: 'number', description: 'Access token expiration time in seconds' },
    refresh_token: { type: 'string', description: 'JWT refresh token for obtaining new access tokens' },
    token: { type: 'string', description: 'Compatibility access token field (same as access_token)' },
  },
  required: ['user', 'access_token', 'token_type', 'expires_in', 'refresh_token', 'token'],
} as const;

const logoutResultSchema = {
  type: 'object',
  properties: {
    loggedOut: { type: 'boolean', description: 'Whether logout completed successfully' },
    timestamp: { type: 'string', format: 'date-time', description: 'Logout completion time' },
  },
  required: ['loggedOut', 'timestamp'],
} as const;

const changePasswordResultSchema = {
  type: 'object',
  properties: {
    passwordChanged: { type: 'boolean', description: 'Whether password was changed successfully' },
    changedAt: { type: 'string', format: 'date-time', description: 'Password change time' },
  },
  required: ['passwordChanged', 'changedAt'],
} as const;

const loginConfigSchema = {
  type: 'object',
  properties: {
    demoModeEnabled: { type: 'boolean', description: 'Whether demo mode is enabled for this instance' },
    demoCredentials: {
      type: 'object',
      nullable: true,
      properties: {
        email: { type: 'string', format: 'email', description: 'Demo admin email' },
        password: { type: 'string', description: 'Demo admin password' },
      },
      required: ['email', 'password'],
    },
  },
  required: ['demoModeEnabled', 'demoCredentials'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const authSchemas = {
  // POST /api/auth/register
  register: {
    body: {
      type: 'object',
      required: ['email', 'username', 'password'],
      properties: {
        email: { type: 'string', format: 'email', description: 'User email address' },
        username: { type: 'string', minLength: 3, description: 'Username (min 3 characters)' },
        password: { type: 'string', minLength: 6, description: 'Password (min 6 characters)' },
        referralCode: { type: 'string', description: 'Optional referral code' },
      },
    },
    response: createTypedCreateResponses(authResponseSchema),
  },

  // POST /api/auth/login
  login: {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', description: 'User email address' },
        password: { type: 'string', description: 'User password' },
      },
    },
    response: createTypedCrudResponses(authResponseSchema),
  },

  // GET /api/auth/login-config
  loginConfig: {
    response: createTypedReadResponses(loginConfigSchema),
  },

  // GET /api/auth/me
  me: {
    response: createTypedReadResponses(userProfileSchema),
  },

  // POST /api/auth/refresh
  refresh: {
    body: {
      type: 'object',
      required: ['refresh_token'],
      properties: {
        refresh_token: { type: 'string', description: 'Valid refresh token' },
      },
    },
    response: createTypedCrudResponses(authResponseSchema),
  },

  // POST /api/auth/logout
  logout: {
    response: createTypedReadResponses(logoutResultSchema),
  },

  // POST /api/auth/change-password
  changePassword: {
    body: {
      type: 'object',
      required: ['currentPassword', 'newPassword'],
      properties: {
        currentPassword: { type: 'string', description: 'Current password for verification' },
        newPassword: { type: 'string', minLength: 6, description: 'New password (min 6 characters)' },
      },
    },
    response: createTypedUpdateResponses(changePasswordResultSchema),
  },
} as const;
