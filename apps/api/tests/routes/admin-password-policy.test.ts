import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { hashAuthToken, issueAuthToken } from '@/core/auth/auth-token';
import { InstallService } from '@/core/install/service';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });
it.each(['ADMIN', 'USER'] as const)('enforces the %s minimum on reset and authenticated password changes', async role => {
  const db = getTestPrisma(), account = role === 'ADMIN' ? await createAdminWithToken() : await createUserWithToken();
  const token = await db.$transaction(tx => issueAuthToken(tx, account.user.id, 'PASSWORD_RESET'));
  if (role === 'ADMIN') {
    const rejected = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token, newPassword: '1234567' } });
    expect(rejected.statusCode).toBe(400); expect(rejected.json().error.code).toBe('VALIDATION_ERROR');
    expect((await db.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(token) } })).consumedAt).toBeNull();
  }
  const newPassword = role === 'ADMIN' ? '12345678' : '123456';
  expect((await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token, newPassword } })).statusCode).toBe(200);
  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: account.user.email, password: newPassword, surface: role === 'ADMIN' ? 'admin' : 'storefront' } });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: 'Bearer ' + login.json().data.access_token };
  const wrong = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers, payload: { currentPassword: 'wrong', newPassword: 'NextPassword123!' } });
  expect(wrong.json().error.code).toBe('INVALID_PASSWORD');
  if (role === 'ADMIN') expect((await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers, payload: { currentPassword: newPassword, newPassword: '1234567' } })).json().error.code).toBe('VALIDATION_ERROR');
  const changed = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers, payload: { currentPassword: newPassword, newPassword: role === 'ADMIN' ? 'abcdefgh' : 'abcdef' } });
  expect(changed.statusCode).toBe(200);
  expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: 'Bearer ' + changed.json().data.access_token } })).statusCode).toBe(200);
  expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers })).statusCode).toBe(401);
});
it('rejects a seven-character install password at both HTTP and service boundaries', async () => {
  const payload = { siteName: 'Policy test', adminUsername: 'policy-owner', adminEmail: 'policy-install@example.com', adminPassword: '1234567' };
  const result = await app.inject({ method: 'POST', url: '/api/v1/install/complete', payload });
  expect(result.statusCode).toBe(400); expect(result.json().error.code).toBe('VALIDATION_ERROR');
  await expect(InstallService.completeInstallation(payload)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
