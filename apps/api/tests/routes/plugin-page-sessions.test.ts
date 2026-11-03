import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { buildApp } from '@/server';
import { getTestPrisma } from '../helpers/db';
import { createUserWithToken } from '../helpers/auth';
import { pageFiles, pageManifest, pageZip } from '../fixtures/plugin-pages';
import { PAGE_SESSION_ABSOLUTE_LIFETIME_MS, pageTokenSecret, verifyPluginPageToken } from '@/core/plugin-pages/sessions';
import { JwtUtils } from '@/utils/jwt';
import { prisma as corePrisma } from '@/config/database';
import { bindPurchaseOrigin, purchaseReturnTarget } from '@/core/plugin-pages/purchase-origins';
import { orderRequestFingerprint } from '@/core/order/idempotency';

const prisma = getTestPrisma();
const slug = 'p3-session-fixture';
const origin = 'http://localhost:3003';
const manifest = pageManifest(slug);
delete manifest.serviceDependencies;
delete manifest.services;
delete manifest.tasks;
manifest.ui!.storefrontPages.push({ ...manifest.ui!.storefrontPages[0], id: 'public', path: '/', requiresLogin: false });
let app: Awaited<ReturnType<typeof buildApp>>;
let installationId: string;
let customer: Awaited<ReturnType<typeof createUserWithToken>>;
let admin: Awaited<ReturnType<typeof createUserWithToken>>;
const headers = (token?: string, shellOrigin = origin) => ({ origin: shellOrigin, ...(token ? { authorization: `Bearer ${token}` } : {}) });
const create = (token?: string, surface = 'shop', pageId = 'studio') => app.inject({ method: 'POST', url: `/api/v1/plugin-pages/${slug}/session`,
  headers: headers(token, surface === 'admin' ? 'http://localhost:3002' : origin), payload: { surface, pageId } });
const admission = (token: string) => verifyPluginPageToken(token, {} as FastifyRequest, slug);

function separateProcessAdmission(token: string) {
  const script = `const { prisma } = require('./src/config/database');
    const { verifyPluginPageToken } = require('./src/core/plugin-pages/sessions');
    verifyPluginPageToken(require('node:fs').readFileSync(0, 'utf8'), {}, '${slug}')
      .then(result => console.log('PAGE_ADMISSION:' + Boolean(result)), error => console.log('PAGE_ADMISSION:' + error.code))
      .finally(() => prisma.$disconnect());`;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
    cwd: process.cwd(), env: process.env, input: token, encoding: 'utf8', windowsHide: true, timeout: 15_000,
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.match(/PAGE_ADMISSION:([^\r\n]+)/)?.[1];
}

beforeAll(async () => {
  vi.stubEnv('STOREFRONT_URL', origin); vi.stubEnv('ADMIN_URL', 'http://localhost:3002');
  app = await buildApp();
  customer = await createUserWithToken(); admin = await createUserWithToken({ role: 'ADMIN' });
  const bytes = await pageZip(pageFiles(manifest));
  const zipHash = createHash('sha256').update(bytes).digest('hex');
  await prisma.pluginInstall.create({ data: { slug, name: manifest.name, version: manifest.version,
    manifestJson: JSON.parse(JSON.stringify(manifest)), zipHash, source: 'local-zip', entryModule: manifest.entryModule,
    packageBlobs: { create: { zipHash, bytes, sizeBytes: bytes.length } } } });
  installationId = (await prisma.pluginInstallation.create({ data: { pluginSlug: slug, instanceKey: 'default', enabled: true } })).id;
});
afterAll(async () => { await prisma.pluginInstall.deleteMany({ where: { slug } }); await app?.close(); vi.unstubAllEnvs(); });

it('public declarations contain only storefront navigation fields and no identity or executable metadata', async () => {
  const response = await app.inject('/api/v1/plugin-pages');
  expect(response.statusCode).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  const plugin = response.json().data.find((item: { slug: string }) => item.slug === slug);
  expect(plugin.pages).toHaveLength(2);
  expect(Object.keys(plugin).sort()).toEqual(['pages', 'slug']);
  expect(Object.keys(plugin.pages[0]).sort()).toEqual(['id', 'path', 'placements', 'requiresLogin', 'title']);
  expect(response.body).not.toContain(customer.user.email);
  expect(response.body).not.toContain('reports');
});
it('issues a dedicated 120-second typed token and exposes only the selected identity', async () => {
  const response = await create(customer.token);
  expect(response.statusCode, response.body).toBe(200);
  const data = response.json().data;
  const decoded = jwt.verify(data.pluginToken, pageTokenSecret(), { algorithms: ['HS256'], complete: true });
  expect(decoded.header.typ).toBe('plugin-page-v1');
  const claims = decoded.payload as jwt.JwtPayload;
  expect(claims.exp! - claims.iat!).toBe(120);
  expect(claims.sub).toBe(customer.user.id);
  expect(claims.generation).toMatch(/^\d+$/);
  expect(data.context.customer).toMatchObject({ id: customer.user.id, email: customer.user.email });
  expect(data.context.admin).toBeNull(); expect(data.guestSecret).toBeNull();
  expect(response.body).not.toContain('password');
  expect(data.frameUrl).not.toContain(data.pluginToken);
  expect(data.frameUrl).not.toContain('guestSecret');
  expect((await admission(data.pluginToken))?.user?.email).toBe(customer.user.email);
  expect(() => JwtUtils.verify(data.pluginToken)).toThrow();
  expect((await app.inject({ url: '/api/v1/account/profile', headers: { authorization: `Bearer ${data.pluginToken}` } })).statusCode).toBe(403);
});
it.each([undefined, 'null', 'http://localhost:3002', 'https://evil.example', `${origin}/`])('refuses issuance from origin %s', async value => {
  const response = await app.inject({ method: 'POST', url: `/api/v1/plugin-pages/${slug}/session`,
    headers: { ...(value === undefined ? {} : { origin: value }), authorization: `Bearer ${customer.token}` }, payload: { surface: 'shop', pageId: 'studio' } });
  expect(response.statusCode).toBe(403);
});
it('rejects cookies, malformed/refresh credentials and cross-surface identity', async () => {
  for (const token of ['broken', 'jiffoo_invalid', JwtUtils.signRefresh({ userId: customer.user.id, sv: 0 })]) {
    expect((await create(token)).statusCode).toBe(401);
  }
  expect((await create(admin.token)).statusCode).toBe(403);
  expect((await create(customer.token, 'admin', 'reports')).statusCode).toBe(403);
  expect((await app.inject({ method: 'POST', url: `/api/v1/plugin-pages/${slug}/session`, headers: { ...headers(customer.token), cookie: 'identity=untrusted' }, payload: { surface: 'shop', pageId: 'studio' } })).statusCode).toBe(403);
});
it('guest refresh needs the shell-only secret and never supplies a customer principal', async () => {
  expect((await create()).statusCode).toBe(401);
  const response = await create(undefined, 'shop', 'public');
  expect(response.statusCode, response.body).toBe(200);
  const data = response.json().data;
  expect(data.context.customer).toBeNull(); expect(data.context.admin).toBeNull();
  expect(data.guestSecret).toHaveLength(43);
  expect((await admission(data.pluginToken))?.user).toBeNull();
  const row = await prisma.pluginPageSession.findUniqueOrThrow({ where: { id: data.sessionId } });
  expect(row.guestSecretHash).not.toBe(data.guestSecret);
  for (const body of [{}, { guestSecret: 'a'.repeat(43) }]) {
    expect((await app.inject({ method: 'POST', url: `/api/v1/plugin-pages/${slug}/sessions/${data.sessionId}/refresh`, headers: headers(), payload: body })).statusCode).toBe(401);
  }
  const refreshed = await app.inject({ method: 'POST', url: `/api/v1/plugin-pages/${slug}/sessions/${data.sessionId}/refresh`, headers: headers(), payload: { guestSecret: data.guestSecret } });
  expect(refreshed.statusCode, refreshed.body).toBe(200);
  expect(refreshed.json().data.pluginToken).not.toBe(data.pluginToken);
});
it('Admin declarations and sessions require ordinary Admin credentials', async () => {
  const response = await app.inject({ url: `/api/v1/admin/plugin-pages/${slug}`, headers: headers(admin.token, 'http://localhost:3002') });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json().data[0].pages[0].id).toBe('reports');
  const session = await create(admin.token, 'admin', 'reports');
  expect(session.statusCode, session.body).toBe(200);
  expect(session.json().data.context.customer).toBeNull();
  expect(session.json().data.context.admin.id).toBe(admin.user.id);
  expect((await admission(session.json().data.pluginToken))?.surface).toBe('admin');
});
it('current package, generation, identity version and explicit revocation invalidate an unexpired token', async () => {
  const response = await create(customer.token);
  const data = response.json().data;
  await prisma.pluginPageSession.update({ where: { id: data.sessionId }, data: { revokedAt: new Date() } });
  await expect(admission(data.pluginToken)).rejects.toMatchObject({ code: 'PLUGIN_PAGE_SESSION_REVOKED' });
  const second = (await create(customer.token)).json().data;
  await prisma.pluginInstallation.update({ where: { id: installationId }, data: { protectionGeneration: { increment: 1 } } });
  await expect(admission(second.pluginToken)).rejects.toMatchObject({ code: 'PLUGIN_PAGE_SESSION_REVOKED' });
  const third = (await create(customer.token)).json().data;
  await prisma.user.update({ where: { id: customer.user.id }, data: { sessionVersion: { increment: 1 } } });
  await expect(admission(third.pluginToken)).rejects.toMatchObject({ code: 'PLUGIN_PAGE_SESSION_REVOKED' });
  await prisma.user.update({ where: { id: customer.user.id }, data: { sessionVersion: 0 } });
});
it('signed claims cannot substitute a sibling session, surface or scope', async () => {
  const data = (await create(customer.token)).json().data;
  const claims = jwt.decode(data.pluginToken) as jwt.JwtPayload;
  for (const change of [{ sid: randomUUID() }, { surface: 'admin' }, { generation: '999999' }, { scopes: ['gateway:invoke'] }, { aud: ['jiffoo-plugin-gateway', 'other'] }]) {
    const forged = jwt.sign({ ...claims, ...change }, pageTokenSecret(), { algorithm: 'HS256', header: { alg: 'HS256', typ: 'plugin-page-v1' } });
    expect(await admission(forged)).toBeNull();
  }
});
it('logout revokes persisted sessions and prevents an old Core token creating a replacement', async () => {
  const user = await createUserWithToken();
  const data = (await create(user.token)).json().data;
  expect(separateProcessAdmission(data.pluginToken)).toBe('true');
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: headers(user.token), payload: {} });
  expect(response.statusCode, response.body).toBe(200);
  expect((await prisma.pluginPageSession.findUniqueOrThrow({ where: { id: data.sessionId } })).revokedAt).not.toBeNull();
  await expect(admission(data.pluginToken)).rejects.toMatchObject({ code: 'PLUGIN_PAGE_SESSION_REVOKED' });
  expect(separateProcessAdmission(data.pluginToken)).toBe('PLUGIN_PAGE_SESSION_REVOKED');
  expect((await create(user.token)).statusCode).toBe(401);
});
it('requires a dedicated strong canonical secret', () => {
  const previous = process.env.PLUGIN_PAGE_TOKEN_SECRET;
  try {
    for (const value of ['', 'weak', Buffer.alloc(32, 17).toString('base64'), `${previous}\n`]) {
      process.env.PLUGIN_PAGE_TOKEN_SECRET = value;
      expect(() => pageTokenSecret()).toThrow('dedicated strong base64');
    }
  } finally { process.env.PLUGIN_PAGE_TOKEN_SECRET = previous; }
});

it('a lifecycle disable transaction revokes Shop, Admin and guest sessions together', async () => {
  const sessions = await Promise.all([create(customer.token), create(admin.token, 'admin', 'reports'), create(undefined, 'shop', 'public')]);
  for (const response of sessions) expect(response.statusCode, response.body).toBe(200);
  const disabled = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${installationId}`,
    headers: { authorization: `Bearer ${admin.token}` }, payload: { enabled: false } });
  try {
    expect(disabled.statusCode, disabled.body).toBe(200);
    for (const response of sessions) {
      const data = response.json().data;
      expect((await prisma.pluginPageSession.findUniqueOrThrow({ where: { id: data.sessionId } })).revokedAt).not.toBeNull();
      await expect(admission(data.pluginToken)).rejects.toMatchObject({ code: 'PLUGIN_PAGE_SESSION_REVOKED' });
    }
    expect((await app.inject({ url: `/api/v1/admin/plugin-pages/${slug}`, headers: headers(admin.token, 'http://localhost:3002') })).statusCode).toBe(404);
  } finally {
    await prisma.pluginInstallation.update({ where: { id: installationId }, data: { enabled: true } });
  }
});

it('purchase attribution rejects arbitrary paths and binds once to an order owned by its customer', async () => {
  const endpoint = `/api/v1/plugin-pages/${slug}/purchase-origins`;
  for (const path of ['//evil.example', '/studio?next=evil', '/%2e%2e', '/other']) {
    expect((await app.inject({ method: 'POST', url: endpoint, headers: headers(customer.token), payload: { pageId: 'studio', path } })).statusCode).toBe(400);
  }
  const response = await app.inject({ method: 'POST', url: endpoint, headers: headers(customer.token), payload: { pageId: 'studio', path: '/studio' } });
  expect(response.statusCode, response.body).toBe(200);
  const id = response.json().data.id;
  const createOrder = () => prisma.order.create({ data: { orderNumber: `JF-20261022-${Date.now()}${Math.floor(Math.random() * 10000)}`,
    userId: customer.user.id, subtotalAmount: 1, totalAmount: 1 } });
  const first = await createOrder(), second = await createOrder();
  try {
    await expect(corePrisma.$transaction(tx => bindPurchaseOrigin(tx, id, admin.user.id, first.id))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await corePrisma.$transaction(tx => bindPurchaseOrigin(tx, id, customer.user.id, first.id));
    await expect(corePrisma.$transaction(tx => bindPurchaseOrigin(tx, id, customer.user.id, second.id))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await purchaseReturnTarget(first.id, customer.user.id)).toEqual({ path: `/apps/${slug}/studio`, title: manifest.ui!.storefrontPages[0].title });
    expect(await purchaseReturnTarget(first.id, admin.user.id)).toBeUndefined();
    expect(orderRequestFingerprint({ pluginPurchaseOriginId: id })).not.toBe(orderRequestFingerprint({ pluginPurchaseOriginId: randomUUID() }));
    await prisma.pluginInstallation.update({ where: { id: installationId }, data: { enabled: false } });
    expect(await purchaseReturnTarget(first.id, customer.user.id)).toBeUndefined();
  } finally {
    await prisma.pluginInstallation.update({ where: { id: installationId }, data: { enabled: true } });
    await prisma.order.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  }
});

it('concurrent orders cannot both consume one purchase origin', async () => {
  const response = await app.inject({ method: 'POST', url: `/api/v1/plugin-pages/${slug}/purchase-origins`,
    headers: headers(customer.token), payload: { pageId: 'studio', path: '/studio' } });
  expect(response.statusCode, response.body).toBe(200);
  const id = response.json().data.id;
  const orders = await Promise.all([0, 1].map(() => prisma.order.create({ data: {
    orderNumber: `JF-RACE-${randomUUID()}`, userId: customer.user.id, subtotalAmount: 1, totalAmount: 1,
  } })));
  try {
    const outcomes = await Promise.allSettled(orders.map(order => corePrisma.$transaction(tx => bindPurchaseOrigin(tx, id, customer.user.id, order.id))));
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toEqual([expect.objectContaining({ reason: expect.objectContaining({ code: 'VALIDATION_ERROR' }) })]);
    const bound = await prisma.pluginPurchaseOrigin.findUniqueOrThrow({ where: { id } });
    expect(orders.map(order => order.id)).toContain(bound.orderId);
  } finally { await prisma.order.deleteMany({ where: { id: { in: orders.map(order => order.id) } } }); }
});

describe('the idle window of a page session', () => {
  const minute = 60_000;
  const refresh = (sessionId: string, token?: string, body: Record<string, unknown> = {}) => app.inject({ method: 'POST',
    url: `/api/v1/plugin-pages/${slug}/sessions/${sessionId}/refresh`, headers: headers(token), payload: body });
  const row = (sessionId: string) => prisma.pluginPageSession.findUniqueOrThrow({ where: { id: sessionId } });
  const moveClockTo = (sessionId: string, remainingMs: number) => prisma.pluginPageSession.update({ where: { id: sessionId },
    data: { expiresAt: new Date(Date.now() + remainingMs) } });

  it('renews the window of a live session across minutes 27, 28, 29 and 30', async () => {
    const data = (await create(customer.token)).json().data;
    const before = await row(data.sessionId);
    // The window of the session runs out at minute 30. The shell refreshes
    // every minute, so the window is three minutes left at minute 27, two at
    // minute 28, one at minute 29 and none at minute 30.
    for (const remaining of [3 * minute, 2 * minute, 60_000, -1000]) {
      await moveClockTo(data.sessionId, remaining);
      const response = await refresh(data.sessionId, customer.token);
      expect(response.statusCode, response.body).toBe(200);
      const renewed = await row(data.sessionId);
      expect(renewed.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * minute);
      expect(renewed.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 31 * minute);
      expect(renewed.revokedAt).toBeNull();
      expect(renewed.createdAt).toEqual(before.createdAt);
      // The renewed token is usable: the admission still holds.
      expect((await admission(response.json().data.pluginToken))?.user?.email).toBe(customer.user.email);
    }
    // Several renewal periods: the window keeps sliding and never crosses
    // the absolute lifetime.
    for (let period = 0; period < 3; period += 1) {
      await moveClockTo(data.sessionId, -1000);
      const response = await refresh(data.sessionId, customer.token);
      expect(response.statusCode, response.body).toBe(200);
      const renewed = await row(data.sessionId);
      expect(renewed.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * minute);
      expect(renewed.expiresAt.getTime()).toBeLessThanOrEqual(before.createdAt.getTime() + PAGE_SESSION_ABSOLUTE_LIFETIME_MS);
    }
  });

  it('renews under concurrency, without a deadlock between two refreshes', async () => {
    const data = (await create(customer.token)).json().data;
    await moveClockTo(data.sessionId, -1000);
    const outcomes = await Promise.allSettled([
      refresh(data.sessionId, customer.token),
      refresh(data.sessionId, customer.token),
    ]);
    expect(outcomes.map(outcome => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
    for (const outcome of outcomes) expect(outcome.status === 'fulfilled' ? outcome.value.statusCode : 0).toBe(200);
    const renewed = await row(data.sessionId);
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * minute);
    expect(renewed.revokedAt).toBeNull();
    // A revocation that reaches the session at the same moment as a renewal
    // is never overwritten, and the renewal never resurrects the session.
    await moveClockTo(data.sessionId, -1000);
    await Promise.allSettled([
      refresh(data.sessionId, customer.token),
      prisma.pluginPageSession.update({ where: { id: data.sessionId }, data: { revokedAt: new Date() } }),
    ]);
    expect((await row(data.sessionId)).revokedAt).not.toBeNull();
    const afterwards = await refresh(data.sessionId, customer.token);
    expect(afterwards.statusCode).toBe(401);
  });

  it('renews a guest window on the strength of the shell secret', async () => {
    const data = (await create(undefined, 'shop', 'public')).json().data;
    await moveClockTo(data.sessionId, -1000);
    expect((await refresh(data.sessionId, undefined, { guestSecret: 'a'.repeat(43) })).statusCode).toBe(401);
    const response = await refresh(data.sessionId, undefined, { guestSecret: data.guestSecret });
    expect(response.statusCode, response.body).toBe(200);
    const renewed = await row(data.sessionId);
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * minute);
    expect((await admission(response.json().data.pluginToken))?.user).toBeNull();
  });

  it('keeps the identity, the origin and the generation checks of the renewal', async () => {
    const data = (await create(customer.token)).json().data;
    await moveClockTo(data.sessionId, -1000);
    expect((await refresh(data.sessionId)).statusCode).toBe(401);
    expect((await refresh(data.sessionId, admin.token)).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: `/api/v1/plugin-pages/${slug}/sessions/${data.sessionId}/refresh`,
      headers: headers(customer.token, 'http://localhost:3002'), payload: {} })).statusCode).toBe(403);
    const stillLapsed = await row(data.sessionId);
    expect(stillLapsed.expiresAt.getTime()).toBeLessThan(Date.now());
    await prisma.pluginInstallation.update({ where: { id: installationId }, data: { protectionGeneration: { increment: 1 } } });
    const response = await refresh(data.sessionId, customer.token);
    expect(response.statusCode).toBe(401);
    expect((await row(data.sessionId)).expiresAt.getTime()).toBeLessThan(Date.now());
    // The gateway refuses the admission of the token of a session that fell
    // behind its window. A live session never reaches this state: the shell
    // renews the window before it can.
    expect(await admission(data.pluginToken)).toBeNull();
  });

  it('stops the renewal at the absolute lifetime of the session', async () => {
    const data = (await create(customer.token)).json().data;
    // The absolute lifetime is over: the session cannot be renewed.
    await prisma.pluginPageSession.update({ where: { id: data.sessionId }, data: {
      createdAt: new Date(Date.now() - PAGE_SESSION_ABSOLUTE_LIFETIME_MS - minute), expiresAt: new Date(Date.now() - 1000) } });
    const over = await refresh(data.sessionId, customer.token);
    expect(over.statusCode).toBe(401);
    expect(over.json().error.code).toBe('PLUGIN_PAGE_SESSION_EXPIRED');
    expect((await row(data.sessionId)).expiresAt.getTime()).toBeLessThan(Date.now());
    // The absolute lifetime leaves less than the two minutes a token needs:
    // the session ends as well.
    await prisma.pluginPageSession.update({ where: { id: data.sessionId }, data: {
      createdAt: new Date(Date.now() - PAGE_SESSION_ABSOLUTE_LIFETIME_MS + minute), expiresAt: new Date(Date.now() - 1000) } });
    const narrow = await refresh(data.sessionId, customer.token);
    expect(narrow.statusCode).toBe(401);
    expect(narrow.json().error.code).toBe('PLUGIN_PAGE_SESSION_EXPIRED');
    // A revoked session is never renewed either.
    const revoked = new Date(Date.now() - minute);
    await prisma.pluginPageSession.update({ where: { id: data.sessionId }, data: { revokedAt: revoked, expiresAt: new Date(Date.now() - 1000) } });
    const response = await refresh(data.sessionId, customer.token);
    expect(response.statusCode).toBe(401);
    const unchanged = await row(data.sessionId);
    expect(unchanged.revokedAt).toEqual(revoked);
    expect(unchanged.expiresAt.getTime()).toBeLessThan(Date.now());
  });
});
