/**
 * Auth Helpers Unit Tests
 * 
 * Tests for JWT token generation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  createTestToken,
  createUserToken,
  createAdminToken,
  createSuperAdminToken,
  createExpiredToken,
  createInvalidToken,
  verifyToken,
  getAuthHeader,
  TEST_USERS,
} from '../utils/auth-helpers';

describe('Auth Helpers', () => {
  describe('createTestToken', () => {
    it('should create a valid JWT token with default values', () => {
      const token = createTestToken({});
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include custom payload values', () => {
      const token = createTestToken({
        userId: 'custom-user',
        email: 'custom@test.com',
        role: 'ADMIN',
        tenantId: 123,
      });
      
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe('custom-user');
      expect(decoded.email).toBe('custom@test.com');
      expect(decoded.role).toBe('ADMIN');
      expect(decoded.tenantId).toBe(123);
    });
  });

  describe('createUserToken', () => {
    it('should create a token with USER role', () => {
      const token = createUserToken();
      const decoded = verifyToken(token);
      
      expect(decoded.role).toBe('USER');
      expect(decoded.tenantId).toBe(999);
    });

    it('should accept custom tenantId', () => {
      const token = createUserToken(123);
      const decoded = verifyToken(token);
      
      expect(decoded.tenantId).toBe(123);
    });
  });

  describe('createAdminToken', () => {
    it('should create a token with TENANT_ADMIN role', () => {
      const token = createAdminToken();
      const decoded = verifyToken(token);
      
      expect(decoded.role).toBe('TENANT_ADMIN');
    });
  });

  describe('createSuperAdminToken', () => {
    it('should create a token with SUPER_ADMIN role', () => {
      const token = createSuperAdminToken();
      const decoded = verifyToken(token);
      
      expect(decoded.role).toBe('SUPER_ADMIN');
    });
  });

  describe('createExpiredToken', () => {
    it('should create an expired token that fails verification', () => {
      const token = createExpiredToken();
      
      expect(() => verifyToken(token)).toThrow();
    });
  });

  describe('createInvalidToken', () => {
    it('should create a token that fails signature verification', () => {
      const token = createInvalidToken();
      
      expect(() => verifyToken(token)).toThrow();
    });
  });

  describe('getAuthHeader', () => {
    it('should format token as Bearer header', () => {
      const token = 'test-token-123';
      const header = getAuthHeader(token);
      
      expect(header).toBe('Bearer test-token-123');
    });
  });

  describe('TEST_USERS', () => {
    it('should have predefined test users', () => {
      expect(TEST_USERS.USER).toBeDefined();
      expect(TEST_USERS.TENANT_ADMIN).toBeDefined();
      expect(TEST_USERS.SUPER_ADMIN).toBeDefined();
    });

    it('should have correct roles for each user type', () => {
      expect(TEST_USERS.USER.role).toBe('USER');
      expect(TEST_USERS.TENANT_ADMIN.role).toBe('TENANT_ADMIN');
      expect(TEST_USERS.SUPER_ADMIN.role).toBe('SUPER_ADMIN');
    });
  });
});

