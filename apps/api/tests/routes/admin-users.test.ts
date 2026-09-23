/**
 * Admin Users Endpoints Tests
 * 
 * Coverage:
 * - GET /api/v1/admin/users/
 * - GET /api/v1/admin/users/stats
 * - POST /api/v1/admin/users/
 * - GET /api/v1/admin/users/:id
 * - PUT /api/v1/admin/users/:id
 * - DELETE /api/v1/admin/users/:id
 * - POST /api/v1/admin/customers/:id/password-reset-link
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import { v4 as uuidv4 } from 'uuid';
import { getTestPrisma } from '../helpers/db';
import { hashAuthToken } from '@/core/auth/auth-token';
import { ADMIN_PERMISSIONS, DEFAULT_ADMIN_ROLE_PERMISSIONS } from 'shared';

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
    it('GET /api/v1/admin/users/ should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/admin/users/ should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('GET /api/v1/admin/users/ should return 200 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/admin/users/', () => {
    it('should return users list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/?page=1&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should support search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/?search=test',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/admin/users/stats', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/stats',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/stats',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should return global user stats for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/stats',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('metrics');
      expect(body.data.metrics).toHaveProperty('totalUsers');
      expect(body.data.metrics).toHaveProperty('activeUsers');
      expect(body.data.metrics).toHaveProperty('inactiveUsers');
      expect(body.data.metrics).toHaveProperty('newThisMonth');
      expect(body.data.metrics).toHaveProperty('totalUsersTrend');
      expect(body.data.metrics).toHaveProperty('activeUsersTrend');
      expect(body.data.metrics).toHaveProperty('inactiveUsersTrend');
      expect(body.data.metrics).toHaveProperty('newUsersTrend');
    });
  });

  describe('POST /api/v1/admin/users/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/',
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
        url: '/api/v1/admin/users/',
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
        url: '/api/v1/admin/users/',
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
        url: '/api/v1/admin/users/',
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
        url: '/api/v1/admin/users/',
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

  describe('GET /api/v1/admin/users/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${adminUserId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${adminUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return user details for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${adminUserId}`,
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
        url: `/api/v1/admin/users/${fakeUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/admin/users/:id', () => {
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
        url: `/api/v1/admin/users/${targetUserId}`,
        payload: { username: 'updated-username' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { username: 'updated-username' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update user for admin', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { username: `updated-${uuidv4().substring(0, 8)}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/v1/admin/users/:id', () => {
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
        url: `/api/v1/admin/users/${targetUserId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should delete user for admin', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = uuidv4();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${fakeUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/admin/customers/:id/password-reset-link', () => {
    let targetUserId: string;

    beforeEach(async () => {
      const { user } = await createUserWithToken({
        email: `reset-pw-${uuidv4().substring(0, 8)}@example.com`,
      });
      targetUserId = user.id;
    });

    const url = () => `/api/v1/admin/customers/${targetUserId}/password-reset-link`;

    it('rejects the removed direct set-password endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${targetUserId}/reset-password`,
        payload: { newPassword: 'NewPassword123!' },
      });
      expect(response.statusCode).toBe(404);
    });

    it('requires authentication', async () => {
      expect((await app.inject({ method: 'POST', url: url() })).statusCode).toBe(401);
    });

    it('requires customers.credentials.reset even when the actor has customers.write', async () => {
      const regular = await app.inject({
        method: 'POST',
        url: url(),
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(regular.statusCode).toBe(403);

      const actor = await createAdminWithToken();
      const prisma = getTestPrisma();
      await prisma.adminMembership.create({
        data: { userId: actor.user.id, role: 'OPERATIONS_MANAGER' },
      });
      expect(DEFAULT_ADMIN_ROLE_PERMISSIONS.OPERATIONS_MANAGER).toContain(ADMIN_PERMISSIONS.CUSTOMERS_WRITE);
      expect(DEFAULT_ADMIN_ROLE_PERMISSIONS.OPERATIONS_MANAGER).not.toContain(ADMIN_PERMISSIONS.CUSTOMERS_CREDENTIALS_RESET);
      const headers = { authorization: `Bearer ${actor.token}` };
      const forbidden = await app.inject({ method: 'POST', url: url(), headers });
      expect(forbidden.statusCode).toBe(403);
      expect(forbidden.json().error.message).toContain(ADMIN_PERMISSIONS.CUSTOMERS_CREDENTIALS_RESET);

      await prisma.adminMembership.update({
        where: { userId: actor.user.id }, data: { role: 'SUPPORT_AGENT' },
      });
      expect(DEFAULT_ADMIN_ROLE_PERMISSIONS.SUPPORT_AGENT).toContain(ADMIN_PERMISSIONS.CUSTOMERS_CREDENTIALS_RESET);
      const allowed = await app.inject({ method: 'POST', url: url(), headers });
      expect(allowed.statusCode).toBe(201);
      expect(allowed.json().data.link).toContain('/reset-password?token=');
    });

    it('returns a one-time link, invalidates the previous link, audits without secrets and queues no notification', async () => {
      const prisma = getTestPrisma();
      const headers = { authorization: `Bearer ${adminToken}` };
      const first = await app.inject({ method: 'POST', url: url(), headers });
      expect(first.statusCode).toBe(201);
      const firstLink = first.json().data.link as string;
      const second = await app.inject({ method: 'POST', url: url(), headers });
      expect(second.statusCode).toBe(201);
      const secondLink = second.json().data.link as string;
      const firstToken = new URL(firstLink).searchParams.get('token')!;
      const secondToken = new URL(secondLink).searchParams.get('token')!;
      expect(firstLink).toContain('/reset-password?token=');
      expect(secondToken).not.toBe(firstToken);
      expect((await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(firstToken) } })).consumedAt).not.toBeNull();
      expect((await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(secondToken) } })).consumedAt).toBeNull();
      const audits = await prisma.adminStaffAuditLog.findMany({
        where: { staffUserId: targetUserId, action: 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED' },
      });
      expect(audits).toHaveLength(2);
      expect(JSON.stringify(audits)).not.toContain(secondToken);
      expect(await prisma.notification.count({ where: { recipientUserId: targetUserId, type: 'password_reset' } })).toBe(0);
    });
  });
});
