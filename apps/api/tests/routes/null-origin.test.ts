import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { registerOriginPolicy, pluginPageAdmission } from '@/core/plugin-pages/origin-policy';
import { buildApp } from '@/server';
import { JwtUtils } from '@/utils/jwt';
import { env } from '@/config/env';
import inventory from '../../../../scripts/cookie-route-inventory.json';
import { getTestPrisma } from '../helpers/db';
import { createUserWithToken } from '../helpers/auth';
import { ApiTokenService } from '@/core/auth/api-token';

const app = await buildApp();
const prisma = getTestPrisma();
let ordinaryToken: string;
let apiToken: string;
let apiTokenId: string;
beforeAll(async () => {
  ordinaryToken = (await createUserWithToken()).token;
  await prisma.systemSettings.upsert({ where: { id: 'system' }, create: { id: 'system' }, update: {} });
  const created = await ApiTokenService.createToken('P-2 isolation fixture', ['*']);
  apiToken = created.token;
  apiTokenId = created.record.id;
  expect(await ApiTokenService.listTokens()).toContainEqual(created.record);
});
afterAll(async () => {
  if (apiTokenId) await ApiTokenService.revokeToken(apiTokenId);
  await app.close();
});
const snapshot = () => Promise.all([
  prisma.user.findMany({ orderBy: { id: 'asc' } }), prisma.authToken.findMany({ orderBy: { id: 'asc' } }),
  prisma.cart.findMany({ orderBy: { id: 'asc' } }), prisma.cartItem.findMany({ orderBy: { id: 'asc' } }),
  prisma.order.findMany({ orderBy: { id: 'asc' } }), prisma.payment.findMany({ orderBy: { id: 'asc' } }),
  prisma.paymentLedger.findMany({ orderBy: { id: 'asc' } }),
  prisma.systemSettings.findMany({ orderBy: { id: 'asc' } }),
]);
const pluginToken = jwt.sign({ typ: 'plugin-page-v1', aud: 'jiffoo-plugin-gateway', userId: 'forged', sv: 0 }, env.JWT_SECRET);
it.each(inventory.shopBff)('Core %s %s rejects null Origin before mutation even for simple requests', async (method, path) => {
  const before = await snapshot();
  for (const credential of [{ cookie: `shop_access=${ordinaryToken}` }, { authorization: `Bearer ${ordinaryToken}` }]) {
    const response = await app.inject({ method: method as 'POST', url: `/api/v1${path}`,
      headers: { origin: 'null', ...credential, 'content-type': 'text/plain' },
      ...(!['GET', 'HEAD'].includes(method) ? { payload: '{}' } : {}),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(await snapshot()).toEqual(before);
  }
});
it.each(inventory.apiCookieConsumers.flatMap(family =>
  ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].map(method =>
    [method, family.slice(4).replace(':slug', 'studio').replace('/*', '/render')]),
))('gateway inventory %s %s rejects cookies and ordinary Bearer before mutation', async (method, url) => {
  const before = await snapshot();
  for (const credential of [{ cookie: `shop_access=${ordinaryToken}` }, { authorization: `Bearer ${ordinaryToken}` }]) {
    const response = await app.inject({ method: method as 'POST', url, headers: { origin: 'null', ...credential, 'content-type': 'text/plain' },
      ...(['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? { payload: 'simple' } : {}),
    });
    expect([401, 403]).toContain(response.statusCode);
    expect(await snapshot()).toEqual(before);
  }
});
it.each(['/api/v1/products', '/api/v1/cart', '/api/v1/account/profile', '/api/v1/admin/users', '/api/v1/orders'])('rejects plugin credentials at ordinary Core API %s', async url => {
  const response = await app.inject({ url, headers: { authorization: `Bearer ${pluginToken}` } });
  expect(response.statusCode).toBe(403);
  expect(() => JwtUtils.verify(pluginToken)).toThrow('Plugin page tokens cannot authenticate Core APIs');
});
it.each([true, false])('enforces null Origin even with reflection and CORS enabled=%s', async enabled => {
  const isolated = Fastify();
  const effect = vi.fn(() => ({ changed: true }));
  await registerOriginPolicy(isolated, { enabled, origin: true, credentials: true });
  isolated.post('/ordinary', effect);
  const response = await isolated.inject({ method: 'POST', url: '/ordinary', headers: { origin: 'null', 'content-type': 'text/plain' }, payload: 'simple' });
  expect(response.statusCode).toBe(403);
  expect(effect).not.toHaveBeenCalled();
  await isolated.close();
});
it.each(inventory.pluginTokenRoutes)('admits %s only through the plugin-token seam, without cookies or credentialed CORS', async url => {
  const isolated = Fastify();
  const effect = vi.fn(() => ({ changed: true }));
  const verify = vi.fn(async (token: string) => token === pluginToken ? {
    slug: 'studio', installationId: 'installation', zipHash: 'a'.repeat(64), generation: '0',
    surface: 'shop' as const, pageId: 'studio', user: null,
  } : null);
  await registerOriginPolicy(isolated, { enabled: true, origin: true, credentials: true, verifyPluginToken: verify });
  isolated.post(url, async request => {
    expect(request[pluginPageAdmission]?.installationId).toBe('installation');
    return effect();
  });
  const before = await snapshot();
  for (const credentials of [{}, { authorization: `Bearer ${ordinaryToken}` },
    { authorization: `Bearer ${apiToken}` }, { authorization: 'Bearer invalid' },
    { authorization: `Bearer ${pluginToken}`, cookie: '' },
    { authorization: `Bearer ${pluginToken}`, cookie: 'session=private' }]) {
    const response = await isolated.inject({ method: 'POST', url, headers: { origin: 'null', ...credentials } });
    expect([401, 403]).toContain(response.statusCode);
  }
  expect(effect).not.toHaveBeenCalled();
  expect(verify).not.toHaveBeenCalled();
  expect(await snapshot()).toEqual(before);
  const preflight = await isolated.inject({ method: 'OPTIONS', url, headers: { origin: 'null',
    'access-control-request-method': 'POST', 'access-control-request-headers': 'Authorization, Content-Type, Idempotency-Key' } });
  expect(preflight.statusCode).toBe(204);
  expect(preflight.headers['access-control-allow-origin']).toBe('null');
  expect(preflight.headers['access-control-allow-credentials']).toBeUndefined();
  expect(preflight.headers.vary).toBe('Origin');
  expect(verify).not.toHaveBeenCalled();
  const response = await isolated.inject({ method: 'POST', url, headers: { origin: 'null', authorization: `Bearer ${pluginToken}` } });
  expect(response.statusCode, response.body).toBe(200);
  expect(effect).toHaveBeenCalledTimes(1);
  expect(response.headers['access-control-allow-origin']).toBe('null');
  expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  expect(response.headers.vary).toBe('Origin');
  await isolated.close();
});
it.each([true, false])('exposes only cookie-free plugin rejection responses without granting admission, CORS enabled=%s', async enabled => {
  const isolated = Fastify();
  const effect = vi.fn(() => ({ changed: true }));
  const verify = vi.fn(async () => null);
  isolated.addHook('onSend', async (_request, reply, payload) => {
    reply.headers({ Vary: 'Accept-Encoding', 'Access-Control-Allow-Credentials': 'true', 'Set-Cookie': 'session=private' });
    return payload;
  });
  await registerOriginPolicy(isolated, { enabled, origin: true, credentials: true, verifyPluginToken: verify });
  for (const url of inventory.pluginTokenRoutes) isolated.post(url, effect);
  try {
    for (const url of inventory.pluginTokenRoutes) {
      for (const authorization of [undefined, 'Bearer invalid', `Bearer ${ordinaryToken}`, `Bearer ${apiToken}`, `Bearer ${pluginToken}`]) {
        const response = await isolated.inject({ method: 'POST', url,
          headers: { origin: 'null', ...(authorization ? { authorization } : {}), 'content-type': 'text/plain' }, payload: 'simple',
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ success: false, error: { code: 'INVALID_TOKEN' } });
        expect(response.headers['access-control-allow-origin']).toBe('null');
        expect(response.headers['access-control-allow-credentials']).toBeUndefined();
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.headers.vary).toBe('Accept-Encoding, Origin');
        expect(effect).not.toHaveBeenCalled();
      }
      expect(verify).toHaveBeenCalledTimes(1);
      verify.mockClear();
    }
  } finally {
    await isolated.close();
  }
});
it.each([
  ['/api/v1/products', undefined],
  ['/api/v1/extensions/plugin/studio/api-other', undefined],
  ['/api/v1/extensions/plugin/Studio/api', undefined],
  ['/api/v1/plugin-storage/studio', undefined],
  ['/api/v1/extensions/plugin/studio/api', ''],
  ['/api/v1/extensions/plugin/studio/api', 'session=private'],
] as const)('keeps forbidden path or Cookie opaque-origin responses unreadable: %s %s', async (url, cookie) => {
  const isolated = Fastify();
  const effect = vi.fn(() => ({ changed: true }));
  const verify = vi.fn(async () => null);
  await registerOriginPolicy(isolated, { enabled: true, origin: true, credentials: true, verifyPluginToken: verify });
  isolated.post(url, effect);
  try {
    const response = await isolated.inject({ method: 'POST', url,
      headers: { origin: 'null', authorization: `Bearer ${pluginToken}`, ...(cookie !== undefined ? { cookie } : {}) },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(effect).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  } finally {
    await isolated.close();
  }
});
it('rejects a verified token bound to another slug without granting admission', async () => {
  const isolated = Fastify();
  const effect = vi.fn(() => ({ changed: true }));
  await registerOriginPolicy(isolated, { enabled: true, origin: true, credentials: true,
    verifyPluginToken: async () => ({ slug: 'other', installationId: 'instance', zipHash: 'a'.repeat(64), generation: '0', surface: 'shop', pageId: 'studio', user: null }),
  });
  isolated.post('/api/v1/extensions/plugin/studio/api', effect);
  try {
    const response = await isolated.inject({ method: 'POST', url: '/api/v1/extensions/plugin/studio/api',
      headers: { origin: 'null', authorization: `Bearer ${pluginToken}` },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_TOKEN');
    expect(response.headers['access-control-allow-origin']).toBe('null');
    expect(effect).not.toHaveBeenCalled();
  } finally {
    await isolated.close();
  }
});
it('removes credentialed response headers even when a verified plugin handler attempts to set them', async () => {
  const isolated = Fastify();
  await registerOriginPolicy(isolated, { enabled: true, origin: true, credentials: true,
    verifyPluginToken: async () => ({ slug: 'studio', installationId: 'instance', zipHash: 'a'.repeat(64), generation: '0', surface: 'shop', pageId: 'studio', user: null }),
  });
  isolated.post('/api/v1/extensions/plugin/studio/api', async (_request, reply) =>
    reply.headers({ Vary: 'Accept-Encoding, origin', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true', 'Set-Cookie': 'plugin=untrusted' }).send({ accepted: true }));
  const response = await isolated.inject({ method: 'POST', url: '/api/v1/extensions/plugin/studio/api', headers: { origin: 'null', authorization: `Bearer ${pluginToken}` } });
  expect(response.statusCode).toBe(200);
  expect(response.headers['access-control-allow-origin']).toBe('null');
  expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  expect(response.headers['set-cookie']).toBeUndefined();
  expect(response.headers.vary).toBe('Accept-Encoding, origin');
  await isolated.close();
});
it.each(['Cookie', 'X-User-Id', 'X-App-Type'])('rejects non-allowlisted null-origin preflight header %s', async header => {
  const response = await app.inject({ method: 'OPTIONS', url: '/api/v1/extensions/plugin/studio/api',
    headers: { origin: 'null', 'access-control-request-method': 'POST', 'access-control-request-headers': header } });
  expect(response.statusCode).toBe(403);
});
it.each([
  { cookie: 'session=private', 'access-control-request-method': 'POST' },
  { 'access-control-request-method': 'TRACE' },
  { 'access-control-request-method': 'CONNECT' },
  {},
])('rejects credentialed or malformed null-origin preflight: %j', async headers => {
  const response = await app.inject({ method: 'OPTIONS', url: '/api/v1/plugin-storage/studio/files', headers: { origin: 'null', ...headers } });
  expect(response.statusCode).toBe(403);
});
it('ships a verifier seam that rejects all tokens until P-3, without executing a plugin', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/v1/extensions/plugin/studio/api',
    headers: { origin: 'null', authorization: `Bearer ${pluginToken}` } });
  expect(response.statusCode).toBe(401);
});
