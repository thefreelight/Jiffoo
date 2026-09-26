import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { loadOpenApiSpec } from '../helpers/openapi';

describe('AUTH-1 administrator route boundary', () => {
  let app: FastifyInstance;
  let customerToken: string;
  const publicGateway = [
    '/api/v1/extensions/plugin/{slug}/api',
    '/api/v1/extensions/plugin/{slug}/api/{*}',
    '/api/v1/extensions/plugin/{slug}/health',
    '/api/v1/extensions/plugin/{slug}/manifest',
  ];

  beforeAll(async () => {
    app = await createTestApp();
    customerToken = (await createUserWithToken()).token;
  });
  afterAll(async () => { await deleteAllTestUsers(); await app.close(); });

  it('A enumerates every registered Admin and extension route and enforces the admin boundary', async () => {
    const spec = loadOpenApiSpec()!;
    const paths = Object.keys(spec.paths).filter((path) =>
      path.startsWith('/api/v1/admin/') || path.startsWith('/api/v1/extensions/'));
    expect(paths.length).toBeGreaterThan(20);
    expect(paths.filter((path) => path.startsWith('/api/v1/extensions/') && publicGateway.includes(path)).sort())
      .toEqual([...publicGateway].sort());
    const known = new Set(publicGateway);
    for (const path of paths) {
      for (const method of Object.keys(spec.paths[path])) {
        if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue;
        if (known.has(path)) continue;
        const url = path.replace('{kind}', 'plugin').replace(/\{[^}]+\}/g, 'test');
        const anonymous = await app.inject({ method: method.toUpperCase(), url });
        expect(anonymous.statusCode, `${method.toUpperCase()} ${path} anonymous`).toBe(401);
        const customer = await app.inject({
          method: method.toUpperCase(), url, headers: { authorization: `Bearer ${customerToken}` },
        });
        expect(customer.statusCode, `${method.toUpperCase()} ${path} customer`).toBe(403);
      }
    }
  });

  it('A public gateway paths remain unauthenticated with exactly the declared exemptions', async () => {
    const spec = loadOpenApiSpec()!;
    const actual = Object.keys(spec.paths).filter((path) =>
      path.startsWith('/api/v1/extensions/') && !Object.values(spec.paths[path]).every((operation) =>
        typeof operation === 'object' && operation !== null && 'security' in operation));
    expect(actual.sort()).toEqual([...publicGateway].sort());
    for (const path of publicGateway) {
      const url = path.replace(/\{[^}]+\}/g, 'test');
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode, path).not.toBe(401);
      expect(response.statusCode, path).not.toBe(403);
    }
  });

  it('H /auth/me never returns fine-grained Admin role or permission fields', async () => {
    const response = await app.inject({
      method: 'GET', url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${customerToken}` },
    });
    expect(response.statusCode).toBe(200);
    for (const field of ['permissions', 'adminRole', 'adminStatus', 'isOwner', 'admin']) {
      expect(response.json().data).not.toHaveProperty(field);
    }
  });

  it('K6 demo login configuration cannot promote a customer or create an administrator', async () => {
    const customer = await createUserWithToken();
    const before = await import('../helpers/db').then(({ getTestPrisma }) => getTestPrisma().user.count({ where: { role: 'ADMIN' } }));
    const previousMode = process.env.JIFFOO_DEMO_MODE;
    const previousEmail = process.env.JIFFOO_DEMO_ADMIN_EMAIL;
    try {
      process.env.JIFFOO_DEMO_MODE = 'true';
      process.env.JIFFOO_DEMO_ADMIN_EMAIL = customer.user.email;
      const response = await app.inject({ method: 'GET', url: '/api/v1/auth/login-config' });
      expect(response.statusCode).toBe(200);
      const { getTestPrisma } = await import('../helpers/db');
      expect((await getTestPrisma().user.findUniqueOrThrow({ where: { id: customer.user.id } })).role).toBe('USER');
      expect(await getTestPrisma().user.count({ where: { role: 'ADMIN' } })).toBe(before);
    } finally {
      if (previousMode === undefined) delete process.env.JIFFOO_DEMO_MODE;
      else process.env.JIFFOO_DEMO_MODE = previousMode;
      if (previousEmail === undefined) delete process.env.JIFFOO_DEMO_ADMIN_EMAIL;
      else process.env.JIFFOO_DEMO_ADMIN_EMAIL = previousEmail;
    }
  });
});
