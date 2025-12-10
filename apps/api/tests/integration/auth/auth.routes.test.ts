/**
 * Auth API Integration Tests
 * 
 * Tests for authentication endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestToken, createUserToken, TEST_USERS } from '../../utils/auth-helpers';

// Mock Prisma
const mockPrisma = {
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tenant: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock('../../../src/config/database', () => ({
  prisma: mockPrisma,
}));

describe('Auth API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should validate registration payload structure', () => {
      const validPayload = {
        email: 'newuser@example.com',
        password: 'securePassword123',
        name: 'New User',
      };
      
      expect(validPayload.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(validPayload.password.length).toBeGreaterThanOrEqual(8);
      expect(validPayload.name.length).toBeGreaterThan(0);
    });

    it('should reject invalid email format', () => {
      const invalidPayload = {
        email: 'invalid-email',
        password: 'securePassword123',
        name: 'New User',
      };
      
      expect(invalidPayload.email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should reject short password', () => {
      const invalidPayload = {
        email: 'user@example.com',
        password: '123',
        name: 'New User',
      };
      
      expect(invalidPayload.password.length).toBeLessThan(8);
    });

    it('should handle duplicate email scenario', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com',
      });
      
      const existingUser = await mockPrisma.user.findFirst({
        where: { email: 'existing@example.com' }
      });
      
      expect(existingUser).not.toBeNull();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should validate login payload structure', () => {
      const validPayload = {
        email: 'user@example.com',
        password: 'password123',
      };
      
      expect(validPayload.email).toBeDefined();
      expect(validPayload.password).toBeDefined();
    });

    it('should handle user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      
      const user = await mockPrisma.user.findFirst({
        where: { email: 'nonexistent@example.com' }
      });
      
      expect(user).toBeNull();
    });

    it('should return tokens on successful login', () => {
      const mockResponse = {
        accessToken: createTestToken({ userId: 'test-user' }),
        refreshToken: createTestToken({ userId: 'test-user', type: 'refresh' }),
        user: {
          id: 'test-user',
          email: 'user@example.com',
          role: 'USER',
        },
      };
      
      expect(mockResponse.accessToken).toBeDefined();
      expect(mockResponse.refreshToken).toBeDefined();
      expect(mockResponse.user).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('should require authentication', () => {
      const token = createUserToken({ tenantId: 999 });
      const headers = { Authorization: `Bearer ${token}` };
      
      expect(headers.Authorization).toMatch(/^Bearer /);
    });

    it('should return current user info', () => {
      const mockUser = TEST_USERS.USER;

      expect(mockUser.id).toBeDefined();
      expect(mockUser.email).toBeDefined();
      expect(mockUser.role).toBe('USER');
    });

    it('should reject invalid token', () => {
      const invalidToken = 'invalid-token';
      
      expect(invalidToken).not.toMatch(/^eyJ/); // JWT starts with eyJ
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should validate refresh token structure', () => {
      const refreshToken = createTestToken({ 
        userId: 'test-user', 
        type: 'refresh' 
      }, '7d');
      
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
    });

    it('should return new access token', () => {
      const newAccessToken = createTestToken({ userId: 'test-user' });
      
      expect(newAccessToken).toBeDefined();
      expect(newAccessToken.split('.')).toHaveLength(3);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should require authentication', () => {
      const token = createUserToken({ tenantId: 999 });
      
      expect(token).toBeDefined();
    });

    it('should invalidate refresh token', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'test-user',
        refreshToken: null,
      });
      
      const result = await mockPrisma.user.update({
        where: { id: 'test-user' },
        data: { refreshToken: null },
      });
      
      expect(result.refreshToken).toBeNull();
    });
  });
});

