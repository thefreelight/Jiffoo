import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { hashAuthToken, issueAuthToken } from '@/core/auth/auth-token';
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
    expect(response.json().data.createdAt).toEqual(expect.any(String));
    expect(response.json().data.updatedAt).toEqual(expect.any(String));
    return { email, id: response.json().data.id as string };
  }

  it('administrator list and detail preserve the timestamps needed by the Admin date formatter', async () => {
    const actor = await createAdminWithToken();
    const list = await app.inject({ method: 'GET', url: '/api/v1/admin/staff', headers: auth(actor.token) });
    expect(list.statusCode).toBe(200);
    const row = list.json().data.items.find((item: { id: string }) => item.id === actor.user.id);
    const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/staff/${actor.user.id}`, headers: auth(actor.token) });
    expect(detail.statusCode).toBe(200);
    for (const value of [row, detail.json().data]) {
      expect(value.createdAt).toEqual(expect.any(String)); expect(Number.isFinite(Date.parse(value.createdAt))).toBe(true);
      expect(value.updatedAt).toEqual(expect.any(String)); expect(Number.isFinite(Date.parse(value.updatedAt))).toBe(true);
    }
  });

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


  it('revokes an invitation on removal, refuses the old link and permits only an explicit re-invitation', async () => {
    const actor = await createAdminWithToken(), account = await invite(actor.token);
    const headers = auth(actor.token), path = '/api/v1/admin/staff/' + account.id;
    const first = await app.inject({ method: 'POST', url: path + '/invite-link', headers });
    const token = new URL(first.json().data.link).searchParams.get('token')!;
    const before = await db.user.findUniqueOrThrow({ where: { id: account.id } });
    expect((await app.inject({ method: 'DELETE', url: path, headers })).statusCode).toBe(200);
    const removed = await db.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(removed.removedAt).not.toBeNull(); expect(removed.isActive).toBe(false); expect(removed.sessionVersion).toBe(before.sessionVersion + 1);
    expect((await db.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(token) } })).consumedAt).not.toBeNull();
    const accept = (value: string, password = 'Accepted123!') => app.inject({ method: 'POST', url: '/api/v1/auth/accept-invite', payload: { token: value, password } });
    expect((await accept(token)).json().error.code).toBe('INVALID_INVITE_TOKEN');
    for (const endpoint of ['/invite-link', '/invite']) expect((await app.inject({ method: 'POST', url: path + endpoint, headers })).statusCode).toBe(409);
    expect((await app.inject({ method: 'DELETE', url: path, headers })).statusCode).toBe(409);
    expect(await db.user.findUniqueOrThrow({ where: { id: account.id } })).toEqual(removed);
    const reinvite = await app.inject({ method: 'POST', url: path + '/reinvite', headers });
    expect(reinvite.statusCode).toBe(201); expect(reinvite.json().data).toMatchObject({ status: 'invited', removedAt: null, emailVerified: false });
    const pending = await db.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(pending.password).not.toBe(removed.password); expect(pending.sessionVersion).toBe(removed.sessionVersion + 1);
    expect((await accept(token)).json().error.code).toBe('INVALID_INVITE_TOKEN');
    const notification = await db.notification.findFirstOrThrow({ where: { recipientUserId: account.id, type: 'staff_invite' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const fresh = new URL((notification.secretJson as { link: string }).link).searchParams.get('token')!;
    expect((await accept(fresh, '1234567')).statusCode).toBe(400);
    expect((await db.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(fresh) } })).consumedAt).toBeNull();
    expect((await accept(fresh, '12345678')).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: path + '/reinvite', headers })).statusCode).toBe(409);
    const audits = await db.adminStaffAuditLog.findMany({ where: { staffUserId: account.id } });
    expect(audits.filter(row => row.action === 'ADMIN_INVITE_ACCEPTED')).toHaveLength(1);
    expect(audits.find(row => row.action === 'ADMIN_INVITE_ACCEPTED')?.actorUserId).toBe(account.id);
    expect(audits.find(row => row.action === 'ADMIN_INVITED' && (row.metadata as { reinvite?: boolean } | null)?.reinvite)).toBeDefined();
  });

  it.each(['active', 'removed', 'customer'] as const)('rejects an invite for a %s account without consuming its token or changing the user', async state => {
    const account = state === 'customer' ? await createUserWithToken() : await createAdminWithToken();
    if (state === 'removed') await db.user.update({ where: { id: account.user.id }, data: { removedAt: new Date(), isActive: false } });
    const token = await db.$transaction(tx => issueAuthToken(tx, account.user.id, 'STAFF_INVITE'));
    const before = await db.user.findUniqueOrThrow({ where: { id: account.user.id } });
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/accept-invite', payload: { token, password: 'Accepted123!' } });
    expect(response.statusCode).toBe(400); expect(response.json().error.code).toBe('INVALID_INVITE_TOKEN');
    expect(await db.user.findUniqueOrThrow({ where: { id: account.user.id } })).toEqual(before);
    expect((await db.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(token) } })).consumedAt).toBeNull();
  });

  it('returns distinct case-insensitive email conflicts for customers, removed admins and existing admins', async () => {
    const actor = await createAdminWithToken(), customer = await createUserWithToken(), removed = await createAdminWithToken();
    await db.user.update({ where: { id: removed.user.id }, data: { isActive: false, removedAt: new Date() } });
    const pending = await invite(actor.token);
    for (const [email, code] of [[customer.user.email, 'STAFF_EMAIL_IS_CUSTOMER'], [removed.user.email, 'STAFF_EMAIL_REMOVED_ADMIN'], [actor.user.email, 'EMAIL_TAKEN'], [pending.email, 'EMAIL_TAKEN']]) {
      const result = await app.inject({ method: 'POST', url: '/api/v1/admin/staff', headers: auth(actor.token), payload: { email: email.toUpperCase(), username: 'Duplicate' } });
      expect(result.statusCode).toBe(code === 'EMAIL_TAKEN' ? 400 : 409); expect(result.json().error.code).toBe(code);
    }
  });

  it('derives list state independently of email verification and follows filters in neighbors', async () => {
    const actor = await createAdminWithToken(), prefix = 'staff-filter-' + randomUUID();
    const ids: string[] = [];
    for (const state of ['active', 'invited', 'removed'] as const) {
      const account = await createAdminWithToken();
      ids.push(account.user.id);
      await db.user.update({ where: { id: account.user.id }, data: { username: prefix + '-' + state, isActive: state !== 'invited', removedAt: state === 'removed' ? new Date() : null, emailVerified: state === 'invited', createdAt: new Date('2026-10-01T00:00:00Z') } });
      if (state === 'invited') await db.$transaction(tx => issueAuthToken(tx, account.user.id, 'STAFF_INVITE'));
    }
    for (const status of ['all', 'active', 'invited', 'removed']) {
      const result = await app.inject({ method: 'GET', url: '/api/v1/admin/staff?search=' + prefix + '&status=' + status, headers: auth(actor.token) });
      expect(result.statusCode).toBe(200);
      const data = result.json().data;
      expect(data.statusCounts).toEqual({ all: 3, active: 1, invited: 1, removed: 1 });
      expect(data.total).toBe(status === 'all' ? 3 : 1);
      expect(data.items.map((row: { id: string }) => row.id)).toEqual(ids.filter((_, index) => status === 'all' || index === ['active', 'invited', 'removed'].indexOf(status)).sort());
      for (let index = 0; index < data.items.length; index++) {
        const item = data.items[index];
        const neighbors = await app.inject({ method: 'GET', url: '/api/v1/admin/staff/' + item.id + '/neighbors?search=' + prefix + '&status=' + status, headers: auth(actor.token) });
        expect(neighbors.json().data).toEqual({ position: index + 1, total: data.total, previousId: data.items[index - 1]?.id ?? null, nextId: data.items[index + 1]?.id ?? null });
        if (item.status === 'invited') expect(item.inviteExpiresAt).toEqual(expect.any(String));
      }
    }
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
