/**
 * Test Database Utilities
 * 
 * Provides utilities for database seeding, cleanup, and transaction isolation.
 */

import { PrismaClient } from '@prisma/client';

// ============================================
// Types
// ============================================

export interface SeedOptions {
  tenantId?: number;
  userId?: string;
  withProducts?: boolean;
  withOrders?: boolean;
}

export interface CleanupOptions {
  tenantId?: number;
  preserveTestTenant?: boolean;
}

// ============================================
// Constants
// ============================================

export const TEST_TENANT_ID = 999;
export const TEST_USER_ID = 'test-user-001';

// ============================================
// Database Utilities
// ============================================

/**
 * Create a test Prisma client
 */
export function createTestPrisma(): PrismaClient {
  return new PrismaClient({
    log: process.env.DEBUG_PRISMA ? ['query', 'error'] : ['error'],
  });
}

/**
 * Seed test tenant
 */
export async function seedTestTenant(prisma: PrismaClient, tenantId = TEST_TENANT_ID) {
  const existingTenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  
  if (existingTenant) {
    return existingTenant;
  }
  
  return prisma.tenant.create({
    data: {
      id: tenantId,
      name: 'Test Tenant',
      slug: `test-tenant-${tenantId}`,
      domain: `test-${tenantId}.localhost`,
      status: 'ACTIVE',
      subscriptionTier: 'PROFESSIONAL',
    },
  });
}

/**
 * Seed test user
 */
export async function seedTestUser(
  prisma: PrismaClient,
  options: { userId?: string; tenantId?: number; role?: string } = {}
) {
  const { userId = TEST_USER_ID, tenantId = TEST_TENANT_ID, role = 'USER' } = options;
  
  // Ensure tenant exists
  await seedTestTenant(prisma, tenantId);
  
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });
  
  if (existingUser) {
    return existingUser;
  }
  
  return prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@test.com`,
      password: '$2a$10$testhashedpassword', // bcrypt hash of 'password123'
      name: 'Test User',
      role: role,
      tenantId: tenantId,
      status: 'ACTIVE',
    },
  });
}

/**
 * Seed test products
 */
export async function seedTestProducts(prisma: PrismaClient, tenantId = TEST_TENANT_ID, count = 3) {
  await seedTestTenant(prisma, tenantId);
  
  const products = [];
  for (let i = 0; i < count; i++) {
    products.push({
      name: `Test Product ${i + 1}`,
      slug: `test-product-${i + 1}-${tenantId}`,
      description: `Test product description ${i + 1}`,
      price: (i + 1) * 10.00,
      stock: 100,
      tenantId: tenantId,
      status: 'PUBLISHED',
    });
  }
  
  return prisma.product.createMany({ data: products });
}

/**
 * Cleanup test data for a tenant
 */
export async function cleanupTestData(prisma: PrismaClient, options: CleanupOptions = {}) {
  const { tenantId = TEST_TENANT_ID, preserveTestTenant = false } = options;
  
  // Delete in order of dependencies
  await prisma.orderItem.deleteMany({ where: { order: { tenantId } } });
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.cartItem.deleteMany({ where: { cart: { tenantId } } });
  await prisma.cart.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  
  if (!preserveTestTenant) {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  }
}

/**
 * Run a test in a transaction that gets rolled back
 */
export async function withTestTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const result = await fn(tx as PrismaClient);
    // Throw to rollback - this is intentional for test isolation
    throw new RollbackError(result);
  }).catch((error) => {
    if (error instanceof RollbackError) {
      return error.result as T;
    }
    throw error;
  });
}

class RollbackError extends Error {
  constructor(public result: unknown) {
    super('Transaction rollback');
  }
}

export default {
  createTestPrisma,
  seedTestTenant,
  seedTestUser,
  seedTestProducts,
  cleanupTestData,
  withTestTransaction,
  TEST_TENANT_ID,
  TEST_USER_ID,
};

