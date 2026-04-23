/**
 * Authentication Helper for Tests
 * 
 * Provides utilities for:
 * - Creating test users
 * - Generating JWT tokens
 * - Creating authenticated requests
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getTestPrisma } from './db';
import { v4 as uuidv4 } from 'uuid';

// Test JWT secret - should match .env.test
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing';
const TEST_JWT_EXPIRES_IN = '7d';

export type TestUserRole =
  | 'USER'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'OWNER'
  | 'CATALOG_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'SUPPORT_AGENT'
  | 'ANALYST';

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string; // Plain text password for login tests
  hashedPassword: string;
  role: TestUserRole;
}

export interface CreateUserOptions {
  email?: string;
  username?: string;
  password?: string;
  role?: TestUserRole;
  emailVerified?: boolean;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(options: CreateUserOptions = {}): Promise<TestUser> {
  const prisma = getTestPrisma();
  const id = uuidv4();
  const plainPassword = options.password || 'Test123456!';

  const userData = {
    email: options.email || `test-${id}@example.com`,
    username: options.username || `testuser-${id.substring(0, 8)}`,
    password: plainPassword,
    role: options.role || 'USER',
  };

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      id,
      email: userData.email,
      username: userData.username,
      password: hashedPassword,
      role: userData.role,
      emailVerified: options.emailVerified !== undefined ? options.emailVerified : true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    password: plainPassword, // Return plain password for login tests
    hashedPassword: user.password,
    role: user.role as TestUser['role'],
  };
}

/**
 * Create an admin user
 */
export async function createAdminUser(options: Omit<CreateUserOptions, 'role'> = {}): Promise<TestUser> {
  return createTestUser({ ...options, role: 'ADMIN' });
}

// createSuperAdminUser removed - All privileged operations now use ADMIN role


/**
 * Sign a JWT token for a user
 */
export function signJwt(
  userOrId: Pick<TestUser, 'id' | 'email' | 'role'> | string,
  emailArg?: string,
  roleArg: TestUserRole = 'USER'
): string {
  const user =
    typeof userOrId === 'string'
      ? { id: userOrId, email: emailArg || '', role: roleArg }
      : userOrId;

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    TEST_JWT_SECRET,
    {
      expiresIn: TEST_JWT_EXPIRES_IN,
      issuer: 'jiffoo-mall',
    }
  );
}

/**
 * Sign an expired JWT token for testing
 */
export function signExpiredJwt(user: Pick<TestUser, 'id' | 'email' | 'role'>): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    TEST_JWT_SECRET,
    {
      expiresIn: '-1h', // Already expired
      issuer: 'jiffoo-mall',
    }
  );
}

/**
 * Sign a refresh token
 */
export function signRefreshToken(userId: string): string {
  return jwt.sign(
    {
      userId,
      type: 'refresh',
    },
    TEST_JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'jiffoo-mall',
    }
  );
}

/**
 * Verify a JWT token
 */
export function verifyJwt(token: string): any {
  return jwt.verify(token, TEST_JWT_SECRET);
}

/**
 * Create an invalid JWT token (signed with wrong secret)
 */
export function signInvalidJwt(user: Pick<TestUser, 'id' | 'email' | 'role'>): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    'wrong-secret-key',
    {
      expiresIn: '7d',
      issuer: 'jiffoo-mall',
    }
  );
}

/**
 * Get authorization header value
 */
export function getAuthHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

/**
 * Create user and get token in one call
 */
export async function createUserWithToken(options: CreateUserOptions = {}): Promise<{
  user: TestUser;
  token: string;
  authHeader: { authorization: string };
}> {
  const user = await createTestUser(options);
  const token = signJwt(user);
  return {
    user,
    token,
    authHeader: getAuthHeader(token),
  };
}

/**
 * Create admin and get token in one call
 */
export async function createAdminWithToken(options: Omit<CreateUserOptions, 'role'> = {}): Promise<{
  user: TestUser;
  token: string;
  authHeader: { authorization: string };
}> {
  return createUserWithToken({ ...options, role: 'ADMIN' });
}

export async function createStaffWithToken(
  role: Exclude<TestUserRole, 'USER'>,
  options: Omit<CreateUserOptions, 'role'> = {}
): Promise<{
  user: TestUser;
  token: string;
  authHeader: { authorization: string };
}> {
  return createUserWithToken({ ...options, role });
}

/**
 * Delete a test user
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const prisma = getTestPrisma();
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (e) {
    // Ignore if user doesn't exist
  }
}

/**
 * Delete all test users (users with test- prefix in email)
 * Also cleans up related records (orders, carts, etc.) to avoid FK constraints
 */
export async function deleteAllTestUsers(): Promise<void> {
  const prisma = getTestPrisma();

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'test-' } },
        { email: { endsWith: '@test.com' } },
      ],
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  const userIds = users.map(u => u.id);

  const carts = await prisma.cart.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const cartIds = carts.map(c => c.id);

  const orders = await prisma.order.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const orderIds = orders.map(o => o.id);

  const shipments = await prisma.shipment.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const shipmentIds = shipments.map(s => s.id);

  await prisma.$transaction([
    prisma.adminStaffAuditLog.deleteMany({
      where: {
        OR: [
          { staffUserId: { in: userIds } },
          { actorUserId: { in: userIds } },
        ],
      },
    }),
    prisma.adminMembership.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.shipmentItem.deleteMany({ where: { shipmentId: { in: shipmentIds } } }),
    prisma.shipment.deleteMany({ where: { id: { in: shipmentIds } } }),
    prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.inventoryReservation.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderShippingAddress.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.cartItem.deleteMany({ where: { cartId: { in: cartIds } } }),
    prisma.cart.deleteMany({ where: { id: { in: cartIds } } }),
    prisma.systemSettings.updateMany({
      where: { installedBy: { in: userIds } },
      data: { installedBy: null },
    }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}
