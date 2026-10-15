import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createTestApp } from '../helpers/create-test-app';
import { createTestUser as createAccount, signJwt, signRefreshToken } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { hashAuthToken, issueAuthToken } from '@/core/auth/auth-token';

describe('Authentication surfaces', () => {
  const db = getTestPrisma();
  const userIds: string[] = [];
  async function createTestUser(options: Parameters<typeof createAccount>[0] = {}) {
    const user = await createAccount(options);
    userIds.push(user.id);
    return user;
  }
  let app: FastifyInstance;
  beforeAll(async () => { app = await createTestApp({ enableSwagger: true }); });
  afterAll(async () => {
    await db.notification.deleteMany({ where: { recipientUserId: { in: userIds } } });
    await db.authToken.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  const cases = [
    ['USER', true, false, 'CUSTOMER_ACCOUNT_NOT_ADMIN', null],
    ['USER', false, false, 'CUSTOMER_ACCOUNT_NOT_ADMIN', 'ACCOUNT_INACTIVE'],
    ['ADMIN', true, false, null, 'ADMIN_ACCOUNT_NOT_FOR_SHOP'],
    ['ADMIN', false, false, 'LOGIN_FAILED', 'ADMIN_ACCOUNT_NOT_FOR_SHOP'],
    ['ADMIN', false, true, 'ADMIN_ACCOUNT_REMOVED', 'ADMIN_ACCOUNT_NOT_FOR_SHOP'],
  ] as const;
  for (const [role, isActive, removed, adminError, shopError] of cases) {
    it(`${role} active=${isActive} removed=${removed} verifies passwords before disclosing surface errors`, async () => {
      const user = await createTestUser({ role });
      await db.user.update({ where: { id: user.id }, data: { isActive, removedAt: removed ? new Date() : null } });
      for (const surface of ['admin', 'storefront'] as const) {
        const login = (password: string, email = user.email) => app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password, surface } });
        const wrong = await login('IncorrectPassword123!');
        const unknown = await login('IncorrectPassword123!', `unknown-${randomUUID()}@example.com`);
        expect(wrong.statusCode).toBe(401); expect(wrong.json()).toEqual(unknown.json());
        const result = await login(user.password), code = surface === 'admin' ? adminError : shopError;
        expect(result.statusCode).toBe(code ? code === 'LOGIN_FAILED' ? 401 : 403 : 200);
        if (code) expect(result.json().error.code).toBe(code);
        else expect(result.json().data.user.id).toBe(user.id);
      }
    });
  }

  it('resolves matching display names within the requested role and defaults to storefront', async () => {
    const username = 'same-' + randomUUID();
    const admin = await createTestUser({ role: 'ADMIN', username }), buyer = await createTestUser({ username });
    for (const [surface, user] of [['admin', admin], ['storefront', buyer], [undefined, buyer]] as const) {
      const result = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { identifier: username, password: user.password, surface } });
      expect(result.statusCode).toBe(200); expect(result.json().data.user.id).toBe(user.id);
    }
  });

  it('rejects administrator purchasing with original and refreshed tokens', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const refresh = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refresh_token: signRefreshToken(admin.id) } });
    expect(refresh.statusCode).toBe(200);
    for (const token of [signJwt(admin), refresh.json().data.access_token]) {
      for (const [method, url, payload] of [
        ['POST', '/cart/items', {}], ['POST', '/cart/items/batch', {}], ['PUT', '/cart/items/item', {}],
        ['DELETE', '/cart/items/item', undefined], ['DELETE', '/cart', undefined], ['POST', '/checkout/quote', {}], ['POST', '/orders', {}],
      ] as const) {
        const result = await app.inject({ method, url: '/api/v1' + url, payload, headers: { authorization: 'Bearer ' + token } });
        expect(result.statusCode, url).toBe(403); expect(result.json().error.code).toBe('ADMIN_ACCOUNT_NOT_FOR_SHOP');
      }
    }
  });

  it('only queues reset emails for active accounts on the matching surface with identical acknowledgements', async () => {
    for (const [role, isActive, removed] of cases) {
      const user = await createTestUser({ role });
      await db.user.update({ where: { id: user.id }, data: { isActive, removedAt: removed ? new Date() : null } });
      for (const surface of ['admin', 'storefront'] as const) {
        const request = (email: string) => app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email, app: surface } });
        const expected = isActive && !removed && role === (surface === 'admin' ? 'ADMIN' : 'USER');
        const before = await db.notification.count({ where: { recipientUserId: user.id, type: 'password_reset' } });
        const started = performance.now(), result = await request(user.email);
        expect(performance.now() - started).toBeGreaterThanOrEqual(480);
        expect(result.json()).toEqual((await request(`unknown-${randomUUID()}@example.com`)).json());
        expect(await db.notification.count({ where: { recipientUserId: user.id, type: 'password_reset' } })).toBe(before + Number(expected));
      }
    }
  }, 20000);

  it.each(['valid', 'expired', 'consumed', 'removed', 'active', 'wrong-purpose', 'customer'] as const)('looks up %s invitations without altering tokens', async state => {
    const user = await createTestUser({ role: state === 'customer' ? 'USER' : 'ADMIN' });
    await db.user.update({ where: { id: user.id }, data: { isActive: state === 'active', removedAt: state === 'removed' ? new Date() : null } });
    const token = await db.$transaction(tx => issueAuthToken(tx, user.id, state === 'wrong-purpose' ? 'PASSWORD_RESET' : 'STAFF_INVITE'));
    await db.authToken.update({ where: { tokenHash: hashAuthToken(token) }, data: {
      ...(state === 'expired' ? { expiresAt: new Date(Date.now() - 1000) } : {}), ...(state === 'consumed' ? { consumedAt: new Date() } : {}),
    } });
    const before = await db.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(token) } });
    for (let i = 0; i < 2; i++) {
      const response = await app.inject({ method: 'GET', url: '/api/v1/auth/invite?token=' + token });
      expect(response.statusCode).toBe(state === 'valid' ? 200 : 400);
      if (state === 'valid') expect(response.json().data).toEqual({ email: user.email, storeName: expect.any(String) });
      else expect(response.json().error.code).toBe('INVALID_INVITE_TOKEN');
    }
    expect(await db.authToken.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
  });

  it('declares request and error schemas for both recovery lookups and login', () => {
    for (const [path, method] of [['/auth/invite', 'get'], ['/auth/reset-password', 'get'], ['/auth/login', 'post']] as const) {
      const operation = app.swagger().paths?.['/api/v1' + path]?.[method];
      expect(operation).toBeDefined();
      for (const status of ['200', '400', '429', '500', '503']) expect(operation?.responses).toHaveProperty(status);
    }
  });
});
