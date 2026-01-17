/**
 * Admin Users Endpoints Tests
 * 
 * Coverage:
 * - GET /api/admin/users/
 * - POST /api/admin/users/
 * - GET /api/admin/users/:id
 * - PUT /api/admin/users/:id
 * - DELETE /api/admin/users/:id
 * - POST /api/admin/users/:id/reset-password
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import { v4 as uuidv4 } from 'uuid';

describe('Admin Users Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: uToken } = await createUserWithToken();
    const { token: aToken, user: adminUser } = await createAdminWithToken();

    userToken = uToken;
    adminToken = aToken;
    adminUserId = adminUser.id;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('Authentication & Authorization', () => {
    it('GET /api/admin/users/ should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/admin/users/ should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('GET /api/admin/users/ should return 200 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/admin/users/', () => {
    it('should return users list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data.users)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users/?page=1&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.users.length).toBeLessThanOrEqual(5);
    });

    it('should support search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users/?search=test',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/admin/users/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/users/',
        payload: {
          email: 'newadminuser@example.com',
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/users/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          email: 'newadminuser@example.com',
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: 'newadminuser@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create user with valid data', async () => {
      const uniqueId = uuidv4().substring(0, 8);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: `admin-created-${uniqueId}@example.com`,
          password: 'Test123456!',
          username: `adminuser-${uniqueId}`,
          role: 'USER',
        },
      });

      expect([200, 201]).toContain(response.statusCode);
    });
  });

  describe('GET /api/admin/users/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/users/${adminUserId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/users/${adminUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return user details for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/users/${adminUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/users/${fakeUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const { user } = await createUserWithToken({
        email: `update-target-${uuidv4().substring(0, 8)}@example.com`,
      });
      targetUserId = user.id;
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${targetUserId}`,
        payload: { username: 'updated-username' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { username: 'updated-username' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update user for admin', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { username: `updated-${uuidv4().substring(0, 8)}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const { user } = await createUserWithToken({
        email: `delete-target-${uuidv4().substring(0, 8)}@example.com`,
      });
      targetUserId = user.id;
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${targetUserId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should delete user for admin', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = uuidv4();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${fakeUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('POST /api/admin/users/:id/reset-password', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const { user } = await createUserWithToken({
        email: `reset-pw-${uuidv4().substring(0, 8)}@example.com`,
      });
      targetUserId = user.id;
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/admin/users/${targetUserId}/reset-password`,
        payload: { newPassword: 'NewPassword123!' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/admin/users/${targetUserId}/reset-password`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { newPassword: 'NewPassword123!' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/admin/users/${targetUserId}/reset-password`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/admin/users/${targetUserId}/reset-password`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { newPassword: '123' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reset password for admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/admin/users/${targetUserId}/reset-password`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { newPassword: 'NewPassword123!' },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
