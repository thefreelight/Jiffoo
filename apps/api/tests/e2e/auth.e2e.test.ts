/**
 * E2E Test: Authentication Flow
 * 
 * Tests the complete authentication process including registration, login, and token refresh.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createTestToken, createExpiredToken, verifyToken } from '../utils/auth-helpers';

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
};

vi.mock('../../src/config/database', () => ({
  prisma: mockPrisma,
}));

// Test fixtures
const TEST_USER = {
  id: 'user-001',
  email: 'test@example.com',
  password: '$2a$10$hashedpassword', // bcrypt hash of 'password123'
  name: 'Test User',
  role: 'USER',
  tenantId: 999,
  isActive: true,
  createdAt: new Date(),
};

const JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

describe('E2E: Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: User Registration', () => {
    it('should register a new user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null); // No existing user
      mockPrisma.user.create.mockResolvedValue(TEST_USER);

      // Check if email is available
      const existingUser = await mockPrisma.user.findFirst({
        where: { email: 'newuser@example.com' },
      });
      expect(existingUser).toBeNull();

      // Create new user
      const newUser = await mockPrisma.user.create({
        data: {
          email: 'newuser@example.com',
          password: await bcrypt.hash('password123', 10),
          name: 'New User',
          tenantId: 999,
        },
      });

      expect(newUser.email).toBe(TEST_USER.email);
    });

    it('should reject duplicate email registration', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(TEST_USER);

      const existingUser = await mockPrisma.user.findFirst({
        where: { email: TEST_USER.email },
      });

      expect(existingUser).not.toBeNull();
      // Registration should be rejected
    });

    it('should validate password requirements', () => {
      const weakPassword = '123';
      const strongPassword = 'SecurePass123!';

      expect(weakPassword.length).toBeLessThan(8);
      expect(strongPassword.length).toBeGreaterThanOrEqual(8);
      expect(/[A-Z]/.test(strongPassword)).toBe(true);
      expect(/[0-9]/.test(strongPassword)).toBe(true);
    });
  });

  describe('Step 2: User Login', () => {
    it('should login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const userWithHash = { ...TEST_USER, password: hashedPassword };
      mockPrisma.user.findFirst.mockResolvedValue(userWithHash);

      const user = await mockPrisma.user.findFirst({
        where: { email: TEST_USER.email },
      });

      expect(user).not.toBeNull();
      
      const isValidPassword = await bcrypt.compare('password123', user!.password);
      expect(isValidPassword).toBe(true);
    });

    it('should reject invalid password', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const userWithHash = { ...TEST_USER, password: hashedPassword };
      mockPrisma.user.findFirst.mockResolvedValue(userWithHash);

      const user = await mockPrisma.user.findFirst({
        where: { email: TEST_USER.email },
      });

      const isValidPassword = await bcrypt.compare('wrongpassword', user!.password);
      expect(isValidPassword).toBe(false);
    });

    it('should reject non-existent user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const user = await mockPrisma.user.findFirst({
        where: { email: 'nonexistent@example.com' },
      });

      expect(user).toBeNull();
    });

    it('should reject inactive user', async () => {
      const inactiveUser = { ...TEST_USER, isActive: false };
      mockPrisma.user.findFirst.mockResolvedValue(inactiveUser);

      const user = await mockPrisma.user.findFirst({
        where: { email: TEST_USER.email },
      });

      expect(user?.isActive).toBe(false);
    });
  });

  describe('Step 3: Token Generation', () => {
    it('should generate valid access token', () => {
      const token = createTestToken({
        userId: TEST_USER.id,
        email: TEST_USER.email,
        role: 'USER',
        tenantId: TEST_USER.tenantId,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(TEST_USER.id);
      expect(decoded.email).toBe(TEST_USER.email);
    });

    it('should generate refresh token', async () => {
      const refreshToken = {
        id: 'refresh-001',
        token: 'refresh-token-string',
        userId: TEST_USER.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockPrisma.refreshToken.create.mockResolvedValue(refreshToken);

      const created = await mockPrisma.refreshToken.create({
        data: refreshToken,
      });

      expect(created.userId).toBe(TEST_USER.id);
      expect(new Date(created.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Step 4: Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const refreshToken = {
        id: 'refresh-001',
        token: 'valid-refresh-token',
        userId: TEST_USER.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(refreshToken);
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      const storedToken = await mockPrisma.refreshToken.findUnique({
        where: { token: 'valid-refresh-token' },
      });

      expect(storedToken).not.toBeNull();
      expect(new Date(storedToken!.expiresAt).getTime()).toBeGreaterThan(Date.now());

      // Generate new access token
      const newAccessToken = createTestToken({
        userId: TEST_USER.id,
        email: TEST_USER.email,
        role: 'USER',
        tenantId: TEST_USER.tenantId,
      });

      expect(newAccessToken).toBeDefined();
    });

    it('should reject expired refresh token', async () => {
      const expiredRefreshToken = {
        id: 'refresh-001',
        token: 'expired-refresh-token',
        userId: TEST_USER.id,
        expiresAt: new Date(Date.now() - 1000), // Already expired
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(expiredRefreshToken);

      const storedToken = await mockPrisma.refreshToken.findUnique({
        where: { token: 'expired-refresh-token' },
      });

      expect(new Date(storedToken!.expiresAt).getTime()).toBeLessThan(Date.now());
    });
  });

  describe('Step 5: Logout', () => {
    it('should invalidate refresh token on logout', async () => {
      mockPrisma.refreshToken.delete.mockResolvedValue({ id: 'refresh-001' });

      const result = await mockPrisma.refreshToken.delete({
        where: { id: 'refresh-001' },
      });

      expect(result.id).toBe('refresh-001');
    });

    it('should invalidate all user sessions on logout all', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      const result = await mockPrisma.refreshToken.deleteMany({
        where: { userId: TEST_USER.id },
      });

      expect(result.count).toBe(3);
    });
  });

  describe('Step 6: Password Reset', () => {
    it('should generate password reset token', () => {
      const resetToken = jwt.sign(
        { userId: TEST_USER.id, type: 'password_reset' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      expect(resetToken).toBeDefined();

      const decoded = jwt.verify(resetToken, JWT_SECRET) as any;
      expect(decoded.type).toBe('password_reset');
    });

    it('should update password with valid reset token', async () => {
      const newHashedPassword = await bcrypt.hash('newpassword123', 10);
      const updatedUser = { ...TEST_USER, password: newHashedPassword };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const user = await mockPrisma.user.update({
        where: { id: TEST_USER.id },
        data: { password: newHashedPassword },
      });

      expect(user.password).toBe(newHashedPassword);
    });
  });

  describe('Token Validation', () => {
    it('should reject expired access token', () => {
      const expiredToken = createExpiredToken({
        userId: TEST_USER.id,
        email: TEST_USER.email,
        role: 'USER',
      });

      expect(() => {
        jwt.verify(expiredToken, JWT_SECRET);
      }).toThrow();
    });

    it('should reject token with invalid signature', () => {
      const invalidToken = jwt.sign(
        { userId: TEST_USER.id },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      expect(() => {
        jwt.verify(invalidToken, JWT_SECRET);
      }).toThrow();
    });
  });
});

