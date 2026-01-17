/**
 * Account Endpoints Tests
 * 
 * Coverage:
 * - GET /api/account/profile - Authenticated users only
 * - PUT /api/account/profile - Authenticated users only
 * 
 * All account endpoints require authentication.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { validateResponse } from '../helpers/openapi';

describe('Account Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { token, user } = await createUserWithToken({
      username: 'accounttestuser',
    });
    userToken = token;
    userId = user.id;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('Security - 401 without token', () => {
    it('GET /api/account/profile should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/account/profile',
      });

      expect(response.statusCode).toBe(401);
    });

    it('PUT /api/account/profile should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/account/profile',
        payload: { username: 'newname' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/account/profile', () => {

    it('should return user profile with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/account/profile',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body).toHaveProperty('success');
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('email');
    });

    it('should match OpenAPI schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/account/profile',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const validation = validateResponse('/api/account/profile', 'GET', 200, response.json());
      expect(validation.valid).toBe(true);
    });

    it('should not expose password', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/account/profile',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const body = response.json();
      expect(body.data).not.toHaveProperty('password');
    });

    it('should include language preferences if available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/account/profile',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const body = response.json();
      // languagePreferences may or may not be present
      if (body.data.languagePreferences) {
        expect(body.data.languagePreferences).toBeTypeOf('object');
      }
    });
  });

  describe('PUT /api/account/profile', () => {
    it('should update username', async () => {
      const newUsername = `updated-${Date.now()}`;
      
      const response = await app.inject({
        method: 'PUT',
        url: '/api/account/profile',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          username: newUsername,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should update avatar', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/account/profile',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          avatar: 'https://example.com/new-avatar.jpg',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 for short username', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/account/profile',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          username: 'ab', // Min 3 characters
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for too long username', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/account/profile',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          username: 'a'.repeat(51), // Max 50 characters
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept empty payload (no changes)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/account/profile',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
