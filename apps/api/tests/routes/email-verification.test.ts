/**
 * Email Verification Endpoints Tests
 *
 * Coverage:
 * - GET /api/auth/verify-email?token=xxx
 * - POST /api/auth/resend-verification
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createTestUser,
  deleteAllTestUsers,
} from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

describe('Email Verification Endpoints', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('GET /api/auth/verify-email', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let validToken: string;
    let expiredToken: string;

    beforeEach(async () => {
      await deleteAllTestUsers();

      // Create a test user with a verification token
      testUser = await createTestUser({
        email: `verify-test-${uuidv4().substring(0, 8)}@example.com`,
      });

      // Generate valid verification token
      validToken = crypto.randomBytes(32).toString('base64url');
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24); // 24 hours from now

      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          verificationToken: validToken,
          verificationTokenExpiry: expiry,
          emailVerified: false,
        },
      });

      // Generate expired token
      expiredToken = crypto.randomBytes(32).toString('base64url');
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1); // 1 hour ago

      // We'll create a separate user for expired token test
    });

    it('should verify email successfully with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/auth/verify-email?token=${validToken}`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'Email verified successfully');

      // Verify user is marked as verified in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.emailVerified).toBe(true);
      expect(updatedUser?.verificationToken).toBeNull();
      expect(updatedUser?.verificationTokenExpiry).toBeNull();
    });

    it('should return 400 for missing token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/verify-email',
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.error).toHaveProperty('code', 'TOKEN_REQUIRED');
    });

    it('should return 400 for empty token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/verify-email?token=',
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
    });

    it('should return 400 for invalid token', async () => {
      const invalidToken = 'invalid-token-that-does-not-exist';

      const response = await app.inject({
        method: 'GET',
        url: `/api/auth/verify-email?token=${invalidToken}`,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.error).toHaveProperty('code', 'VERIFICATION_FAILED');
      expect(body.error.message).toContain('Invalid verification token');
    });

    it('should return 400 for expired token', async () => {
      // Create a user with an expired token
      const expiredUser = await createTestUser({
        email: `expired-${uuidv4().substring(0, 8)}@example.com`,
      });

      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1); // 1 hour ago

      await prisma.user.update({
        where: { id: expiredUser.id },
        data: {
          verificationToken: expiredToken,
          verificationTokenExpiry: expiredDate,
          emailVerified: false,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/auth/verify-email?token=${expiredToken}`,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.error).toHaveProperty('code', 'VERIFICATION_FAILED');
      expect(body.error.message).toContain('expired');
    });

    it('should return 400 when email is already verified', async () => {
      // First verification (should succeed)
      await app.inject({
        method: 'GET',
        url: `/api/auth/verify-email?token=${validToken}`,
      });

      // Second verification attempt (should fail)
      const response = await app.inject({
        method: 'GET',
        url: `/api/auth/verify-email?token=${validToken}`,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.error.message).toContain('Invalid verification token');
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    let unverifiedUser: Awaited<ReturnType<typeof createTestUser>>;
    let verifiedUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
      await deleteAllTestUsers();

      // Create unverified user
      unverifiedUser = await createTestUser({
        email: `unverified-${uuidv4().substring(0, 8)}@example.com`,
      });

      await prisma.user.update({
        where: { id: unverifiedUser.id },
        data: {
          emailVerified: false,
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      });

      // Create verified user
      verifiedUser = await createTestUser({
        email: `verified-${uuidv4().substring(0, 8)}@example.com`,
      });

      await prisma.user.update({
        where: { id: verifiedUser.id },
        data: {
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      });
    });

    it('should resend verification email successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/resend-verification',
        payload: {
          email: unverifiedUser.email,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'Verification email sent successfully');

      // Verify that a new token was generated
      const updatedUser = await prisma.user.findUnique({
        where: { id: unverifiedUser.id },
      });
      expect(updatedUser?.verificationToken).not.toBeNull();
      expect(updatedUser?.verificationTokenExpiry).not.toBeNull();

      // Verify token expiry is in the future
      if (updatedUser?.verificationTokenExpiry) {
        expect(updatedUser.verificationTokenExpiry.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/resend-verification',
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.error).toHaveProperty('code', 'EMAIL_REQUIRED');
    });

    it('should return 400 for empty email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/resend-verification',
        payload: {
          email: '',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
    });

    it('should return 400 for non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/resend-verification',
        payload: {
          email: 'nonexistent@example.com',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.error).toHaveProperty('code', 'RESEND_FAILED');
      expect(body.error.message).toContain('User not found');
    });

    it('should return 400 when email is already verified', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/resend-verification',
        payload: {
          email: verifiedUser.email,
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.error).toHaveProperty('code', 'RESEND_FAILED');
      expect(body.error.message).toContain('already verified');
    });

    it('should handle invalid email format gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/resend-verification',
        payload: {
          email: 'not-a-valid-email',
        },
      });

      // Should return 400 for non-existent user (since invalid email won't exist)
      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('success', false);
    });

    it('should generate a new token when resending', async () => {
      // Set an initial token
      const initialToken = crypto.randomBytes(32).toString('base64url');
      await prisma.user.update({
        where: { id: unverifiedUser.id },
        data: {
          verificationToken: initialToken,
          verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Resend verification
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/resend-verification',
        payload: {
          email: unverifiedUser.email,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify that a new token was generated (different from the initial one)
      const updatedUser = await prisma.user.findUnique({
        where: { id: unverifiedUser.id },
      });
      expect(updatedUser?.verificationToken).not.toBeNull();
      expect(updatedUser?.verificationToken).not.toBe(initialToken);
    });
  });

  describe('Integration: Full verification workflow', () => {
    it('should complete full verification workflow', async () => {
      await deleteAllTestUsers();

      // 1. Create unverified user
      const user = await createTestUser({
        email: `workflow-${uuidv4().substring(0, 8)}@example.com`,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: false,
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      });

      // 2. Request verification email
      const resendResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/resend-verification',
        payload: {
          email: user.email,
        },
      });

      expect(resendResponse.statusCode).toBe(200);

      // 3. Get the token from database
      const userWithToken = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(userWithToken?.verificationToken).not.toBeNull();

      const token = userWithToken!.verificationToken!;

      // 4. Verify email with token
      const verifyResponse = await app.inject({
        method: 'GET',
        url: `/api/auth/verify-email?token=${token}`,
      });

      expect(verifyResponse.statusCode).toBe(200);

      // 5. Verify user is now verified
      const verifiedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(verifiedUser?.emailVerified).toBe(true);
      expect(verifiedUser?.verificationToken).toBeNull();

      // 6. Attempting to resend should now fail
      const resendAfterVerifyResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/resend-verification',
        payload: {
          email: user.email,
        },
      });

      expect(resendAfterVerifyResponse.statusCode).toBe(400);
      const body = resendAfterVerifyResponse.json();
      expect(body.error.message).toContain('already verified');
    });
  });
});
