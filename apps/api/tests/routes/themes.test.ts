import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import archiver from 'archiver';
import { promises as fs } from 'fs';
import path from 'path';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { themePackageStore } from '@/core/storage/plugin-package-store';
import { clearTestThemeCache } from '../helpers/theme-cache';
import { installTheme } from '@/core/admin/extension-installer/theme-service';

const prisma = getTestPrisma();
const suffix = Date.now().toString(36);
const shopSlug = `theme-shop-${suffix}`;
const adminSlug = `theme-admin-${suffix}`;
const builtinSlug = `theme-builtin-${suffix}`;
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const font = Buffer.from('wOF2valid-font');
const manifest = async (target: 'shop' | 'admin', slug: string, version = '1.0.0') => ({
  ...JSON.parse(await fs.readFile(path.join(process.cwd(), 'builtin-themes',
    target === 'shop' ? 'default-shop' : 'default-admin', 'theme.json'), 'utf8')),
  slug, version,
  ...(target === 'admin' ? { assets: { logo: 'assets/logo.png' } } : {}),
});
const archive = async (value: unknown, entries: Array<{ name: string; data: Buffer }> = []) => {
  const zip = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  zip.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    zip.on('end', resolve);
    zip.on('error', reject);
  });
  zip.append(JSON.stringify(value), { name: 'theme.json' });
  for (const entry of entries) zip.append(entry.data, { name: entry.name });
  await zip.finalize();
  await done;
  return Buffer.concat(chunks);
};
const multipart = (bytes: Buffer) => {
  const boundary = `theme-${suffix}`;
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="confirmUnsigned"\r\n\r\ntrue\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="theme.zip"\r\nContent-Type: application/zip\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
};

describe('T1a theme management HTTP', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let customerToken: string;
  let adminId: string;
  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false, enableSwagger: true });
    const admin = await createAdminWithToken();
    adminToken = admin.token;
    adminId = admin.user.id;
    customerToken = (await createUserWithToken()).token;
  });
  afterAll(async () => {
    await prisma.theme.deleteMany({ where: { slug: { in: [shopSlug, adminSlug, builtinSlug] } } });
    await prisma.adminStaffAuditLog.deleteMany({ where: { staffUserId: adminId, action: 'THEME_UNSIGNED_INSTALL_CONFIRMED' } });
    for (const slug of [shopSlug, adminSlug, builtinSlug]) await clearTestThemeCache(slug);
    await deleteAllTestUsers();
    await app.close();
  });
  const upload = async (app: FastifyInstance, token: string, bytes: Buffer) => app.inject({
    method: 'POST', url: '/api/v1/extensions/theme/install',
    headers: { ...multipart(bytes).headers, authorization: `Bearer ${token}` },
    payload: multipart(bytes).payload,
  });

  it('J enumerates theme management routes inside the existing Admin boundary', async () => {
    const spec = app.swagger();
    for (const [method, route] of [
      ['post', '/api/v1/extensions/theme/install'],
      ['get', '/api/v1/extensions/theme'],
      ['get', '/api/v1/extensions/theme/{slug}'],
      ['delete', '/api/v1/extensions/theme/{slug}'],
    ]) {
      expect(spec.paths[route]?.[method]?.security, route).toEqual([{ bearerAuth: [] }]);
      const url = route.replace('{slug}', shopSlug);
      expect((await app.inject({ method: method.toUpperCase(), url })).statusCode).toBe(401);
      expect((await app.inject({
        method: method.toUpperCase(), url,
        headers: { authorization: `Bearer ${customerToken}` },
      })).statusCode).toBe(403);
    }
  });

  it('A installs both targets inactive, lists and describes them', async () => {
    const shop = await upload(app, adminToken, await archive(await manifest('shop', shopSlug)));
    expect(shop.statusCode).toBe(200);
    expect(shop.json().data).toMatchObject({
      slug: shopSlug, target: 'shop', source: 'uploaded', trustLevel: 'unsigned',
    });
    const admin = await upload(app, adminToken, await archive(await manifest('admin', adminSlug), [
      { name: 'assets/logo.png', data: png },
      { name: 'fonts/title.woff2', data: font },
    ]));
    expect(admin.statusCode).toBe(200);
    const list = await app.inject({
      method: 'GET', url: '/api/v1/extensions/theme',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.map((item: { slug: string }) => item.slug))
      .toEqual(expect.arrayContaining([shopSlug, adminSlug]));
    const detail = await app.inject({
      method: 'GET', url: `/api/v1/extensions/theme/${adminSlug}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(detail.json().data).toMatchObject({ slug: adminSlug, target: 'admin', version: '1.0.0' });
    expect(await prisma.theme.count({ where: { slug: { in: [shopSlug, adminSlug] } } })).toBe(2);
  });

  it('F replaces on higher version and conflicts on same or lower version', async () => {
    const higher = await upload(app, adminToken, await archive(await manifest('shop', shopSlug, '1.1.0')));
    expect(higher.statusCode).toBe(200);
    expect(higher.json().data.version).toBe('1.1.0');
    for (const version of ['1.1.0', '1.0.9']) {
      const conflict = await upload(app, adminToken, await archive(await manifest('shop', shopSlug, version)));
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json().error.code).toBe('THEME_VERSION_CONFLICT');
    }
  });

  it('reports real integrity and activation metadata and refuses missing or mismatched archives without mutations', async () => {
    const headers = { authorization: `Bearer ${adminToken}` };
    const record = await prisma.theme.findUniqueOrThrow({ where: { slug: adminSlug } });
    const identity = { themeSlug_packageHash: { themeSlug: adminSlug, packageHash: record.packageHash } };
    const blob = await prisma.themePackageBlob.findUniqueOrThrow({ where: identity });
    const detail = () => app.inject({ url: `/api/v1/extensions/theme/${adminSlug}`, headers });
    const listed = async () => (await app.inject({ url: '/api/v1/extensions/theme', headers })).json().data.find((item: { slug: string }) => item.slug === adminSlug);
    const priorActive = await prisma.themeActive.findUnique({ where: { target: 'admin' } });
    const historyBefore = await prisma.themeActivation.count();
    const auditBefore = await prisma.adminAuditEvent.count();
    expect((await detail()).json().data).toMatchObject({ activatedAt: null, packageState: { status: 'available', code: null } });
    expect(await listed()).toMatchObject({ activatedAt: null, packageState: { status: 'available', code: null } });
    try {
      for (const missing of [false, true]) {
        if (missing) await prisma.themePackageBlob.delete({ where: identity });
        else await prisma.themePackageBlob.update({ where: identity, data: { sizeBytes: blob.sizeBytes + 1 } });
        const code = missing ? 'THEME_PACKAGE_UNAVAILABLE' : 'THEME_PACKAGE_CORRUPT';
        const state = { status: missing ? 'unavailable' : 'corrupt', code };
        expect((await detail()).json().data.packageState).toEqual(state);
        expect((await listed()).packageState).toEqual(state);
        const response = await app.inject({ method: 'POST', url: '/api/v1/extensions/themes/admin/activate', headers, payload: { slug: adminSlug } });
        expect(response.json().error.code).toBe(code);
        expect(await prisma.themeActive.findUnique({ where: { target: 'admin' } })).toEqual(priorActive);
        expect(await prisma.themeActivation.count()).toBe(historyBefore);
        expect(await prisma.adminAuditEvent.count()).toBe(auditBefore);
      }
    } finally { await prisma.themePackageBlob.upsert({ where: identity, create: blob, update: { bytes: blob.bytes, sizeBytes: blob.sizeBytes } }); }
    const activated = await app.inject({ method: 'POST', url: '/api/v1/extensions/themes/admin/activate', headers, payload: { slug: adminSlug } });
    expect(activated.statusCode).toBe(200);
    const active = await prisma.themeActive.findUniqueOrThrow({ where: { target: 'admin' } });
    expect((await detail()).json().data.activatedAt).toBe(active.updatedAt.toISOString());
    expect((await listed()).activatedAt).toBe(active.updatedAt.toISOString());
    await prisma.themeActive.delete({ where: { target: 'admin' } });
    if (priorActive) await prisma.themeActive.create({ data: priorActive });
    await prisma.themeActivation.deleteMany({ where: { slug: adminSlug } });
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: adminSlug, action: 'theme.activate' } });
  });

  it('reports intact built-in packages using their local package marker', async () => {
    await installTheme(await archive(await manifest('shop', builtinSlug)), { source: 'builtin' });
    const headers = { authorization: `Bearer ${adminToken}` };
    const detail = await app.inject({ url: `/api/v1/extensions/theme/${builtinSlug}`, headers });
    expect(detail.json().data.packageState).toEqual({ status: 'available', code: null });
    const list = await app.inject({ url: '/api/v1/extensions/theme', headers });
    expect(list.json().data.find((item: { slug: string }) => item.slug === builtinSlug).packageState).toEqual({ status: 'available', code: null });
    await prisma.theme.delete({ where: { slug: builtinSlug } });
    await clearTestThemeCache(builtinSlug);
  });

  it('refuses restoring a theme with corrupt metadata without changing active state or history', async () => {
    const record = await prisma.theme.findUniqueOrThrow({ where: { slug: adminSlug } });
    const where = { themeSlug_packageHash: { themeSlug: adminSlug, packageHash: record.packageHash } };
    const blob = await prisma.themePackageBlob.findUniqueOrThrow({ where });
    const prior = await prisma.themeActive.findUnique({ where: { target: 'admin' } });
    const entry = await prisma.themeActivation.create({ data: { target: 'admin', slug: adminSlug, packageHash: record.packageHash, actorId: adminId } });
    try {
      await prisma.themePackageBlob.update({ where, data: { sizeBytes: blob.sizeBytes + 1 } });
      const before = await prisma.themeActivation.count();
      const audits = await prisma.adminAuditEvent.count();
      const response = await app.inject({ method: 'POST', url: '/api/v1/extensions/themes/admin/restore-previous', headers: { authorization: `Bearer ${adminToken}` } });
      expect(response.json().error.code).toBe('THEME_PACKAGE_CORRUPT');
      expect(await prisma.themeActive.findUnique({ where: { target: 'admin' } })).toEqual(prior);
      expect(await prisma.themeActivation.count()).toBe(before);
      expect(await prisma.adminAuditEvent.count()).toBe(audits);
    } finally {
      await prisma.themePackageBlob.update({ where, data: { sizeBytes: blob.sizeBytes } });
      await prisma.themeActivation.delete({ where: { id: entry.id } });
    }
  });

  it('H serves validated images/fonts with content type, nosniff and immutable cache, not unknown files', async () => {
    const hash = (await prisma.theme.findUniqueOrThrow({ where: { slug: adminSlug } })).packageHash;
    for (const [file, type] of [
      ['assets/logo.png', 'image/png'], ['fonts/title.woff2', 'font/woff2'],
    ]) {
      const response = await app.inject({ method: 'GET', url: `/api/v1/themes/${adminSlug}/${hash}/${file}` });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain(type);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['cache-control']).toContain('immutable');
    }
    for (const file of ['assets/other.png', 'assets/../theme.json']) {
      const response = await app.inject({ method: 'GET', url: `/api/v1/themes/${adminSlug}/${hash}/${file}` });
      expect([400, 404]).toContain(response.statusCode);
    }
  });

  it('G deletes the theme and blobs without deleting immutable local caches, but rejects builtin uninstallation', async () => {
    const hash = (await prisma.theme.findUniqueOrThrow({ where: { slug: shopSlug } })).packageHash;
    expect(await themePackageStore.get(shopSlug, hash)).not.toBeNull();
    await prisma.theme.create({
      data: {
        slug: builtinSlug, version: '1.0.0', target: 'admin', name: 'Builtin',
        manifestJson: await manifest('admin', builtinSlug), packageHash: 'builtin',
        source: 'builtin', trustLevel: 'builtin',
      },
    });
    const headers = { authorization: `Bearer ${adminToken}` };
    const blocked = await app.inject({ method: 'DELETE', url: `/api/v1/extensions/theme/${builtinSlug}`, headers });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe('THEME_BUILTIN_CONFLICT');
    const removed = await app.inject({ method: 'DELETE', url: `/api/v1/extensions/theme/${shopSlug}`, headers });
    expect(removed.statusCode).toBe(200);
    expect(await prisma.theme.findUnique({ where: { slug: shopSlug } })).toBeNull();
    expect(await prisma.themePackageBlob.count({ where: { themeSlug: shopSlug } })).toBe(0);
    expect(await themePackageStore.get(shopSlug, hash)).not.toBeNull();
    expect((await app.inject({ url: `/api/v1/themes/${shopSlug}/${hash}/assets/logo.png` })).statusCode).toBe(404);
  });
});
