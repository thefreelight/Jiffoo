import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '@/server';
import { getTestPrisma } from '../helpers/db';
import { pageFiles, pageManifest, pageZip } from '../fixtures/plugin-pages';
import { pluginAssetRoutes, pluginPublicOriginFor, pluginPublicOrigins } from '@/core/plugin-pages/asset-routes';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';

const prisma = getTestPrisma();
const peer = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_TEST } } });
let app: Awaited<ReturnType<typeof buildApp>>;
let installationId: string;
let hash: string;
const slug = 'p2-asset-fixture';
const manifest = pageManifest(slug);
delete manifest.serviceDependencies;
delete manifest.services;
delete manifest.tasks;
const files = [...pageFiles(manifest), { path: 'ui/undeclared.html', content: Buffer.from('<!doctype html><p>Undeclared</p>') }];
const url = (path: string) => `/api/v1/plugin-assets/${installationId}/${hash}/${path}`;

beforeAll(async () => {
  vi.stubEnv('STOREFRONT_URL', 'http://localhost:3003');
  vi.stubEnv('ADMIN_URL', 'http://localhost:3002');
  app = await buildApp();
  const bytes = await pageZip(files);
  hash = createHash('sha256').update(bytes).digest('hex');
  await prisma.pluginInstall.create({ data: { slug, name: manifest.name, version: manifest.version,
    manifestJson: JSON.parse(JSON.stringify(manifest)), zipHash: hash, source: 'local-zip',
    entryModule: manifest.entryModule, packageBlobs: { create: { zipHash: hash, bytes, sizeBytes: bytes.length } } } });
  const installation = await prisma.pluginInstallation.create({ data: { pluginSlug: slug, instanceKey: 'default', enabled: true } });
  installationId = installation.id;
});
afterAll(async () => {
  await prisma.pluginInstall.deleteMany({ where: { slug } });
  await peer.$disconnect();
  await app?.close();
  vi.unstubAllEnvs();
});

it.each(files.filter(file => file.path.startsWith('ui/') && file.path !== 'ui/undeclared.html'))('serves indexed bytes only: $path', async file => {
  const response = await app.inject({ url: url(file.path.slice(3)), headers: { host: 'localhost:3003', origin: 'null', cookie: 'ignored=identity' } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.rawPayload).toEqual(file.content);
  expect(response.headers['access-control-allow-origin']).toBe('*');
  expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  expect(response.headers['set-cookie']).toBeUndefined();
  expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['cache-control']).toBe('public,max-age=31536000,immutable');
  expect(response.headers.etag).toBe(`"${createHash('sha256').update(file.content).digest('hex')}"`);
  expect(response.headers['content-length']).toBe(String(file.content.length));
  const extension = file.path.split('.').at(-1)!;
  const mime: Record<string, string> = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', woff2: 'font/woff2' };
  expect(response.headers['content-type']?.split(';')[0]).toBe(mime[extension]);
});
it.each(['localhost:3003', 'localhost:3002'])('uses the exact configured origin for Host %s without X-Frame-Options', async host => {
  const response = await app.inject({ url: url('index.html'), headers: { host } });
  expect(response.statusCode, response.body).toBe(200);
  const origin = `http://${host}`;
  const expected = `default-src 'none';script-src ${origin};style-src ${origin} 'unsafe-inline';font-src ${origin};img-src ${origin} data: blob:;connect-src ${origin};object-src 'none';base-uri 'none';form-action 'none';frame-src 'none';worker-src 'none';frame-ancestors http://localhost:3003 http://localhost:3002;sandbox allow-scripts allow-forms`;
  expect(response.headers['content-security-policy']).toBe(expected);
  expect(response.headers['x-frame-options']).toBeUndefined();
  expect(expected).toContain("form-action 'none'");
  expect(expected).toContain('sandbox allow-scripts allow-forms');
  expect(expected).not.toContain('allow-same-origin');
  expect(expected).not.toContain('unsafe-eval');
  expect(expected).not.toContain("script-src 'self'");
  expect((await app.inject({ url: '/health' })).headers['x-frame-options']).toBe('SAMEORIGIN');
});
it.each(['localhost', 'localhost:3001', 'evil.example', 'LOCALHOST:3003', 'localhost:3003.evil.example'])('refuses frame HTML on unmatched Host %s', async host => {
  expect((await app.inject({ url: url('index.html'), headers: { host } })).statusCode).toBe(404);
  expect((await app.inject({ url: url('assets/app.js'), headers: { host, origin: 'null' } })).statusCode).toBe(200);
});
it('serves frame HTML for the forwarded public host when the request host is the internal API host', async () => {
  const response = await app.inject({ url: url('index.html'), headers: { host: '127.0.0.1:3001', 'x-forwarded-host': 'localhost:3003' } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.headers['content-security-policy']).toContain('script-src http://localhost:3003');
  expect(response.headers['content-security-policy']).toContain('frame-ancestors http://localhost:3003 http://localhost:3002');
});
it('refuses frame HTML when neither the request host nor the forwarded host matches a configured origin', async () => {
  const response = await app.inject({ url: url('index.html'), headers: { host: '127.0.0.1:3001', 'x-forwarded-host': 'evil.example' } });
  expect(response.statusCode).toBe(404);
});
it.each([
  ['localhost:3002', 'localhost:3003'],
  ['localhost:3003', 'localhost:3002'],
  ['localhost:3002', 'evil.example'],
  ['localhost:3002', 'localhost:3003, evil.example'],
])('uses Host %s before forwarded host %s', async (host, forwarded) => {
  const response = await app.inject({ url: url('index.html'), headers: { host, 'x-forwarded-host': forwarded } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.headers['content-security-policy']).toContain(`script-src http://${host};`);
});
it.each([
  'localhost:3003, evil.example', 'evil.example, localhost:3003',
  'localhost:3003, localhost:3003', 'LOCALHOST:3003',
  'localhost:3003.evil.example', 'localhost:3003:80', '',
])('refuses frame HTML for an unconfigured Host and invalid forwarded host %j', async forwarded => {
  const response = await app.inject({ url: url('index.html'), headers: { host: 'internal.example', 'x-forwarded-host': forwarded } });
  expect(response.statusCode).toBe(404);
});
it.each([
  { forwarded: ['localhost:3003'] },
  { forwarded: ['localhost:3003', 'localhost:3002'] },
])('rejects forwarded host arrays instead of selecting their first value: $forwarded', ({ forwarded }) => {
  const origins = pluginPublicOrigins({ STOREFRONT_URL: 'http://localhost:3003', ADMIN_URL: 'http://localhost:3002' });
  expect(pluginPublicOriginFor({ headers: { host: 'internal.example', 'x-forwarded-host': forwarded } }, origins)).toBeNull();
  expect(pluginPublicOriginFor({ headers: { host: 'localhost:3002', 'x-forwarded-host': forwarded } }, origins)?.origin).toBe('http://localhost:3002');
});
it.each([' localhost:3003', 'localhost:3003 '])('does not normalize forwarded host %j into an exact match', forwarded => {
  const origins = pluginPublicOrigins({ STOREFRONT_URL: 'http://localhost:3003', ADMIN_URL: 'http://localhost:3002' });
  expect(pluginPublicOriginFor({ headers: { host: 'internal.example', 'x-forwarded-host': forwarded } }, origins)).toBeNull();
});
it.each([
  {}, { STOREFRONT_URL: 'http://localhost:3003' },
  { STOREFRONT_URL: 'null', ADMIN_URL: 'http://localhost:3002' },
  { STOREFRONT_URL: 'https://shop.example/path', ADMIN_URL: 'https://admin.example' },
  { STOREFRONT_URL: 'http://shop.example', ADMIN_URL: 'https://admin.example' },
  { STOREFRONT_URL: 'https://user:password@shop.example', ADMIN_URL: 'https://admin.example' },
  { STOREFRONT_URL: 'https://*.example.com', ADMIN_URL: 'https://admin.example' },
  { STOREFRONT_URL: 'https://shop.example;object-src', ADMIN_URL: 'https://admin.example' },
])('fails closed for missing or invalid public-origin configuration: %j', async config => {
  expect(pluginPublicOrigins(config)).toBeNull();
  vi.stubEnv('STOREFRONT_URL', config.STOREFRONT_URL ?? '');
  vi.stubEnv('ADMIN_URL', config.ADMIN_URL ?? '');
  const isolated = Fastify();
  await isolated.register(helmet);
  await isolated.register(pluginAssetRoutes, { prefix: '/api/v1' });
  try {
    const response = await isolated.inject({ url: url('index.html'), headers: { host: 'localhost:3003' } });
    expect(response.statusCode).toBe(404);
    const asset = await isolated.inject({ url: url('assets/app.js') });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['access-control-allow-origin']).toBe('*');
  } finally {
    await isolated.close();
    vi.stubEnv('STOREFRONT_URL', 'http://localhost:3003');
    vi.stubEnv('ADMIN_URL', 'http://localhost:3002');
  }
});
it.each(['undeclared.html', 'server/index.js', '../manifest.json', '%2e%2e%2fmanifest.json', 'assets/app.js.map', 'unknown/index.html'])('does not expose %s', async path => {
  expect((await app.inject({ url: url(path) })).statusCode).toBe(404);
});
it('checks archive integrity before returning conditional bytes', async () => {
  const original = await prisma.pluginPackageBlob.findUniqueOrThrow({ where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash: hash } } });
  const changed = Buffer.from(original.bytes);
  changed[0] ^= 1;
  await peer.pluginPackageBlob.update({ where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash: hash } }, data: { bytes: changed } });
  try {
    const response = await app.inject({ url: url('assets/app.js'), headers: { 'if-none-match': '*' } });
    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
  } finally {
    await peer.pluginPackageBlob.update({ where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash: hash } }, data: { bytes: original.bytes } });
  }
});
it('fails closed on dependency operational state until G4 provides authoritative admission', async () => {
  const dependent = { ...manifest, serviceDependencies: [{ plugin: 'missing-provider', service: 'wallet', version: 1, methods: ['debit'] }] };
  const bytes = await pageZip(pageFiles(dependent));
  const dependentHash = createHash('sha256').update(bytes).digest('hex');
  await peer.pluginPackageBlob.create({ data: { pluginSlug: slug, zipHash: dependentHash, bytes, sizeBytes: bytes.length } });
  await peer.pluginInstall.update({ where: { slug }, data: { zipHash: dependentHash } });
  try {
    for (const path of ['index.html', 'assets/app.js']) {
      const response = await app.inject({ url: `/api/v1/plugin-assets/${installationId}/${dependentHash}/${path}`,
        headers: { host: 'localhost:3003', 'if-none-match': '*' } });
      expect(response.statusCode).toBe(404);
    }
  } finally {
    await peer.pluginInstall.update({ where: { slug }, data: { zipHash: hash } });
    await peer.pluginPackageBlob.delete({ where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash: dependentHash } } });
  }
});
it('supports HEAD and conditional requests only after shared database lifecycle checks', async () => {
  const first = await app.inject({ url: url('index.html'), headers: { host: 'localhost:3003' } });
  const headers = { host: 'localhost:3003', 'if-none-match': first.headers.etag! };
  const head = await app.inject({ method: 'HEAD', url: url('index.html'), headers });
  expect(head.statusCode).toBe(304);
  expect(head.body).toBe('');
  expect((await app.inject({ url: url('index.html'), headers })).statusCode).toBe(304);
  for (const data of [{ enabled: false }, { deletedAt: new Date() }]) {
    await peer.pluginInstallation.update({ where: { id: installationId }, data });
    expect((await app.inject({ url: url('index.html'), headers })).statusCode).toBe(404);
    await peer.pluginInstallation.update({ where: { id: installationId }, data: { enabled: true, deletedAt: null } });
  }
  await peer.pluginInstall.update({ where: { slug }, data: { zipHash: 'a'.repeat(64) } });
  expect((await app.inject({ url: url('index.html'), headers })).statusCode).toBe(404);
  await peer.pluginInstall.update({ where: { slug }, data: { zipHash: hash, deletedAt: new Date() } });
  expect((await app.inject({ url: url('index.html'), headers })).statusCode).toBe(404);
  await peer.pluginInstall.update({ where: { slug }, data: { deletedAt: null } });
  expect((await app.inject({ url: url('index.html'), headers })).statusCode).toBe(304);
  await peer.pluginInstallation.delete({ where: { id: installationId } });
  expect((await app.inject({ url: url('index.html'), headers })).statusCode).toBe(404);
});
