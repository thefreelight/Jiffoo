/**
 * Auth Endpoints Tests
 * 
 * Coverage:
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/login
 * - GET /api/v1/auth/me
 * - POST /api/v1/auth/refresh
 * - POST /api/v1/auth/logout
 * - POST /api/v1/auth/change-password
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createTestUser,
  signJwt,
  signExpiredJwt,
  signInvalidJwt,
  signRefreshToken,
  deleteAllTestUsers,
  verifyJwt,
} from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { v4 as uuidv4 } from 'uuid';

describe('Auth Endpoints', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    app = await createTestApp({ enableSwagger: true });
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    beforeEach(async () => {
      await deleteAllTestUsers();
    });

    it('should register a new user successfully', async () => {
      const uniqueId = uuidv4().substring(0, 8);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
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
      expect(body.data.user.emailVerified).toBe(false);

      // Verify token is valid
      const decoded = verifyJwt(body.data.token);
      expect(decoded.userId).toBe(body.data.user.id);
    });

    it('should allow unverified customers to login and logout after registration', async () => {
        const uniqueId = uuidv4().substring(0, 8);
        const email = `mvp-register-${uniqueId}@example.com`;
        const password = 'Test123456!';

        const register = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          payload: {
            email,
            username: `mvp-register-${uniqueId}`,
            password,
          },
        });

        expect(register.statusCode).toBe(201);
        const registerBody = register.json();
        expect(registerBody.data.user.emailVerified).toBe(false);
        expect(await prisma.user.findUnique({ where: { email }, select: { emailVerified: true } }))
          .toMatchObject({ emailVerified: false });

        const login = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: {
            email,
            password,
          },
        });

        expect(login.statusCode).toBe(200);
        const loginBody = login.json();
        expect(loginBody.data.user.email).toBe(email);
        expect(loginBody.data.token).toBeTruthy();

        const logout = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          headers: {
            authorization: `Bearer ${loginBody.data.token}`,
          },
        });

        expect(logout.statusCode).toBe(200);
        expect(logout.json().data.loggedOut).toBe(true);
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
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
        url: '/api/v1/auth/register',
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
        url: '/api/v1/auth/register',
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
        url: '/api/v1/auth/register',
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
        url: '/api/v1/auth/register',
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
        url: '/api/v1/auth/register',
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
        url: '/api/v1/auth/register',
        payload: {
          email,
          username: `user1-${uniqueId}`,
          password: 'Test123456!',
        },
      });

      // Try to register with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          username: `user2-${uniqueId}`,
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
        },
      });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeAll(async () => {
      const uniqueId = uuidv4().substring(0, 8);
      testUser = await createTestUser({
        email: `test-login-${uniqueId}@example.com`,
        password: 'TestPassword123!',
      });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
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

    it('should login successfully with a username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: testUser.username,
          password: testUser.password,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.user.username).toBe(testUser.username);
    });

    it('should allow an unverified account to log in', async () => {
      const unverifiedUser = await createTestUser({
        email: `unverified-${uuidv4().substring(0, 8)}@example.com`,
        password: 'TestPassword123!',
        emailVerified: false,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: unverifiedUser.email,
          password: unverifiedUser.password,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data.user.emailVerified).toBe(false);
      expect(body.data.access_token).toBeTruthy();
    });

    it('should return 401 for wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
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
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        },
      });

      expect([400, 401]).toContain(response.statusCode);
    });

    it('K: returns the generic login failure for an inactive account with a wrong password', async () => {
      const inactiveUser = await createTestUser({
        email: `test-inactive-${uuidv4().substring(0, 8)}@example.com`,
        password: 'CorrectPassword123!',
      });
      await prisma.user.update({ where: { id: inactiveUser.id }, data: { isActive: false } });

      const wrongPassword = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: inactiveUser.email, password: 'WrongPassword123!' },
      });
      const unknownEmail = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `test-unknown-${uuidv4().substring(0, 8)}@example.com`, password: 'WrongPassword123!' },
      });
      expect(wrongPassword.statusCode).toBe(401);
      expect(wrongPassword.statusCode).toBe(unknownEmail.statusCode);
      expect(wrongPassword.json()).toEqual(unknownEmail.json());
      expect(wrongPassword.json()).toMatchObject({
        success: false,
        error: { code: 'LOGIN_FAILED', message: 'Invalid email or password' },
      });

      const correctPassword = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: inactiveUser.email, password: inactiveUser.password },
      });
      expect(correctPassword.statusCode).toBe(403);
      expect(correctPassword.json()).toMatchObject({
        success: false,
        error: { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' },
      });
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          password: 'SomePassword123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let validToken: string;

    beforeAll(async () => {
      testUser = await createTestUser();
      validToken = signJwt(testUser);
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
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
        url: '/api/v1/auth/me',
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
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${invalidToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user info with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      // API returns user data directly in data, not nested in data.user
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('email');
      expect(body.data.id).toBe(testUser.id);
      expect(body.data.email).toBe(testUser.email);
      expect(body.data).not.toHaveProperty('requiresPasswordRotation');
    });

    it('should not return password in response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      const body = response.json();
      // API returns user data directly in data, not nested in data.user
      expect(body.data).not.toHaveProperty('password');
    });
  });

  describe('GET /api/v1/auth/bootstrap-status', () => {
    it('should return 404 and be absent from the runtime OpenAPI spec', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/bootstrap-status',
      });
      expect(response.statusCode).toBe(404);
      expect(app.swagger().paths['/api/v1/auth/bootstrap-status']).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let validRefreshToken: string;

    beforeAll(async () => {
      testUser = await createTestUser();
      validRefreshToken = signRefreshToken(testUser.id);
    });

    it('should return 400 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return new token with valid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refresh_token: validRefreshToken,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('access_token');
      expect(body.data).toHaveProperty('refresh_token');
      expect(body.data).toHaveProperty('user');

      // Verify new token is valid
      const decoded = verifyJwt(body.data.access_token);
      expect(decoded.userId).toBe(testUser.id);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      // Logout typically returns 200 regardless of auth state
      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
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
        url: '/api/v1/auth/change-password',
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
        url: '/api/v1/auth/change-password',
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
        url: '/api/v1/auth/change-password',
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
        url: '/api/v1/auth/change-password',
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
        url: '/api/v1/auth/change-password',
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
        url: '/api/v1/auth/login',
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
        url: '/api/v1/auth/change-password',
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
