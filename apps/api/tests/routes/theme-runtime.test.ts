import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import archiver from 'archiver';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { themePackageStore } from '@/core/storage/plugin-package-store';
import { syncBuiltinThemes } from '@/core/admin/extension-installer/builtin-theme-sync';
import { themeTokensToCss } from '@jiffoo/shared';

const prisma = getTestPrisma();
const suffix = Date.now().toString(36);
const slug = `runtime-${suffix}`;
const second = `other-${suffix}`;
const adminSlug = `backoffice-${suffix}`;
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const font = Buffer.from('wOF2sample');
const local = { en: 'Hello', 'zh-Hans': '你好', 'zh-Hant': '你好' };
const headers = (token: string) => ({ authorization: `Bearer ${token}` });
const root = path.join(process.cwd(), 'builtin-themes');
const base = async (name = slug, version = '1.0.0') => ({
  ...JSON.parse(await fs.readFile(path.join(root, 'default-shop', 'theme.json'), 'utf8')),
  slug: name, version,
  tokens: { primary: '#123456', 'font-body': 'title' },
  fonts: [{ id: 'title', family: 'Theme Title', file: 'fonts/title.woff2', weight: 400, style: 'normal', license: 'MIT' }],
  assets: {},
  settings: [
    { id: 'color', type: 'color', label: local, default: '#123456', constraints: {}, bindsToken: 'primary' },
    { id: 'caption', type: 'text', label: local, default: local, constraints: { maxLength: 30 } },
    { id: 'picture', type: 'image', label: local, default: 'assets/hero.png', constraints: {} },
    { id: 'category', type: 'category', label: local, default: 'existing', constraints: {} },
    { id: 'products', type: 'product-list', label: local, default: [], constraints: { maxItems: 3 } },
    { id: 'quantity', type: 'number', label: local, default: 1, constraints: { min: 0, max: 10, step: 1 } },
  ],
  layout: {
    ...JSON.parse(await fs.readFile(path.join(root, 'default-shop', 'theme.json'), 'utf8')).layout,
    pages: {
      ...JSON.parse(await fs.readFile(path.join(root, 'default-shop', 'theme.json'), 'utf8')).layout.pages,
      home: { sections: [{ id: 'hero', type: 'hero-banner', settings: {
        title: { $setting: 'caption' }, image: { $setting: 'picture' },
      } }] },
    },
  },
});
async function zip(manifest: unknown) {
  const pack = archiver('zip');
  const chunks: Buffer[] = [];
  pack.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => { pack.on('end', resolve); pack.on('error', reject); });
  pack.append(JSON.stringify(manifest), { name: 'theme.json' });
  pack.append(png, { name: 'assets/hero.png' });
  pack.append(font, { name: 'fonts/title.woff2' });
  await pack.finalize();
  await done;
  return Buffer.concat(chunks);
}
function multipart(bytes: Buffer) {
  const boundary = `theme-${suffix}`;
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="confirmUnsigned"\r\n\r\ntrue\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="theme.zip"\r\nContent-Type: application/zip\r\n\r\n`),
      bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}

describe('T1b theme runtime', () => {
  let app: FastifyInstance;
  let token: string;
  let customer: string;
  let actorId: string;
  const admin = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: headers(token), payload });
  const upload = async (manifest: unknown) => {
    const body = multipart(await zip(manifest));
    return app.inject({ method: 'POST', url: '/api/v1/extensions/theme/install',
      headers: { ...body.headers, ...headers(token) }, payload: body.payload });
  };
  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false, enableSwagger: true });
    const actor = await createAdminWithToken();
    token = actor.token;
    actorId = actor.user.id;
    customer = (await createUserWithToken()).token;
  });
  afterAll(async () => {
    await prisma.themeActive.deleteMany({ where: { slug: { in: [slug, second, adminSlug, 'default-shop', 'default-admin'] } } });
    await prisma.themeActivation.deleteMany({ where: { slug: { in: [slug, second, adminSlug, 'default-shop', 'default-admin'] } } });
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: { in: [slug, second, adminSlug, 'default-shop', 'default-admin'] } } });
    await prisma.theme.deleteMany({ where: { slug: { in: [slug, second, adminSlug, 'default-shop', 'default-admin'] } } });
    await prisma.adminStaffAuditLog.deleteMany({ where: { staffUserId: actorId, action: 'THEME_UNSIGNED_INSTALL_CONFIRMED' } });
    for (const name of [slug, second, adminSlug, 'default-shop', 'default-admin']) await themePackageStore.delete(name);
    await deleteAllTestUsers();
    await app.close();
  });

  it('A synchronizes builtin themes and does not override a chosen target on restart', async () => {
    await syncBuiltinThemes(root);
    expect(await prisma.themeActive.findUnique({ where: { target: 'shop' } })).toMatchObject({ slug: 'default-shop' });
    expect(await prisma.themeActive.findUnique({ where: { target: 'admin' } })).toMatchObject({ slug: 'default-admin' });
    const installed = await upload(await base());
    expect(installed.statusCode, installed.body).toBe(200);
    expect((await admin('POST', '/api/v1/extensions/themes/shop/activate', { slug })).statusCode).toBe(200);
    await syncBuiltinThemes(root);
    expect((await prisma.themeActive.findUnique({ where: { target: 'shop' } }))?.slug).toBe(slug);
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-builtin-'));
    try {
      const directory = path.join(temp, 'default-shop');
      await fs.mkdir(directory);
      const manifest = JSON.parse(await fs.readFile(path.join(root, 'default-shop', 'theme.json'), 'utf8'));
      manifest.version = '1.1.1';
      await fs.writeFile(path.join(directory, 'theme.json'), JSON.stringify(manifest));
      await syncBuiltinThemes(temp);
      expect((await prisma.theme.findUnique({ where: { slug: 'default-shop' } }))?.version).toBe('1.1.1');
      expect((await prisma.themeActive.findUnique({ where: { target: 'shop' } }))?.slug).toBe(slug);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it('B/C activates atomically, rejects target mismatch, and restores previous', async () => {
    const count = await prisma.adminAuditEvent.count({ where: { action: 'theme.activate', targetId: slug } });
    expect(count).toBe(1);
    expect(await prisma.themeActivation.count({ where: { target: 'shop', slug } })).toBe(1);
    const mismatch = await admin('POST', '/api/v1/extensions/themes/admin/activate', { slug });
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().error.code).toBe('THEME_TARGET_MISMATCH');
    const restored = await admin('POST', '/api/v1/extensions/themes/shop/restore-previous');
    expect(restored.json().data.slug).toBe('default-shop');
    expect(await prisma.themeActive.count({ where: { target: 'shop' } })).toBe(1);
    expect((await admin('POST', '/api/v1/extensions/themes/admin/restore-previous')).statusCode).toBe(409);
  });

  it('D blocks active uninstall and audits inactive uninstall', async () => {
    const blocked = await admin('DELETE', '/api/v1/extensions/theme/default-shop');
    expect(blocked.statusCode).toBe(409);
    const other = await base(second);
    const installed = await upload(other);
    expect(installed.statusCode, installed.body).toBe(200);
    expect((await admin('POST', '/api/v1/extensions/themes/shop/activate', { slug: second })).statusCode).toBe(200);
    const activeDelete = await admin('DELETE', `/api/v1/extensions/theme/${second}`);
    expect(activeDelete.statusCode).toBe(409);
    expect(activeDelete.json().error.code).toBe('THEME_ACTIVE');
    const configUrl = `/api/v1/extensions/themes/${second}/config`;
    expect((await admin('PUT', configUrl, { values: { color: '#abcdef' }, expectedRevision: 0 })).statusCode).toBe(200);
    expect((await admin('PUT', configUrl, { values: { color: '#123456' }, expectedRevision: 1 })).statusCode).toBe(200);
    expect((await admin('POST', '/api/v1/extensions/themes/shop/activate', { slug: 'default-shop' })).statusCode).toBe(200);
    expect((await admin('DELETE', `/api/v1/extensions/theme/${second}`)).statusCode).toBe(200);
    expect(await prisma.themeConfiguration.findUnique({ where: { slug: second } })).toBeNull();
    expect(await prisma.themeConfigRevision.count({ where: { slug: second } })).toBe(0);
    expect(await prisma.themeActivation.count({ where: { slug: second } })).toBe(1);
    const restored = await admin('POST', '/api/v1/extensions/themes/shop/restore-previous');
    expect(restored.statusCode).toBe(200);
    expect(restored.json().data.slug).toBe(slug);
    expect(await prisma.adminAuditEvent.count({ where: { action: 'theme.uninstall', targetId: second } })).toBe(1);
  });

  it('E validates config values and optimistic revision; F restores as a new revision', async () => {
    const url = `/api/v1/extensions/themes/${slug}/config`;
    const invalid: Array<[Record<string, unknown>, string]> = [
      [{ color: 1 }, '/values/color'], [{ quantity: 11 }, '/values/quantity'],
      [{ caption: { en: 'x', 'zh-Hans': 'y' } }, '/values/caption'],
      [{ picture: 'https://example.org/a.png' }, '/values/picture'],
      [{ category: 'missing' }, '/values/category'],
      [{ products: ['missing'] }, '/values/products'],
    ];
    for (const [values, location] of invalid) {
      const response = await admin('PUT', url, { values, expectedRevision: 0 });
      expect(response.statusCode, location).toBe(400);
      expect(response.json().error.details.path).toBe(location);
    }
    expect((await admin('GET', url)).json().data.revision).toBe(0);
    const saved = await admin('PUT', url, { values: { color: '#abcdef', caption: local }, expectedRevision: 0 });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().data.revision).toBe(1);
    expect((await admin('PUT', url, { values: {}, expectedRevision: 0 })).json().error.code).toBe('THEME_CONFIG_CONFLICT');
    expect((await admin('PUT', url, { values: { color: '#654321' }, expectedRevision: 1 })).statusCode).toBe(200);
    const restored = await admin('POST', `${url}/restore-previous`);
    expect(restored.json().data).toMatchObject({ revision: 3, values: { color: '#abcdef' } });
    expect((await admin('PUT', url, { values: { color: '#abcdef', caption: local, quantity: 8 }, expectedRevision: 3 })).statusCode).toBe(200);
  });

  it('G resolves localized settings and versioned assets without internals', async () => {
    expect((await admin('POST', '/api/v1/extensions/themes/shop/activate', { slug })).statusCode).toBe(200);
    const response = await app.inject({ url: '/api/v1/store/theme?target=shop&locale=en' });
    expect(response.headers['cache-control']).toBe('no-store');
    const data = response.json().data;
    expect(data.tokens.primary).toBe('#abcdef');
    expect(data.layout.pages.home.sections[0].settings.title).toBe('Hello');
    expect(data.fonts[0].url).toContain(`/api/v1/themes/${slug}/1.0.0/fonts/title.woff2`);
    expect((await app.inject({ url: data.fonts[0].url })).statusCode).toBe(200);
    expect(JSON.stringify(data)).not.toMatch(/packageHash|manifestJson|installedAt/);
    const adminTheme = (await app.inject({ url: '/api/v1/store/theme?target=admin&locale=en' })).json().data;
    expect(adminTheme.tokens.primary).toBeDefined();
    expect(adminTheme.logo).toBeNull();
    const adminManifest = {
      ...JSON.parse(await fs.readFile(path.join(root, 'default-admin', 'theme.json'), 'utf8')),
      slug: adminSlug, assets: { logo: 'assets/hero.png', 'login-background': 'assets/hero.png' },
    };
    expect((await upload(adminManifest)).statusCode).toBe(200);
    expect((await admin('POST', '/api/v1/extensions/themes/admin/activate', { slug: adminSlug })).statusCode).toBe(200);
    const branded = (await app.inject({ url: '/api/v1/store/theme?target=admin&locale=zh-Hans' })).json().data;
    expect(branded.logo).toContain(`/api/v1/themes/${adminSlug}/1.0.0/assets/hero.png`);
    expect(branded.loginBackground).toBe(branded.logo);
    expect((await app.inject({ url: branded.logo })).statusCode).toBe(200);
  });

  it('H serializes only valid declared CSS properties', () => {
    for (const injection of ['#fff;} body{', 'url(x)', 'expression(', 'x'.repeat(1000)]) {
      const css = themeTokensToCss('shop', { primary: injection, invented: injection });
      expect(css).toContain('--shop-primary: #166b52;');
      expect(css).not.toContain(injection);
      expect(css).not.toContain('invented');
    }
  });

  it('I migrates invalid and removed values on upgrade with audit', async () => {
    const next = await base(slug, '1.1.0');
    next.settings = next.settings.filter((item: { id: string }) => item.id !== 'caption');
    next.settings.find((item: { id: string }) => item.id === 'quantity').constraints.max = 5;
    next.layout.pages.home.sections = [];
    const upgraded = await upload(next);
    expect(upgraded.statusCode, upgraded.body).toBe(200);
    const config = (await admin('GET', `/api/v1/extensions/themes/${slug}/config`)).json().data;
    expect(config.values).not.toHaveProperty('caption');
    expect(config.values).not.toHaveProperty('quantity');
    expect(config.values.color).toBe('#abcdef');
    expect(config.revision).toBe(5);
    expect(await prisma.adminAuditEvent.count({ where: { action: 'theme.config.migrated', targetId: slug } })).toBe(1);
  });

  it('J records each mutation once; K protects admin routes and publishes the resolver', async () => {
    const expected: Array<[string, string, number]> = [
      ['theme.install', slug, 2], ['theme.install', second, 1], ['theme.install', adminSlug, 1],
      ['theme.activate', slug, 2], ['theme.activate', second, 1],
      ['theme.restore_previous', slug, 1], ['theme.restore_previous', 'default-shop', 1],
      ['theme.config.update', slug, 3], ['theme.config.update', second, 2],
      ['theme.config.restore', slug, 1], ['theme.config.migrated', slug, 1],
      ['theme.uninstall', second, 1],
    ];
    for (const [action, targetId, count] of expected) {
      const events = await prisma.adminAuditEvent.findMany({ where: { action, targetId } });
      expect(events.length, `${action} ${targetId}`).toBe(count);
      expect(events.every((event) => event.targetType === 'theme' && event.actorId === actorId)).toBe(true);
    }
    const revisions = await prisma.themeConfigRevision.findMany({ where: { slug } });
    expect(revisions.map((item) => item.revision).sort()).toEqual([1, 2, 3, 4, 5]);
    const spec = app.swagger();
    for (const [method, route] of [
      ['post', '/api/v1/extensions/themes/{target}/activate'],
      ['post', '/api/v1/extensions/themes/{target}/restore-previous'],
      ['get', '/api/v1/extensions/themes/{slug}/config'],
      ['put', '/api/v1/extensions/themes/{slug}/config'],
      ['post', '/api/v1/extensions/themes/{slug}/config/restore-previous'],
    ]) {
      expect(spec.paths[route]?.[method]?.security).toEqual([{ bearerAuth: [] }]);
      const url = route.replace('{target}', 'shop').replace('{slug}', slug);
      expect((await app.inject({ method: method.toUpperCase(), url })).statusCode).toBe(401);
      expect((await app.inject({ method: method.toUpperCase(), url, headers: headers(customer) })).statusCode).toBe(403);
    }
    expect(spec.paths['/api/v1/store/theme']?.get?.security).toBeUndefined();
  });
});
