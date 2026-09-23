import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createAdminWithToken,
  createUserWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { hashAuthToken } from '@/core/auth/auth-token';
import { env } from '@/config/env';

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

  it('GET /api/v1/admin/staff should require authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/staff',
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /api/v1/admin/staff should allow admin to grant non-manager staff access', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/staff',
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
        id: true,
        emailVerified: true,
      },
    });
    expect(invitedUser?.emailVerified).toBe(false);
    const invitation = await prisma.authToken.findFirst({
      where: { userId: invitedUser!.id, purpose: 'STAFF_INVITE', consumedAt: null },
    });
    expect(invitation?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(invitation?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('POST /api/v1/admin/staff should block admin from granting another staff manager', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/staff',
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

  it('GET /api/v1/admin/staff should list staff memberships', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/staff',
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

  it('GET /api/v1/admin/staff/:userId/audit should return structured staff audit entries', async () => {
    const prisma = getTestPrisma();
    const staffUser = await prisma.user.findUnique({
      where: { email: 'analyst-staff@test.com' },
      select: { id: true },
    });

    expect(staffUser).toBeTruthy();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/staff/${staffUser!.id}/audit`,
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

  it('POST /api/v1/admin/staff/:userId/invite should resend invitation and audit the action', async () => {
    const prisma = getTestPrisma();
    const staffUser = await prisma.user.findUnique({
      where: { email: 'analyst-staff@test.com' },
      select: { id: true },
    });

    expect(staffUser).toBeTruthy();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/staff/${staffUser!.id}/invite`,
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
      queued: true,
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

  it('POST /api/v1/admin/staff/:userId/invite-link requires staff.write and replaces the old invitation', async () => {
    const prisma = getTestPrisma();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: 'analyst-staff@test.com' } });
    const url = `/api/v1/admin/staff/${staff.id}/invite-link`;
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
    const customer = await createUserWithToken();
    expect((await app.inject({
      method: 'POST', url, headers: { authorization: `Bearer ${customer.token}` },
    })).statusCode).toBe(403);
    const headers = { authorization: `Bearer ${adminToken}` };
    const first = await app.inject({ method: 'POST', url, headers });
    expect(first.statusCode).toBe(201);
    const firstLink = first.json().data.link as string;
    expect(firstLink.startsWith(env.ADMIN_URL)).toBe(true);
    expect(firstLink).toContain('/auth/accept-invite?token=');
    const second = await app.inject({ method: 'POST', url, headers });
    expect(second.statusCode).toBe(201);
    const firstToken = new URL(firstLink).searchParams.get('token')!;
    const secondToken = new URL(second.json().data.link).searchParams.get('token')!;
    expect(firstToken).not.toBe(secondToken);
    expect((await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(firstToken) } })).consumedAt).not.toBeNull();
    expect((await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(secondToken) } })).consumedAt).toBeNull();
  });

  it('DELETE /api/v1/admin/staff/:userId should protect the last active owner', async () => {
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
      url: `/api/v1/admin/staff/${ownerUserId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toHaveProperty('error.code', 'LAST_OWNER_REQUIRED');
  });
});
