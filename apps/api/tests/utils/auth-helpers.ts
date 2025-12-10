/**
 * Authentication Test Helpers
 * 
 * Provides utilities for generating test JWT tokens with different roles.
 */

import jwt from 'jsonwebtoken';

// ============================================
// Types
// ============================================

export type UserRole = 'USER' | 'TENANT_ADMIN' | 'ADMIN' | 'SUPER_ADMIN';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId?: number;
  type?: 'access' | 'refresh';
}

export interface TestUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId: number;
}

// ============================================
// Constants
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
const JWT_EXPIRES_IN = '1d';

// Test user fixtures
export const TEST_USERS: Record<string, TestUser> = {
  USER: {
    id: 'test-user-001',
    email: 'user@test.com',
    role: 'USER',
    tenantId: 999,
  },
  TENANT_ADMIN: {
    id: 'test-admin-001',
    email: 'admin@test.com',
    role: 'TENANT_ADMIN',
    tenantId: 999,
  },
  ADMIN: {
    id: 'test-admin-002',
    email: 'admin2@test.com',
    role: 'ADMIN',
    tenantId: 999,
  },
  SUPER_ADMIN: {
    id: 'test-super-admin-001',
    email: 'superadmin@test.com',
    role: 'SUPER_ADMIN',
    tenantId: 999,
  },
};

// ============================================
// Token Generation
// ============================================

/**
 * Create a JWT token with custom payload
 */
export function createTestToken(payload: Partial<TokenPayload>): string {
  const fullPayload: TokenPayload = {
    userId: payload.userId || 'test-user-001',
    email: payload.email || 'test@test.com',
    role: payload.role || 'USER',
    tenantId: payload.tenantId ?? 999,
    type: payload.type || 'access',
  };
  
  return jwt.sign(fullPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'jiffoo-mall-test',
  });
}

/**
 * Create a token for a regular user
 */
export function createUserToken(tenantId = 999): string {
  return createTestToken({
    ...TEST_USERS.USER,
    tenantId,
  });
}

/**
 * Create a token for a tenant admin
 */
export function createAdminToken(tenantId = 999): string {
  return createTestToken({
    ...TEST_USERS.TENANT_ADMIN,
    tenantId,
  });
}

/**
 * Create a token for a super admin
 */
export function createSuperAdminToken(): string {
  return createTestToken(TEST_USERS.SUPER_ADMIN);
}

/**
 * Create a refresh token
 */
export function createRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Create an expired token for testing
 */
export function createExpiredToken(payload: Partial<TokenPayload> = {}): string {
  const fullPayload: TokenPayload = {
    userId: payload.userId || 'test-user-001',
    email: payload.email || 'test@test.com',
    role: payload.role || 'USER',
    tenantId: payload.tenantId ?? 999,
  };
  
  return jwt.sign(fullPayload, JWT_SECRET, {
    expiresIn: '-1h', // Already expired
    issuer: 'jiffoo-mall-test',
  });
}

/**
 * Create an invalid token (signed with wrong secret)
 */
export function createInvalidToken(): string {
  return jwt.sign(
    { userId: 'test-user', email: 'test@test.com', role: 'USER' },
    'wrong-secret',
    { expiresIn: '1d' }
  );
}

/**
 * Verify a token
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

/**
 * Get authorization header value
 */
export function getAuthHeader(token: string): string {
  return `Bearer ${token}`;
}

