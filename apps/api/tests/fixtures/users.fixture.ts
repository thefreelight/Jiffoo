/**
 * User Test Fixtures
 * 
 * Provides consistent test user data.
 */

import { TEST_TENANT } from './tenants.fixture';

// ============================================
// Types
// ============================================

export interface TestUser {
  id: string;
  email: string;
  password: string;
  passwordHash: string;
  name: string;
  role: 'USER' | 'TENANT_ADMIN' | 'ADMIN' | 'SUPER_ADMIN';
  tenantId: number;
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
}

// ============================================
// Constants
// ============================================

// bcrypt hash of 'password123'
const DEFAULT_PASSWORD_HASH = '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u';
const DEFAULT_PASSWORD = 'password123';

// ============================================
// Test Users
// ============================================

export const TEST_USER: TestUser = {
  id: 'test-user-001',
  email: 'user@test.com',
  password: DEFAULT_PASSWORD,
  passwordHash: DEFAULT_PASSWORD_HASH,
  name: 'Test User',
  role: 'USER',
  tenantId: TEST_TENANT.id,
  status: 'ACTIVE',
};

export const TEST_ADMIN: TestUser = {
  id: 'test-admin-001',
  email: 'admin@test.com',
  password: DEFAULT_PASSWORD,
  passwordHash: DEFAULT_PASSWORD_HASH,
  name: 'Test Admin',
  role: 'TENANT_ADMIN',
  tenantId: TEST_TENANT.id,
  status: 'ACTIVE',
};

export const TEST_SUPER_ADMIN: TestUser = {
  id: 'test-super-admin-001',
  email: 'superadmin@test.com',
  password: DEFAULT_PASSWORD,
  passwordHash: DEFAULT_PASSWORD_HASH,
  name: 'Test Super Admin',
  role: 'SUPER_ADMIN',
  tenantId: TEST_TENANT.id,
  status: 'ACTIVE',
};

export const TEST_INACTIVE_USER: TestUser = {
  id: 'test-inactive-001',
  email: 'inactive@test.com',
  password: DEFAULT_PASSWORD,
  passwordHash: DEFAULT_PASSWORD_HASH,
  name: 'Inactive User',
  role: 'USER',
  tenantId: TEST_TENANT.id,
  status: 'INACTIVE',
};

export const TEST_BANNED_USER: TestUser = {
  id: 'test-banned-001',
  email: 'banned@test.com',
  password: DEFAULT_PASSWORD,
  passwordHash: DEFAULT_PASSWORD_HASH,
  name: 'Banned User',
  role: 'USER',
  tenantId: TEST_TENANT.id,
  status: 'BANNED',
};

// ============================================
// All Users
// ============================================

export const ALL_TEST_USERS: TestUser[] = [
  TEST_USER,
  TEST_ADMIN,
  TEST_SUPER_ADMIN,
  TEST_INACTIVE_USER,
  TEST_BANNED_USER,
];

// ============================================
// Factory Functions
// ============================================

/**
 * Create a custom test user
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id ?? `test-user-${Date.now()}`;
  return {
    ...TEST_USER,
    id,
    email: overrides.email ?? `${id}@test.com`,
    ...overrides,
  };
}

/**
 * Get user data for Prisma create
 */
export function getUserCreateData(user: TestUser) {
  return {
    id: user.id,
    email: user.email,
    password: user.passwordHash,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    status: user.status,
  };
}

export default {
  TEST_USER,
  TEST_ADMIN,
  TEST_SUPER_ADMIN,
  TEST_INACTIVE_USER,
  TEST_BANNED_USER,
  ALL_TEST_USERS,
  createTestUser,
  getUserCreateData,
  DEFAULT_PASSWORD,
};

