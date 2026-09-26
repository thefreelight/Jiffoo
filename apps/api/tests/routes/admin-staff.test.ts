import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { hashAuthToken } from '@/core/auth/auth-token';
import { env } from '@/config/env';

describe('AUTH-1 administrator management', () => {
  let app: FastifyInstance;
  const db = getTestPrisma();
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await deleteAllTestUsers(); await app.close(); });

  async function invite(actor: string) {
    const id = randomUUID();
    const email = `admin-${id}@example.com`;
    const response = await app.inject({
      method: 'POST', url: '/api/v1/admin/staff', headers: auth(actor),
      payload: { email, username: `admin-${id.slice(0, 8)}` },
    });
    expect(response.statusCode).toBe(201);
    return { email, id: response.json().data.id as string };
  }

  it('F invitation accepts a password and activates an administrator', async () => {
    const actor = await createAdminWithToken();
    const invited = await invite(actor.token);
    const pending = await db.user.findUniqueOrThrow({ where: { id: invited.id } });
    expect(pending).toMatchObject({ role: 'ADMIN', isActive: false, emailVerified: false });
    const url = `/api/v1/admin/staff/${invited.id}/invite-link`;
    const linkResponse = await app.inject({ method: 'POST', url, headers: auth(actor.token) });
    expect(linkResponse.statusCode).toBe(201);
    const link = linkResponse.json().data.link as string;
    expect(link.startsWith(env.ADMIN_URL)).toBe(true);
    const token = new URL(link).searchParams.get('token');
    expect(token).toBeTruthy();
    expect((await db.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(token!) } })).consumedAt).toBeNull();
    const accepted = await app.inject({
      method: 'POST', url: '/api/v1/auth/accept-invite',
      payload: { token, password: 'NewPassword123!' },
    });
    expect(accepted.statusCode).toBe(200);
    expect(await db.user.findUniqueOrThrow({ where: { id: invited.id } }))
      .toMatchObject({ role: 'ADMIN', isActive: true, emailVerified: true });
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: invited.email, password: 'NewPassword123!' },
    });
    expect(login.statusCode).toBe(200);
    const adminRequest = await app.inject({
      method: 'GET', url: '/api/v1/admin/staff', headers: auth(login.json().data.access_token),
    });
    expect(adminRequest.statusCode).toBe(200);
  });

  it('F invitation rejects role selection and does not create an account', async () => {
    const actor = await createAdminWithToken();
    const email = `forbidden-${randomUUID()}@example.com`;
    const response = await app.inject({
      method: 'POST', url: '/api/v1/admin/staff', headers: auth(actor.token),
      payload: { email, username: 'forbidden-role', role: 'ADMIN' },
    });
    expect(response.statusCode).toBe(400);
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
  });

  it('C self removal returns SELF_REMOVAL_FORBIDDEN without changing the account', async () => {
    const actor = await createAdminWithToken();
    const before = await db.user.findUniqueOrThrow({ where: { id: actor.user.id } });
    const response = await app.inject({
      method: 'DELETE', url: `/api/v1/admin/staff/${actor.user.id}`, headers: auth(actor.token),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('SELF_REMOVAL_FORBIDDEN');
    const accountDelete = await app.inject({
      method: 'DELETE', url: '/api/v1/account', headers: auth(actor.token),
      payload: { currentPassword: actor.user.password },
    });
    expect(accountDelete.statusCode).toBe(409);
    expect(accountDelete.json().error.code).toBe('SELF_REMOVAL_FORBIDDEN');
    expect(await db.user.findUniqueOrThrow({ where: { id: actor.user.id } })).toEqual(before);
  });

  it('D install administrator removal returns INSTALL_ADMIN_PROTECTED without changing the account', async () => {
    const installer = await createAdminWithToken();
    const actor = await createAdminWithToken();
    const prior = await db.systemSettings.findUnique({ where: { id: 'system' } });
    await db.systemSettings.upsert({
      where: { id: 'system' },
      create: { id: 'system', isInstalled: true, installedBy: installer.user.id },
      update: { installedBy: installer.user.id },
    });
    try {
      const before = await db.user.findUniqueOrThrow({ where: { id: installer.user.id } });
      const response = await app.inject({
        method: 'DELETE', url: `/api/v1/admin/staff/${installer.user.id}`, headers: auth(actor.token),
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('INSTALL_ADMIN_PROTECTED');
      const accountDelete = await app.inject({
        method: 'DELETE', url: '/api/v1/account', headers: auth(installer.token),
        payload: { currentPassword: installer.user.password },
      });
      expect(accountDelete.statusCode).toBe(409);
      expect(accountDelete.json().error.code).toBe('INSTALL_ADMIN_PROTECTED');
      expect(await db.user.findUniqueOrThrow({ where: { id: installer.user.id } })).toEqual(before);
    } finally {
      if (prior) await db.systemSettings.update({ where: { id: 'system' }, data: { installedBy: prior.installedBy } });
      else await db.systemSettings.delete({ where: { id: 'system' } });
    }
  });

  it('B removal revokes the existing token and rejects subsequent login', async () => {
    const actor = await createAdminWithToken();
    const removed = await createAdminWithToken();
    const before = await db.user.findUniqueOrThrow({ where: { id: removed.user.id } });
    const response = await app.inject({
      method: 'DELETE', url: `/api/v1/admin/staff/${removed.user.id}`, headers: auth(actor.token),
    });
    expect(response.statusCode).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id: removed.user.id } });
    expect(after.isActive).toBe(false);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect((await app.inject({
      method: 'GET', url: '/api/v1/admin/staff', headers: auth(removed.token),
    })).statusCode).toBe(401);
    expect((await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: removed.user.email, password: removed.user.password },
    })).statusCode).toBe(403);
  });

  it('administrator listing and invitations deny a customer', async () => {
    const customer = await createUserWithToken();
    for (const method of ['GET', 'POST'] as const) {
      expect((await app.inject({
        method, url: '/api/v1/admin/staff', headers: auth(customer.token),
        ...(method === 'POST' ? { payload: { email: `denied-${randomUUID()}@example.com`, username: 'denied' } } : {}),
      })).statusCode).toBe(403);
    }
  });
});
