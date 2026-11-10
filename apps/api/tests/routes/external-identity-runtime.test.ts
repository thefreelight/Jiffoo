import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken } from '../helpers/auth';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import path from 'node:path';

describe('Installed identity provider runtime and Core account ownership', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;
  const slug = 'identity-runtime-' + randomUUID().slice(0, 8);
  const email = slug + '@example.test';
  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    const admin = await createAdminWithToken(); adminToken = admin.token; adminUserId = admin.user.id;
    const source = `module.exports = { register(ctx) { ctx.contracts.implement('identity', 1, {
      describe: () => ({ ready: Boolean(ctx.config.secret), label: 'Fixture identity', issuer: 'https://identity.fixture.test', callbackMethod: 'POST', pkce: 'none' }),
      authorize: input => ({ outcome: 'ready', authorizationUrl: 'https://identity.fixture.test/authorize?state=' + encodeURIComponent(input.state) }),
      complete: input => input.code === ctx.config.secret && input.nonce ? ({ outcome: 'verified', issuer: 'https://identity.fixture.test', subject: ctx.plugin.slug, email: ctx.config.email, emailVerified: true, displayName: 'Fixture Customer' }) : ({ outcome: 'rejected', code: 'CODE_INVALID' })
    }); } };`;
    await installFixturePlugin({ app, adminToken, adminUserId }, slug, 'identity', [{ name: 'identity', version: 1 }], source, { config: { secret: 'local-only-identity-code', email }, configSchema: { type: 'object', properties: { secret: { type: 'string', sensitive: true }, email: { type: 'string' } } } });
  });
  afterAll(async () => {
    await prisma.identityTransaction.deleteMany({ where: { providerSlug: slug } });
    if (app) { await removeFixturePlugin({ app, adminToken, adminUserId }, slug); await app.close(); }
    await prisma.user.deleteMany({ where: { OR: [{ email }, { id: adminUserId }] } });
  });
  async function start() {
    const binding = randomUUID().replaceAll('-', '') + randomUUID().slice(0, 8);
    const response = await app.inject({ method: 'POST', url: `/api/v1/auth/identity/${slug}/start`, payload: { intent: 'login', returnTo: '/en/account', locale: 'en', browserBinding: binding } });
    expect(response.statusCode, response.payload).toBe(200);
    return { binding, state: new URL(response.json().data.authorizationUrl).searchParams.get('state')! };
  }
  it('uses the installed capability and protected configuration, creates only at the bound exchange', async () => {
    const providers = await app.inject({ method: 'GET', url: '/api/v1/auth/identity/providers' });
    expect(providers.statusCode).toBe(200); expect(providers.json().data.providers).toContainEqual({ slug, label: 'Fixture identity', ready: true });
    const flow = await start();
    const callback = await app.inject({ method: 'POST', url: `/api/v1/auth/identity/${slug}/callback`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams({ state: flow.state, code: 'local-only-identity-code' }).toString() });
    expect(callback.statusCode, callback.payload).toBe(303);
    const location = new URL(callback.headers.location!);
    expect(location.searchParams.has('code')).toBe(false);
    const code = new URLSearchParams(location.hash.slice(1)).get('code'); expect(code).toBeTruthy();
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    const exchange = await app.inject({ method: 'POST', url: '/api/v1/auth/identity/exchange', payload: { code, browserBinding: flow.binding } });
    expect(exchange.statusCode, exchange.payload).toBe(200); expect(exchange.json().data.auth.user.role).toBe('USER');
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } }); expect(stored.password).toBeNull();
    expect(await prisma.externalIdentity.count({ where: { userId: stored.id } })).toBe(1);
  });
  it('rejects an authorization transaction after installation configuration changes', async () => {
    const flow = await start();
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } } });
    const changed = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${instance.id}`, headers: { authorization: `Bearer ${adminToken}` }, payload: { config: { secret: 'changed-local-only-code', email } } });
    expect(changed.statusCode, changed.payload).toBe(200);
    const callback = await app.inject({ method: 'POST', url: `/api/v1/auth/identity/${slug}/callback`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams({ state: flow.state, code: 'local-only-identity-code' }).toString() });
    expect(new URL(callback.headers.location!).searchParams.get('error')).toBe('IDENTITY_UNAVAILABLE');
  });
});
