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

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string; // Plain text password for login tests
  hashedPassword: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
}

export interface CreateUserOptions {
  email?: string;
  username?: string;
  password?: string;
  role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
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

/**
 * Create a super admin user
 */
export async function createSuperAdminUser(options: Omit<CreateUserOptions, 'role'> = {}): Promise<TestUser> {
  return createTestUser({ ...options, role: 'SUPER_ADMIN' });
}

/**
 * Sign a JWT token for a user
 */
export function signJwt(user: Pick<TestUser, 'id' | 'email' | 'role'>): string {
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
 */
export async function deleteAllTestUsers(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.user.deleteMany({
    where: {
      email: { contains: 'test-' },
    },
  });
}
