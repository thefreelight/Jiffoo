import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createTestApp } from '../helpers/create-test-app';
import { createTestUser, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { issueAuthToken } from '@/core/auth/auth-token';
import { env } from '@/config/env';

describe('Session revocation', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();
  const authUrl = '/api/v1/auth';

  async function account() {
    return createTestUser({ email: `session-${randomUUID()}@example.com`, password: 'OldPassword123!' });
  }

  async function login(email: string, password = 'OldPassword123!') {
    const response = await app.inject({ method: 'POST', url: `${authUrl}/login`, payload: { email, password } });
    expect(response.statusCode).toBe(200);
    return response.json().data as { access_token: string; refresh_token: string };
  }

  async function protectedRequest(token: string) {
    return app.inject({ method: 'GET', url: `${authUrl}/me`, headers: { authorization: `Bearer ${token}` } });
  }

  async function refresh(token: string) {
    return app.inject({ method: 'POST', url: `${authUrl}/refresh`, payload: { refresh_token: token } });
  }

  async function revoked(tokens: { access_token: string; refresh_token: string }) {
    const access = await protectedRequest(tokens.access_token);
    const renewal = await refresh(tokens.refresh_token);
    expect(access.statusCode).toBe(401);
    expect(access.json().error.code).toBe('SESSION_REVOKED');
    expect(renewal.statusCode).toBe(401);
    expect(renewal.json().error.code).toBe('SESSION_REVOKED');
  }

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await deleteAllTestUsers(); await app.close(); });

  it('revokes access and refresh after reset and permits a new login', async () => {
    const user = await account();
    const old = await login(user.email);
    const resetToken = await prisma.$transaction((tx) => issueAuthToken(tx, user.id, 'PASSWORD_RESET'));
    const response = await app.inject({
      method: 'POST', url: `${authUrl}/reset-password`,
      payload: { token: resetToken, newPassword: 'NewPassword123!' },
    });
    expect(response.statusCode).toBe(200);
    await revoked(old);
    const fresh = await login(user.email, 'NewPassword123!');
    expect((await protectedRequest(fresh.access_token)).statusCode).toBe(200);
  });

  it('revokes another session on change and returns working tokens to the current device', async () => {
    const user = await account();
    const other = await login(user.email);
    const current = await login(user.email);
    const changed = await app.inject({
      method: 'POST', url: `${authUrl}/change-password`,
      headers: { authorization: `Bearer ${current.access_token}` },
      payload: { currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' },
    });
    expect(changed.statusCode).toBe(200);
    const fresh = changed.json().data as { access_token: string; refresh_token: string };
    expect(fresh.access_token).toEqual(expect.any(String));
    expect(fresh.refresh_token).toEqual(expect.any(String));
    await revoked(other);
    expect((await protectedRequest(fresh.access_token)).statusCode).toBe(200);
    expect((await refresh(fresh.refresh_token)).statusCode).toBe(200);
  });

  it('revokes tokens issued before invitation acceptance', async () => {
    const user = await account();
    const old = await login(user.email);
    const invite = await prisma.$transaction((tx) => issueAuthToken(tx, user.id, 'STAFF_INVITE'));
    const accepted = await app.inject({
      method: 'POST', url: `${authUrl}/accept-invite`,
      payload: { token: invite, password: 'NewPassword123!' },
    });
    expect(accepted.statusCode).toBe(200);
    await revoked(old);
  });

  it('rejects signed access and refresh tokens missing sv', async () => {
    const user = await account();
    const access = jwt.sign({ userId: user.id, email: user.email, role: user.role }, env.JWT_SECRET);
    const renewal = jwt.sign({ userId: user.id, type: 'refresh' }, env.JWT_SECRET);
    await revoked({ access_token: access, refresh_token: renewal });
  });

  it('keeps existing tokens valid after email and profile changes', async () => {
    const user = await account();
    const tokens = await login(user.email);
    const headers = { authorization: `Bearer ${tokens.access_token}` };
    const email = await app.inject({
      method: 'PUT', url: '/api/v1/account/email', headers,
      payload: { newEmail: `changed-${randomUUID()}@example.com`, currentPassword: user.password },
    });
    expect(email.statusCode).toBe(200);
    const profile = await app.inject({
      method: 'PUT', url: '/api/v1/account/profile', headers,
      payload: { username: `changed-${randomUUID().slice(0, 8)}` },
    });
    expect(profile.statusCode).toBe(200);
    expect((await protectedRequest(tokens.access_token)).statusCode).toBe(200);
    expect((await refresh(tokens.refresh_token)).statusCode).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion).toBe(0);
  });
});
