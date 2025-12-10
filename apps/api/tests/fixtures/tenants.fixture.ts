/**
 * Tenant Test Fixtures
 * 
 * Provides consistent test tenant data.
 */

// ============================================
// Types
// ============================================

export interface TestTenant {
  id: number;
  name: string;
  slug: string;
  domain: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  subscriptionTier: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  settings?: Record<string, unknown>;
}

// ============================================
// Test Tenants
// ============================================

export const TEST_TENANT: TestTenant = {
  id: 999,
  name: 'Test Tenant',
  slug: 'test-tenant',
  domain: 'test.localhost',
  status: 'ACTIVE',
  subscriptionTier: 'PROFESSIONAL',
};

export const TEST_TENANT_FREE: TestTenant = {
  id: 998,
  name: 'Free Tier Tenant',
  slug: 'free-tenant',
  domain: 'free.localhost',
  status: 'ACTIVE',
  subscriptionTier: 'FREE',
};

export const TEST_TENANT_ENTERPRISE: TestTenant = {
  id: 997,
  name: 'Enterprise Tenant',
  slug: 'enterprise-tenant',
  domain: 'enterprise.localhost',
  status: 'ACTIVE',
  subscriptionTier: 'ENTERPRISE',
};

export const TEST_TENANT_INACTIVE: TestTenant = {
  id: 996,
  name: 'Inactive Tenant',
  slug: 'inactive-tenant',
  domain: 'inactive.localhost',
  status: 'INACTIVE',
  subscriptionTier: 'BASIC',
};

export const TEST_TENANT_SUSPENDED: TestTenant = {
  id: 995,
  name: 'Suspended Tenant',
  slug: 'suspended-tenant',
  domain: 'suspended.localhost',
  status: 'SUSPENDED',
  subscriptionTier: 'PROFESSIONAL',
};

// ============================================
// All Tenants
// ============================================

export const ALL_TEST_TENANTS: TestTenant[] = [
  TEST_TENANT,
  TEST_TENANT_FREE,
  TEST_TENANT_ENTERPRISE,
  TEST_TENANT_INACTIVE,
  TEST_TENANT_SUSPENDED,
];

// ============================================
// Factory Functions
// ============================================

/**
 * Create a custom test tenant
 */
export function createTestTenant(overrides: Partial<TestTenant> = {}): TestTenant {
  return {
    ...TEST_TENANT,
    id: overrides.id ?? Math.floor(Math.random() * 1000) + 1000,
    slug: overrides.slug ?? `test-tenant-${Date.now()}`,
    domain: overrides.domain ?? `test-${Date.now()}.localhost`,
    ...overrides,
  };
}

export default {
  TEST_TENANT,
  TEST_TENANT_FREE,
  TEST_TENANT_ENTERPRISE,
  TEST_TENANT_INACTIVE,
  TEST_TENANT_SUSPENDED,
  ALL_TEST_TENANTS,
  createTestTenant,
};

