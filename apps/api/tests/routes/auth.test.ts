/**
 * Auth Endpoints Tests
 * 
 * Coverage:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - GET /api/auth/me
 * - POST /api/auth/refresh
 * - POST /api/auth/logout
 * - POST /api/auth/change-password
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createTestUser,
  signJwt,
  signExpiredJwt,
  signInvalidJwt,
  deleteAllTestUsers,
  verifyJwt,
} from '../helpers/auth';
import { v4 as uuidv4 } from 'uuid';

describe('Auth Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    beforeEach(async () => {
      await deleteAllTestUsers();
    });

    it('should register a new user successfully', async () => {
      const uniqueId = uuidv4().substring(0, 8);
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: `newuser-${uniqueId}@example.com`,
          username: `newuser-${uniqueId}`,
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('user');
      expect(body.data).toHaveProperty('token');
      expect(body.data).toHaveProperty('access_token');
      expect(body.data.user.email).toBe(`newuser-${uniqueId}@example.com`);
      expect(body.data.user.role).toBe('USER');

      // Verify token is valid
      const decoded = verifyJwt(body.data.token);
      expect(decoded.userId).toBe(body.data.user.id);
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: 'testuser',
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          username: 'testuser',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          username: 'testuser',
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          username: 'testuser',
          password: '123', // Too short
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for short username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          username: 'ab', // Too short (min 3)
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error for duplicate email', async () => {
      const uniqueId = uuidv4().substring(0, 8);
      const email = `duplicate-${uniqueId}@example.com`;

      // Register first user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          username: `user1-${uniqueId}`,
          password: 'Test123456!',
        },
      });

      // Try to register with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          username: `user2-${uniqueId}`,
          password: 'Test123456!',
        },
      });

      expect([400, 409, 500]).toContain(response.statusCode);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: 'login-test@example.com',
        password: 'TestPassword123!',
      });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('user');
      expect(body.data).toHaveProperty('token');
      expect(body.data).toHaveProperty('access_token');
      expect(body.data.user.email).toBe(testUser.email);
    });

    it('should return 401 for wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser.email,
          password: 'WrongPassword123!',
        },
      });

      expect([400, 401]).toContain(response.statusCode);
    });

    it('should return 401 for non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        },
      });

      expect([400, 401]).toContain(response.statusCode);
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          password: 'SomePassword123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let validToken: string;

    beforeAll(async () => {
      testUser = await createTestUser();
      validToken = signJwt(testUser);
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with expired token', async () => {
      const expiredToken = signExpiredJwt(testUser);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with wrong secret token', async () => {
      const invalidToken = signInvalidJwt(testUser);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${invalidToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user info with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('user');
      expect(body.data.user).toHaveProperty('id');
      expect(body.data.user).toHaveProperty('email');
      expect(body.data.user.id).toBe(testUser.id);
      expect(body.data.user.email).toBe(testUser.email);
    });

    it('should not return password in response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      const body = response.json();
      expect(body.data.user).not.toHaveProperty('password');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let validToken: string;

    beforeAll(async () => {
      testUser = await createTestUser();
      validToken = signJwt(testUser);
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return new token with valid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('token');

      // Verify new token is valid
      const decoded = verifyJwt(body.data.token);
      expect(decoded.userId).toBe(testUser.id);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      // Logout typically returns 200 regardless of auth state
      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/auth/change-password', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let validToken: string;

    beforeEach(async () => {
      testUser = await createTestUser({
        password: 'OldPassword123!',
      });
      validToken = signJwt(testUser);
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        payload: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing current password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: {
          newPassword: 'NewPassword123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing new password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: {
          currentPassword: 'OldPassword123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for short new password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: {
          currentPassword: 'OldPassword123!',
          newPassword: '123', // Too short
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should change password successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: {
          currentPassword: testUser.password,
          newPassword: 'NewPassword123!',
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify can login with new password
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser.email,
          password: 'NewPassword123!',
        },
      });

      expect(loginResponse.statusCode).toBe(200);
    });

    it('should reject wrong current password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: {
          currentPassword: 'WrongCurrentPassword!',
          newPassword: 'NewPassword123!',
        },
      });

      expect([400, 401]).toContain(response.statusCode);
    });
  });
});
