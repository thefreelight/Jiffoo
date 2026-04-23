import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createAdminWithToken,
  createUserWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';

describe('Admin Staff Endpoints', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let ownerToken: string;
  let ownerUserId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: adminAuthToken } = await createAdminWithToken();
    const { token: ownerAuthToken, user: ownerUser } = await createUserWithToken({ role: 'OWNER' });

    adminToken = adminAuthToken;
    ownerToken = ownerAuthToken;
    ownerUserId = ownerUser.id;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  it('GET /api/admin/staff should require authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/staff',
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /api/admin/staff should allow admin to grant non-manager staff access', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/staff',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        email: 'analyst-staff@test.com',
        username: 'analyst-staff',
        role: 'ANALYST',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('adminRole', 'ANALYST');
    expect(body.data).toHaveProperty('emailVerified', false);
    expect(body.data.effectivePermissions).toContain('dashboard.read');

    const prisma = getTestPrisma();
    const invitedUser = await prisma.user.findUnique({
      where: { email: 'analyst-staff@test.com' },
      select: {
        emailVerified: true,
        verificationToken: true,
        verificationTokenExpiry: true,
      },
    });
    expect(invitedUser?.emailVerified).toBe(false);
    expect(invitedUser?.verificationToken).toBeTruthy();
    expect(invitedUser?.verificationTokenExpiry?.getTime()).toBeGreaterThan(Date.now());
  });

  it('POST /api/admin/staff should block admin from granting another staff manager', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/staff',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        email: 'admin-staff@test.com',
        username: 'admin-staff',
        password: 'Test123456!',
        role: 'ADMIN',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toHaveProperty('error.code', 'FORBIDDEN');
  });

  it('GET /api/admin/staff should list staff memberships', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/staff',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items.some((item: any) => item.email === 'analyst-staff@test.com')).toBe(true);
  });

  it('GET /api/admin/staff/:userId/audit should return structured staff audit entries', async () => {
    const prisma = getTestPrisma();
    const staffUser = await prisma.user.findUnique({
      where: { email: 'analyst-staff@test.com' },
      select: { id: true },
    });

    expect(staffUser).toBeTruthy();

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/staff/${staffUser!.id}/audit`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items[0]).toEqual(
      expect.objectContaining({
        action: 'STAFF_ACCESS_GRANTED',
        staffUserId: staffUser!.id,
      }),
    );
  });

  it('POST /api/admin/staff/:userId/invite should resend invitation and audit the action', async () => {
    const prisma = getTestPrisma();
    const staffUser = await prisma.user.findUnique({
      where: { email: 'analyst-staff@test.com' },
      select: { id: true },
    });

    expect(staffUser).toBeTruthy();

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/staff/${staffUser!.id}/invite`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          userId: staffUser!.id,
          invited: true,
        }),
      }),
    );

    const auditEntry = await prisma.adminStaffAuditLog.findFirst({
      where: {
        staffUserId: staffUser!.id,
        action: 'STAFF_INVITE_RESENT',
      },
    });
    expect(auditEntry).toBeTruthy();
  });

  it('DELETE /api/admin/staff/:userId should protect the last active owner', async () => {
    const prisma = getTestPrisma();
    await prisma.adminMembership.upsert({
      where: { userId: ownerUserId },
      update: {
        role: 'OWNER',
        status: 'ACTIVE',
        isOwner: true,
      },
      create: {
        userId: ownerUserId,
        role: 'OWNER',
        status: 'ACTIVE',
        isOwner: true,
      },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/staff/${ownerUserId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toHaveProperty('error.code', 'LAST_OWNER_REQUIRED');
  });
});
